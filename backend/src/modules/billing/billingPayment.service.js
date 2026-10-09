import crypto from 'node:crypto';

import Invoice from '../../models/Invoice.js';
import Subscription from '../../models/Subscription.js';
import AppError from '../../utils/AppError.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import { FREE_PLAN, isBillingEnforced } from '../../constants/billing.constants.js';
import {
  addMonths,
  isBlockedDowngrade,
  nextPeriodStart,
  priceInvoice,
  proratedCredit,
} from './billing.logic.js';
import {
  getEntitlement,
  getOrCreateSubscription,
  getPlan,
  invalidateEntitlement,
  priceForChama,
} from './billingEntitlement.service.js';

/**
 * Invoices, the STK push to the platform shortcode, and what happens when the
 * money lands. Everything here is the PLATFORM's income; none of it is posted
 * to a chama's ledger.
 */

const PENDING_WINDOW_MS = 90_000; // an STK prompt stays live about this long
const RECONCILE_AFTER_MS = 25_000; // start asking Safaricom if no callback by then

const newInvoiceNumber = () => {
  const d = new Date();
  const ym = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `INV-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

/** Open invoice for this plan and length, creating or re-using it. */
export async function createInvoice({ chamaId, planCode, months, userId }) {
  const listed = await getPlan(planCode);
  if (!listed || !listed.is_active) throw new AppError('That plan is not available', 404);
  if (listed.code === FREE_PLAN) {
    throw new AppError('The Free plan has nothing to pay. Use "switch to Free" instead.', 400);
  }

  const { subscription, plan: currentPlan, access } = await getEntitlement(chamaId);
  // This group's own price for the plan, if the platform set one.
  const target = priceForChama(listed, subscription);
  if (target.price_monthly <= 0) {
    throw new AppError('This plan has nothing to pay. Use "switch to Free" instead.', 400);
  }

  if (isBlockedDowngrade({ currentPlan, targetPlan: target, access })) {
    throw new AppError(
      'You are already paid up on a higher plan. You can switch to a lower plan in the last 7 days before renewal.',
      400
    );
  }

  // Moving UP while a paid period remains: credit the unused part of the old plan.
  const upgrading =
    subscription.status === 'active' &&
    access.state === 'active' &&
    currentPlan && currentPlan.code !== target.code &&
    target.price_monthly > currentPlan.price_monthly;
  const credit = upgrading
    ? proratedCredit({ currentPlan, periodEnd: subscription.current_period_end })
    : 0;

  let pricing;
  try {
    pricing = priceInvoice({ plan: target, months, credit });
  } catch (error) {
    throw new AppError(error.message, 400);
  }
  if (pricing.amount < 1) throw new AppError('Nothing to pay for this change', 400);

  // Re-use an identical open invoice so refreshing the page never piles them up.
  const existing = await Invoice.findOne({
    chama_id: chamaId, status: 'open', plan_code: target.code, months, amount: pricing.amount,
  });
  if (existing) return existing;

  // A different plan or length replaces older open invoices (unless an STK
  // prompt may still be in flight on one of them).
  const recent = new Date(Date.now() - PENDING_WINDOW_MS * 2);
  await Invoice.updateMany(
    {
      chama_id: chamaId, status: 'open',
      attempts: { $not: { $elemMatch: { status: 'pending', createdAt: { $gte: recent } } } },
    },
    { $set: { status: 'void' } }
  );

  return Invoice.create({
    number: newInvoiceNumber(),
    chama_id: chamaId,
    plan_code: target.code,
    plan_name: target.name,
    months,
    ...pricing,
    created_by: userId,
  });
}

/** Send the M-Pesa prompt for an invoice to the treasurer's phone. */
export async function payInvoice({ chamaId, invoiceId, phoneNumber, userId }) {
  const invoice = await Invoice.findOne({ _id: invoiceId, chama_id: chamaId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'paid') throw new AppError('This invoice is already paid', 409);
  if (invoice.status === 'void') throw new AppError('This invoice was replaced. Create a new one.', 409);

  const live = invoice.attempts.find(
    (a) => a.status === 'pending' && Date.now() - new Date(a.createdAt).getTime() < PENDING_WINDOW_MS
  );
  if (live) throw new AppError('A payment prompt was just sent. Check your phone before trying again.', 409);

  let stk;
  try {
    stk = await mpesaService.initiateStkPush({
      amount: invoice.amount,
      phoneNumber,
      accountReference: invoice.number,
      displayReference: invoice.number,
      transactionDescription: `Chama platform ${invoice.plan_name} plan`,
      allowMock: false, // real money only: never simulate a billing payment
    });
  } catch (error) {
    throw new AppError(error.message || 'Could not start the M-Pesa payment', error.statusCode || 502);
  }

  invoice.attempts.push({
    checkout_request_id: stk.checkoutRequestId,
    merchant_request_id: stk.merchantRequestId,
    phone: mpesaService.normalizePhoneNumber(phoneNumber),
    amount: invoice.amount,
    status: 'pending',
    initiated_by: userId,
  });
  await invoice.save();

  return { invoice, customerMessage: stk.customerMessage };
}

/**
 * Once an invoice has been flipped to paid, move the subscription forward.
 * Shared by the M-Pesa callback and by support marking an invoice paid by
 * receipt, so both extend access in exactly the same way.
 */
export async function applyPaidInvoiceToSubscription(invoice, now = new Date()) {
  const sub = await getOrCreateSubscription(invoice.chama_id);
  const start = nextPeriodStart({ sub, invoicePlanCode: invoice.plan_code, now });
  const end = addMonths(start, invoice.months);

  await Invoice.updateOne({ _id: invoice._id }, { $set: { period_start: start, period_end: end } });
  await Subscription.updateOne(
    { chama_id: invoice.chama_id },
    {
      $set: {
        plan_code: invoice.plan_code,
        status: 'active',
        current_period_start: start,
        current_period_end: end,
        last_paid_at: now,
        last_invoice_id: invoice._id,
      },
    }
  );
  invalidateEntitlement(invoice.chama_id);
  return { start, end };
}

/**
 * Apply a finished payment. Safe to call twice for the same callback: only the
 * first call that flips the invoice to paid extends the subscription.
 */
export async function settlePayment({ checkoutRequestId, success, amount, receipt, reason, cancelled = false }) {
  if (!checkoutRequestId) return { handled: false };

  const invoice = await Invoice.findOne({ 'attempts.checkout_request_id': checkoutRequestId });
  if (!invoice) return { handled: false }; // not a billing payment: let other handlers have it

  const attempt = invoice.attempts.find((a) => a.checkout_request_id === checkoutRequestId);
  if (attempt && attempt.status !== 'pending' && attempt.status !== 'failed') {
    // Settled already (often by the status query, which has no receipt): keep
    // the receipt when the callback arrives with it.
    if (success && receipt && !attempt.mpesa_receipt) {
      await Invoice.updateOne(
        { _id: invoice._id, 'attempts.checkout_request_id': checkoutRequestId },
        { $set: { 'attempts.$.mpesa_receipt': receipt, ...(invoice.mpesa_receipt ? {} : { mpesa_receipt: receipt }) } }
      );
    }
    return { handled: true, invoice, alreadyProcessed: true };
  }

  if (!success) {
    await Invoice.updateOne(
      { _id: invoice._id, 'attempts.checkout_request_id': checkoutRequestId },
      { $set: { 'attempts.$.status': cancelled ? 'cancelled' : 'failed', 'attempts.$.result_desc': reason || null } }
    );
    return { handled: true, paid: false };
  }

  // Never extend access for less than was charged.
  const paidAmount = Number(amount);
  if (Number.isFinite(paidAmount) && paidAmount < invoice.amount) {
    await Invoice.updateOne(
      { _id: invoice._id, 'attempts.checkout_request_id': checkoutRequestId },
      {
        $set: {
          needs_review: true,
          'attempts.$.status': 'failed',
          'attempts.$.mpesa_receipt': receipt || null,
          'attempts.$.result_desc': `Underpaid: received ${paidAmount}, invoice is ${invoice.amount}`,
        },
      }
    );
    return { handled: true, paid: false, underpaid: true };
  }

  // Claim this attempt first. The callback and the status poll can arrive at the
  // same moment; only one of them may go on to settle the invoice.
  const attemptClaim = await Invoice.updateOne(
    {
      _id: invoice._id,
      attempts: { $elemMatch: { checkout_request_id: checkoutRequestId, status: { $in: ['pending', 'failed'] } } },
    },
    { $set: { 'attempts.$.status': 'completed', 'attempts.$.mpesa_receipt': receipt || null } }
  );
  if (!attemptClaim.modifiedCount) return { handled: true, invoice, alreadyProcessed: true };

  const now = new Date();
  // The atomic claim: only one caller can move open/void -> paid.
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoice._id, status: { $in: ['open', 'void'] } },
    { $set: { status: 'paid', paid_at: now, mpesa_receipt: receipt || null } },
    { returnDocument: 'after' }
  );

  if (!claimed) {
    // Paid already (a second prompt was approved): record it for a refund review.
    await Invoice.updateOne(
      { _id: invoice._id, 'attempts.checkout_request_id': checkoutRequestId },
      {
        $set: {
          needs_review: true,
          'attempts.$.status': 'duplicate',
          'attempts.$.mpesa_receipt': receipt || null,
          'attempts.$.result_desc': 'Paid after the invoice was already settled',
        },
      }
    );
    return { handled: true, paid: false, duplicate: true };
  }

  await applyPaidInvoiceToSubscription(invoice, now);

  return { handled: true, paid: true, invoiceId: invoice._id };
}

/** Entry point for the shared M-Pesa STK callback. Never throws. */
export async function settleBillingStkCallback(args) {
  try {
    return await settlePayment(args);
  } catch (error) {
    console.error('[billing] callback settlement failed:', error.message);
    return { handled: false, error: true };
  }
}

/**
 * If the callback is late or never arrives, ask Safaricom directly. Called when
 * the treasurer's screen polls the invoice.
 */
export async function reconcilePendingInvoice(invoice) {
  if (!invoice || invoice.status !== 'open') return invoice;
  const pending = invoice.attempts.find(
    (a) => a.status === 'pending' && a.checkout_request_id &&
      Date.now() - new Date(a.createdAt).getTime() > RECONCILE_AFTER_MS
  );
  if (!pending) return invoice;
  // A simulated checkout id must never settle a real invoice.
  if (String(pending.checkout_request_id).startsWith('MOCK_')) return invoice;

  try {
    const result = await mpesaService.queryStkPush({ checkoutRequestId: pending.checkout_request_id });
    if (result.resultCode === 0) {
      await settlePayment({ checkoutRequestId: pending.checkout_request_id, success: true, amount: pending.amount });
    } else if (result.resultCode !== null && result.resultCode !== undefined) {
      await settlePayment({
        checkoutRequestId: pending.checkout_request_id,
        success: false,
        cancelled: result.resultCode === 1032,
        reason: result.resultDescription,
      });
    }
  } catch (error) {
    // Safaricom reports "still processing" as an error for a while; keep waiting.
    console.warn(`[billing] STK status check for ${pending.checkout_request_id} not final yet: ${error.message}`);
  }
  return Invoice.findById(invoice._id);
}

/** Leave a paid plan for Free (allowed any time it lapsed, or near renewal). */
export async function switchToFree({ chamaId }) {
  const { plan: currentPlan, access } = await getEntitlement(chamaId);
  const free = await getPlan(FREE_PLAN);
  if (!free) throw new AppError('Free plan is not configured', 500);
  if (isBlockedDowngrade({ currentPlan, targetPlan: free, access })) {
    throw new AppError(
      'You are already paid up. You can switch to Free in the last 7 days before renewal.',
      400
    );
  }
  await Subscription.updateOne(
    { chama_id: chamaId },
    { $set: { plan_code: FREE_PLAN, status: 'active', current_period_start: null, current_period_end: null } }
  );
  await Invoice.updateMany({ chama_id: chamaId, status: 'open' }, { $set: { status: 'void' } });
  invalidateEntitlement(chamaId);
  return getBillingSummary(chamaId);
}

/** Everything the billing screen and banner need, in one read. */
export async function getBillingSummary(chamaId) {
  const { subscription, plan, access } = await getEntitlement(chamaId);
  const openInvoice = await Invoice.findOne({ chama_id: chamaId, status: 'open' }).sort({ createdAt: -1 }).lean();
  return {
    // False until BILLING_ENFORCEMENT=on. The screens use it to stay quiet:
    // nothing is locked yet, so there is nothing to warn about.
    enforced: isBillingEnforced(),
    plan: plan && {
      code: plan.code, name: plan.name, price_monthly: plan.price_monthly,
      max_members: plan.max_members, modules: plan.modules,
    },
    state: access.state,
    access_until: access.access_until,
    grace_until: access.grace_until,
    days_left: access.days_left,
    grace_days_left: access.grace_days_left,
    trial_ends_at: subscription.status === 'trialing' ? subscription.trial_ends_at : null,
    current_period_end: subscription.current_period_end,
    open_invoice: openInvoice
      ? { _id: openInvoice._id, number: openInvoice.number, plan_code: openInvoice.plan_code, plan_name: openInvoice.plan_name, months: openInvoice.months, amount: openInvoice.amount, credit: openInvoice.credit }
      : null,
  };
}