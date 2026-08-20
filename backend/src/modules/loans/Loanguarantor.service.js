import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import AppError from '../../utils/AppError.js';
import { getMemberSavings, getGuaranteeExposure } from './loanSavings.service.js';
import { GUARANTOR_STATUS } from './Loan.constants.js';
import { getOrCreatePolicy } from './Loanpolicy.service.js';
import { maybeAutoSubmit } from './Loanapplication.service.js';

/**
 * Validates a proposed guarantor and returns their available guarantee
 * capacity. Throws with the SPECIFIC reason a guarantor can't be used,
 * matching the spec's guarantor engine flow:
 *
 *   active member? -> available savings? -> already guaranteeing others? ->
 *   within guarantee capacity? -> send request
 */
export async function validateGuarantor({ chama, policy, guarantorMembershipId, proposedAmount, borrowerMembershipId }) {
  if (String(guarantorMembershipId) === String(borrowerMembershipId)) {
    throw new AppError('A member cannot guarantee their own loan', 400);
  }

  const guarantor = await ChamaMembership.findOne({ _id: guarantorMembershipId, chama_id: chama._id });
  if (!guarantor || guarantor.status !== 'active') {
    throw new AppError('Proposed guarantor is not an active member of this Chama', 400);
  }

  const savings = await getMemberSavings(chama._id, guarantorMembershipId);
  if (savings <= 0) {
    throw new AppError('Proposed guarantor has no available savings to guarantee with', 400);
  }

  const capacity = savings * Number(policy.guarantor_capacity_ratio || 0);
  const currentExposure = await getGuaranteeExposure(chama._id, guarantorMembershipId);
  const remainingCapacity = capacity - currentExposure;

  if (proposedAmount > remainingCapacity) {
    throw new AppError(
      `Proposed guarantee of KES ${proposedAmount.toLocaleString()} exceeds this guarantor's remaining capacity of KES ${Math.max(remainingCapacity, 0).toLocaleString()}`,
      400
    );
  }

  return { guarantor, savings, capacity, currentExposure, remainingCapacity };
}

/**
 * Selecting a guarantor does NOT make them liable — it only queues a
 * request. Liability begins when they explicitly accept.
 */
export async function requestGuarantors({ chama, policy, loan, guarantors }) {
  const entries = [];
  for (const g of guarantors) {
    await validateGuarantor({
      chama,
      policy,
      guarantorMembershipId: g.membership_id,
      proposedAmount: g.guaranteed_amount,
      borrowerMembershipId: loan.membership_id,
    });
    entries.push({
      membership_id: g.membership_id,
      guaranteed_amount: g.guaranteed_amount,
      status: GUARANTOR_STATUS.PENDING,
      requested_at: new Date(),
      responded_at: null,
    });
  }
  loan.guarantors = entries;
  return loan;
}

export async function respondToGuarantee({ chamaId, loanId, guarantorMembershipId, decision }) {
  if (!['accepted', 'declined'].includes(decision)) {
    throw new AppError('Decision must be accepted or declined', 400);
  }

  const loan = await ChamaLoan.findOne({ _id: loanId, chama_id: chamaId });
  if (!loan) throw new AppError('Loan not found', 404);

  const entry = loan.guarantors.find((g) => String(g.membership_id) === String(guarantorMembershipId));
  if (!entry) throw new AppError('You have not been asked to guarantee this loan', 404);
  if (entry.status !== GUARANTOR_STATUS.PENDING) {
    throw new AppError('This guarantee request has already been responded to', 400);
  }

  entry.status = decision;
  entry.responded_at = new Date();
  if (decision === GUARANTOR_STATUS.ACCEPTED) await maybeAutoSubmit(loan, await getOrCreatePolicy(chamaId));
  await loan.save();
  return loan;
}

export function allGuaranteesAccepted(loan) {
  if (!loan.guarantors?.length) return true;
  return loan.guarantors.every((g) => g.status === GUARANTOR_STATUS.ACCEPTED);
}

export function anyGuaranteeDeclined(loan) {
  return (loan.guarantors || []).some((g) => g.status === GUARANTOR_STATUS.DECLINED);
}

export default { validateGuarantor, requestGuarantors, respondToGuarantee, allGuaranteesAccepted, anyGuaranteeDeclined };
