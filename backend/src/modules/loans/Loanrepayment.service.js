import ChamaLoan from '../../models/ChamaLoan.js';
import LoanPayment from '../../models/loanPayment.js';
import AppError from '../../utils/AppError.js';
import { getOrCreatePolicy } from './Loanpolicy.service.js';
import { recalculateSchedule } from './Loanpenalty.service.js';
import loanAccounting from './Loanaccounting.service.js';
import { LOAN_STATUS, paymentReference } from './Loan.constants.js';
import { createAuditLog, AUDIT_SCOPE_TYPES } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';

const round2 = (n) => Math.round(n * 100) / 100;

const OPEN_FOR_REPAYMENT = ['active', 'partially_repaid', 'overdue', 'defaulted'];

/**
 * Allocates one incoming payment across the schedule using the Chama's
 * configured waterfall (spec section 15), oldest installment first.
 * Mutates `loan.repayment_schedule` in place and returns the totals
 * actually consumed per bucket.
 */
function allocatePayment(loan, policy, amount) {
  let remaining = round2(amount);
  const allocation = { penalty: 0, interest: 0, principal: 0 };
  const order = policy.repayment_waterfall?.length ? policy.repayment_waterfall : ['penalty', 'interest', 'principal'];

  const sortedItems = [...loan.repayment_schedule].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));

  for (const bucket of order) {
    if (remaining <= 0) break;
    for (const item of sortedItems) {
      if (remaining <= 0) break;

      if (bucket === 'penalty') {
        const due = round2(Math.max(0, (item.penalty_accrued || 0) - (item.penalty_paid || 0)));
        if (due <= 0) continue;
        const pay = Math.min(due, remaining);
        item.penalty_paid = round2((item.penalty_paid || 0) + pay);
        allocation.penalty = round2(allocation.penalty + pay);
        remaining = round2(remaining - pay);
      } else if (bucket === 'interest') {
        const due = round2(Math.max(0, item.interest_due - item.interest_paid));
        if (due <= 0) continue;
        const pay = Math.min(due, remaining);
        item.interest_paid = round2(item.interest_paid + pay);
        allocation.interest = round2(allocation.interest + pay);
        remaining = round2(remaining - pay);
      } else if (bucket === 'principal') {
        const due = round2(Math.max(0, item.principal_due - item.principal_paid));
        if (due <= 0) continue;
        const pay = Math.min(due, remaining);
        item.principal_paid = round2(item.principal_paid + pay);
        allocation.principal = round2(allocation.principal + pay);
        remaining = round2(remaining - pay);
      }

      const itemRemaining =
        round2(item.principal_due - item.principal_paid) + round2(item.interest_due - item.interest_paid);
      if (itemRemaining <= 0) {
        item.status = 'paid';
        item.paid_at = item.paid_at || new Date();
      }
    }
  }

  // Any overpayment beyond everything currently due is banked against
  // principal of the next unpaid installment (keeps money from vanishing).
  if (remaining > 0) {
    for (const item of sortedItems) {
      if (remaining <= 0) break;
      const due = round2(item.principal_due - item.principal_paid);
      if (due < 0) continue;
      const pay = Math.min(remaining, remaining); // apply as advance principal payment
      item.principal_paid = round2(item.principal_paid + pay);
      allocation.principal = round2(allocation.principal + pay);
      remaining = round2(remaining - pay);
      if (round2(item.principal_due - item.principal_paid) <= 0 && round2(item.interest_due - item.interest_paid) <= 0) {
        item.status = 'paid';
        item.paid_at = item.paid_at || new Date();
      }
      break;
    }
  }

  return allocation;
}

function isFullyClosed(loan) {
  return (
    round2(loan.balances.principal_outstanding) <= 0 &&
    round2(loan.balances.interest_outstanding) <= 0 &&
    round2(loan.balances.penalty_outstanding) <= 0
  );
}

async function closeLoan(loan, userId) {
  loan.status = LOAN_STATUS.CLOSED;
  const totals = loan.repayment_schedule.reduce(
    (acc, item) => ({
      principal: round2(acc.principal + item.principal_paid),
      interest: round2(acc.interest + item.interest_paid),
      penalty: round2(acc.penalty + item.penalty_paid),
    }),
    { principal: 0, interest: 0, penalty: 0 }
  );

  loan.closure = {
    closed_at: new Date(),
    closed_by: userId || null,
    final_payment_id: loan.closure?.final_payment_id || null,
    total_principal_paid: totals.principal,
    total_interest_paid: totals.interest,
    total_penalties_paid: totals.penalty,
  };
}

/**
 * Records one repayment against a loan — from M-Pesa, an automatic
 * contribution deduction, a manual treasurer entry, or a guarantor
 * recovery draw. Allocates via the waterfall, posts the accounting
 * entry, recalculates the schedule, and closes the loan if it's now
 * fully settled. Spec sections 14, 15, 19.
 */
export async function recordRepayment({ chama, loanId, amount, source, externalReference, recordedBy, membershipIdOverride = null }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new AppError('Repayment amount must be greater than zero', 400);
  }

  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id });
  if (!loan) throw new AppError('Loan not found', 404);
  if (!OPEN_FOR_REPAYMENT.includes(loan.status)) {
    throw new AppError(`Loan is not currently open for repayment (status: ${loan.status})`, 400);
  }

  const policy = await getOrCreatePolicy(chama._id);
  const allocation = allocatePayment(loan, policy, numericAmount);

  const payment = await LoanPayment.create({
    chama_id: chama._id,
    loan_id: loan._id,
    membership_id: membershipIdOverride || loan.membership_id,
    amount: numericAmount,
    allocation,
    source,
    reference: paymentReference(),
    external_reference: externalReference || null,
    recorded_by: recordedBy,
  });

  const { isDefault } = recalculateSchedule(loan, policy);

  if (isFullyClosed(loan)) {
    await closeLoan(loan, recordedBy);
    loan.closure.final_payment_id = payment._id;
  } else if (isDefault) {
    if (loan.status !== LOAN_STATUS.DEFAULTED) {
      loan.status = LOAN_STATUS.DEFAULTED;
    }
  } else if (loan.default_info.days_late > 0) {
    loan.status = LOAN_STATUS.OVERDUE;
  } else {
    loan.status = LOAN_STATUS.PARTIALLY_REPAID;
  }

  payment.balance_after = { ...loan.balances };
  await payment.save();

  await loanAccounting.postRepayment({ chama, loan, payment, userId: recordedBy });
  await loan.save();

  await createAuditLog({
    actorUserId: recordedBy,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: chama._id,
    action: loan.status === LOAN_STATUS.CLOSED ? AUDIT_ACTIONS.LOAN_CLOSED : AUDIT_ACTIONS.LOAN_REPAID,
    resourceType: 'ChamaLoan',
    resourceId: loan._id,
    after: { amount: numericAmount, allocation, status: loan.status, source },
  }).catch(() => null);

  return { loan, payment };
}

/**
 * Kicks off an M-Pesa STK push for a member to pay their own loan
 * (spec section 14, Option A). Nothing is applied to the loan until
 * Safaricom's callback confirms it via `reconcileStkRepayment`.
 */
export async function initiateStkRepayment({ chama, loanId, membership, amount, phoneNumber, userId }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new AppError('Repayment amount must be greater than zero', 400);
  }

  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id });
  if (!loan) throw new AppError('Loan not found', 404);
  if (!OPEN_FOR_REPAYMENT.includes(loan.status)) {
    throw new AppError(`Loan is not currently open for repayment (status: ${loan.status})`, 400);
  }
  if (String(loan.membership_id) !== String(membership._id)) {
    throw new AppError('You can only repay your own loan', 403);
  }

  const result = await mpesaService.initiateStkPush({
    amount: numericAmount,
    phoneNumber,
    accountReference: loan.reference || String(loan._id).slice(-8),
    transactionDescription: `Loan repayment ${loan.reference || ''}`.trim(),
  });

  loan.pending_repayment = {
    checkout_request_id: result.checkoutRequestId,
    merchant_request_id: result.merchantRequestId,
    amount: numericAmount,
    phone_number: mpesaService.normalizePhoneNumber(phoneNumber),
    initiated_by: userId,
    initiated_at: new Date(),
  };
  await loan.save();

  return { loan, stk: result };
}

/**
 * Called from the shared M-Pesa STK callback once Safaricom confirms
 * (or fails) an STK repayment initiated above. Returns true if this
 * callback belonged to a loan repayment (so the caller can stop
 * trying other reconcilers), false otherwise.
 */
export async function reconcileStkRepayment(callback) {
  if (!callback?.checkoutRequestId) return false;

  const loan = await ChamaLoan.findOne({ 'pending_repayment.checkout_request_id': callback.checkoutRequestId });
  if (!loan) return false;

  const pending = loan.pending_repayment;
  loan.pending_repayment = { checkout_request_id: null, merchant_request_id: null, amount: null, phone_number: null, initiated_by: null, initiated_at: null };

  if (!callback.success) {
    await loan.save();
    return true;
  }

  const amount = Number(callback.amount) || pending?.amount;
  if (!amount) {
    await loan.save();
    return true;
  }

  await loan.save();

  await recordRepayment({
    chama: { _id: loan.chama_id },
    loanId: loan._id,
    amount,
    source: 'mpesa',
    externalReference: callback.mpesaReceiptNumber,
    recordedBy: pending?.initiated_by || null,
  });

  return true;
}

export async function getRepaymentHistory(chamaId, loanId) {
  return LoanPayment.find({ chama_id: chamaId, loan_id: loanId }).sort({ createdAt: -1 });
}

/** Re-runs penalty/overdue/default calculation for one loan without a payment (spec section 16-17). */
export async function refreshLoanStatus({ chama, loanId }) {
  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id });
  if (!loan) throw new AppError('Loan not found', 404);
  if (!OPEN_FOR_REPAYMENT.includes(loan.status)) return loan;

  const policy = await getOrCreatePolicy(chama._id);
  const wasDefault = loan.default_info.is_default;
  const { isDefault, anyOverdue } = recalculateSchedule(loan, policy);

  if (isDefault) {
    loan.status = LOAN_STATUS.DEFAULTED;
  } else if (anyOverdue) {
    loan.status = LOAN_STATUS.OVERDUE;
  }

  await loan.save();

  if (isDefault && !wasDefault) {
    await createAuditLog({
      actorUserId: null,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: chama._id,
      action: AUDIT_ACTIONS.LOAN_DEFAULTED,
      resourceType: 'ChamaLoan',
      resourceId: loan._id,
      after: { days_late: loan.default_info.days_late },
    }).catch(() => null);
  }

  return loan;
}

/** Batch maintenance job — recalculates every open loan in a Chama. Safe to run on a schedule (e.g. daily cron). */
export async function refreshAllLoans(chamaId) {
  const loans = await ChamaLoan.find({ chama_id: chamaId, status: { $in: OPEN_FOR_REPAYMENT } });
  const results = [];
  for (const loan of loans) {
    results.push(await refreshLoanStatus({ chama: { _id: chamaId }, loanId: loan._id }));
  }
  return results;
}

export default {
  recordRepayment,
  getRepaymentHistory,
  refreshLoanStatus,
  refreshAllLoans,
  initiateStkRepayment,
  reconcileStkRepayment,
};