import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import C2bPayment from '../../models/C2bPayment.js';
import AppError from '../../utils/AppError.js';
import phoneUtil from '../../utils/phone.js';
import { recordC2bContribution } from '../chama/chamaFinance.service.js';

// ======================================================================
// C2B RECONCILIATION SERVICE
// ======================================================================
//
// The account number a member types into their Paybill screen is free
// text - they can typo it. Matching here is lenient-but-structured: we
// accept a couple of known formats, and if BillRefNumber doesn't parse
// to a known member/chama we NEVER reject the payment (money is real
// and already Safaricom's problem, not ours to bounce) - it's just
// recorded 'unmatched' for an admin to reconcile by hand.
//
// Supported BillRefNumber formats:
//   "<phone>"              - contribute to the member's only active chama
//   "<phone>-<joinCode>"   - disambiguate when the member belongs to
//                            more than one chama (Chama.join_code, the
//                            same 6-char code used for app invites)
// ======================================================================

const JOIN_CODE_RE = /^[A-Z0-9]{6}$/;

export const matchBillRefNumber = async (billRefNumber) => {
  const raw = String(billRefNumber || '').trim();
  if (!raw) return { matched: false, note: 'No account number was entered for this payment.' };

  const parts = raw.split('-').map((p) => p.trim()).filter(Boolean);
  const phonePart = parts[0];
  const joinCodePart = parts[1] ? parts[1].toUpperCase() : null;

  if (joinCodePart && !JOIN_CODE_RE.test(joinCodePart)) {
    return { matched: false, note: `"${joinCodePart}" is not a valid chama join code.` };
  }

  let phoneNumber;
  try {
    phoneNumber = phoneUtil.formatPhone(phonePart);
  } catch {
    return { matched: false, note: `Could not read a phone number from account number "${raw}".` };
  }

  const user = await User.findOne({ phone: phoneNumber }).lean();
  if (!user) return { matched: false, note: `No VeriCircle account is linked to ${phoneNumber}.`, phoneNumber };

  let membership;
  let chama;

  if (joinCodePart) {
    chama = await Chama.findOne({ join_code: joinCodePart }).lean();
    if (!chama) return { matched: false, note: `No chama found for join code ${joinCodePart}.`, phoneNumber };

    membership = await ChamaMembership.findOne({ user_id: user._id, chama_id: chama._id, status: 'active' }).lean();
    if (!membership) {
      return {
        matched: false,
        note: `${user.name || phoneNumber} is not an active member of ${chama.name}.`,
        phoneNumber,
      };
    }
  } else {
    const memberships = await ChamaMembership.find({ user_id: user._id, status: 'active' }).lean();
    if (memberships.length === 0) {
      return { matched: false, note: `${phoneNumber} has no active chama memberships.`, phoneNumber };
    }
    if (memberships.length > 1) {
      return {
        matched: false,
        note: `${phoneNumber} belongs to ${memberships.length} chamas — resend as PHONE-JOINCODE to disambiguate.`,
        phoneNumber,
      };
    }
    membership = memberships[0];
    chama = await Chama.findById(membership.chama_id).lean();
  }

  return { matched: true, user, membership, chama, phoneNumber };
};

/**
 * Called from the ConfirmationURL webhook, AFTER the controller has
 * already responded 200 to Safaricom. Never throws past this point -
 * any failure here just leaves the row 'unmatched' with a note.
 */
export const processConfirmation = async (rawBody = {}) => {
  const receiptNumber = rawBody.TransID;
  if (!receiptNumber) {
    console.warn('[c2b] confirmation missing TransID, ignoring payload:', rawBody);
    return;
  }

  let record;
  try {
    record = await C2bPayment.create({
      mpesa_receipt_number: receiptNumber,
      transaction_type: rawBody.TransactionType,
      trans_time: rawBody.TransTime,
      amount: rawBody.TransAmount,
      business_short_code: rawBody.BusinessShortCode,
      bill_ref_number: rawBody.BillRefNumber,
      invoice_number: rawBody.InvoiceNumber,
      org_account_balance: rawBody.OrgAccountBalance,
      third_party_trans_id: rawBody.ThirdPartyTransID,
      msisdn: rawBody.MSISDN,
      payer_name: [rawBody.FirstName, rawBody.MiddleName, rawBody.LastName].filter(Boolean).join(' '),
      raw_callback: rawBody,
    });
  } catch (err) {
    if (err.code === 11000) {
      console.log(`[c2b] duplicate confirmation ignored for receipt ${receiptNumber}`);
      return;
    }
    console.error('[c2b] failed to record confirmation:', err);
    return;
  }

  const match = await matchBillRefNumber(record.bill_ref_number);

  if (!match.matched) {
    record.match_status = 'unmatched';
    record.match_note = match.note;
    await record.save();
    return;
  }

  try {
    const { paymentIntentId } = await recordC2bContribution({
      chama: match.chama,
      membership: match.membership,
      amount: record.amount.toString(),
      phoneNumber: match.phoneNumber,
      mpesaReceiptNumber: receiptNumber,
    });

    record.match_status = 'matched';
    record.matched_chama_id = match.chama._id;
    record.matched_membership_id = match.membership._id;
    record.matched_payment_intent_id = paymentIntentId;
    await record.save();
  } catch (err) {
    // The money is safely recorded on this row either way — routing it
    // into an obligation failed, so leave it for manual reconciliation
    // rather than losing track of it.
    record.match_status = 'unmatched';
    record.match_note = `Auto-match found ${match.user?.name || match.phoneNumber} but posting failed: ${err.message}`;
    await record.save();
  }
};

/**
 * Admin-triggered manual reconciliation for a row in the unmatched queue.
 */
export const manuallyMatchPayment = async ({ c2bPaymentId, chamaId, memberPhone, actorId }) => {
  const record = await C2bPayment.findById(c2bPaymentId);
  if (!record) throw new AppError('C2B payment not found', 404);
  if (record.match_status !== 'unmatched') {
    throw new AppError(`This payment is already ${record.match_status.replace('_', ' ')}.`, 409);
  }

  const phoneNumber = phoneUtil.formatPhone(memberPhone);
  const user = await User.findOne({ phone: phoneNumber });
  if (!user) throw new AppError(`No VeriCircle account is linked to ${phoneNumber}.`, 404);

  const membership = await ChamaMembership.findOne({ user_id: user._id, chama_id: chamaId, status: 'active' });
  if (!membership) throw new AppError('That member is not an active member of the selected chama.', 404);

  const chama = await Chama.findById(chamaId);
  if (!chama) throw new AppError('Chama not found', 404);

  const { paymentIntentId } = await recordC2bContribution({
    chama,
    membership,
    amount: record.amount.toString(),
    phoneNumber,
    mpesaReceiptNumber: record.mpesa_receipt_number,
  });

  record.match_status = 'manually_matched';
  record.matched_chama_id = chama._id;
  record.matched_membership_id = membership._id;
  record.matched_payment_intent_id = paymentIntentId;
  record.reconciled_by = actorId || null;
  record.reconciled_at = new Date();
  await record.save();

  return record;
};

export const listUnmatchedPayments = async ({ limit = 100 } = {}) => {
  return C2bPayment.find({ match_status: 'unmatched' }).sort({ createdAt: -1 }).limit(limit);
};
