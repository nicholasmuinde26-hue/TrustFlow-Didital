import ChamaLoan from '../../models/ChamaLoan.js';
import AppError from '../../utils/AppError.js';
import mpesaService from '../../payment/providers/mpesa/mpesa.service.js';
import loanAccounting from './loanaccounting.service.js';
import { LOAN_STATUS } from './loan.constants.js';
import { createAuditLog, AUDIT_SCOPE_TYPES } from '../../services/audit.service.js';
import { AUDIT_ACTIONS } from '../../constants/audit.constants.js';

/**
 * Kicks off disbursement. The loan is NOT marked `disbursed` here — only
 * `disbursement_pending` — because a B2C request being accepted by
 * Safaricom is not the same as funds actually settling. See spec
 * section 11: "Do not mark the loan as disbursed merely because a B2C
 * request was sent."
 */
export async function initiateDisbursement({ chama, loanId, userId }) {
  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id });
  if (!loan) throw new AppError('Loan not found', 404);
  if (loan.status !== LOAN_STATUS.APPROVED) {
    throw new AppError('Only an approved loan can be disbursed', 400);
  }

  if (loan.disbursement_method === 'mpesa' && !loan.phone_number) {
    throw new AppError('An approved loan with a member phone number is required for M-Pesa disbursement', 400);
  }

  loan.status = LOAN_STATUS.DISBURSEMENT_PENDING;
  loan.disbursement = { ...loan.disbursement, status: 'processing', provider: loan.disbursement_method };
  await loan.save();

  if (loan.disbursement_method !== 'mpesa') {
    // Manual channels (bank/cash) are confirmed explicitly by the treasurer
    // via confirmManualDisbursement — no automatic provider round trip.
    return loan;
  }

  try {
    const result = await mpesaService.initiateB2c({
      amount: loan.amount,
      phoneNumber: loan.phone_number,
      remarks: `Chama loan ${loan.reference}`,
      occasion: 'Loan disbursement',
    });

    loan.disbursement.provider_reference = result.conversationId;
    loan.disbursement.originator_conversation_id = result.originatorConversationId;
    await loan.save();
    return loan;
  } catch (error) {
    loan.status = LOAN_STATUS.APPROVED; // roll back so it can be retried
    loan.disbursement.status = 'failed';
    loan.disbursement.failure_reason = error.message;
    await loan.save();

    await createAuditLog({
      actorUserId: userId,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: chama._id,
      action: AUDIT_ACTIONS.LOAN_DISBURSEMENT_FAILED,
      resourceType: 'ChamaLoan',
      resourceId: loan._id,
      after: { reason: error.message },
    }).catch(() => null);

    throw error;
  }
}

/** Called from the M-Pesa B2C result webhook once the provider confirms settlement. */
export async function confirmMpesaDisbursement({ conversationId, success, failureReason, chamaLookup }) {
  const loan = await ChamaLoan.findOne({ 'disbursement.provider_reference': conversationId });
  if (!loan) return null;
  if (loan.status !== LOAN_STATUS.DISBURSEMENT_PENDING) return loan;

  if (!success) {
    loan.status = LOAN_STATUS.APPROVED;
    loan.disbursement.status = 'failed';
    loan.disbursement.failure_reason = failureReason || 'Provider declined the disbursement';
    await loan.save();
    return loan;
  }

  return markDisbursed({ loan, userId: loan.created_by, chamaLookup });
}

export async function confirmManualDisbursement({ chama, loanId, userId, disbursementMethod, externalReference }) {
  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chama._id, status: LOAN_STATUS.DISBURSEMENT_PENDING });
  if (!loan) throw new AppError('Loan is not awaiting disbursement confirmation', 400);

  loan.disbursement.provider = disbursementMethod || loan.disbursement_method;
  loan.disbursement.provider_reference = externalReference || loan.disbursement.provider_reference;
  return markDisbursed({ loan, userId, chama });
}

async function markDisbursed({ loan, userId, chama, chamaLookup }) {
  const resolvedChama = chama || (chamaLookup ? await chamaLookup(loan.chama_id) : { _id: loan.chama_id });

  loan.status = LOAN_STATUS.ACTIVE;
  loan.disbursement.status = 'successful';
  loan.disbursement.disbursed_at = new Date();
  loan.balances.principal_outstanding = loan.amount;
  loan.balances.interest_outstanding = loan.interest_amount;

  await loanAccounting.postDisbursement({ chama: resolvedChama, loan, userId });
  await loan.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: loan.chama_id,
    action: AUDIT_ACTIONS.LOAN_DISBURSED,
    resourceType: 'ChamaLoan',
    resourceId: loan._id,
    after: { amount: loan.amount, reference: loan.reference },
  }).catch(() => null);

  return loan;
}

export default { initiateDisbursement, confirmMpesaDisbursement, confirmManualDisbursement };