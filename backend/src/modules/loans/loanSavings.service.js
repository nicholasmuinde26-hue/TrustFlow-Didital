import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import { OPEN_LOAN_STATUSES, GUARANTOR_STATUS } from './Loan.constants.js';

const number = (value) => Number(value?.toString?.() ?? value ?? 0);
export async function getMemberSavings(chamaId, membershipId) {
  const rows = await ContributionPayment.aggregate([{ $match: { owner_type: 'Chama', owner_id: chamaId, participant_type: 'ChamaMembership', participant_id: membershipId, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  return number(rows[0]?.total);
}
export async function getExistingOutstanding(chamaId, membershipId) {
  const loans = await ChamaLoan.find({ chama_id: chamaId, membership_id: membershipId, status: { $in: OPEN_LOAN_STATUSES } }).select('balances');
  return loans.reduce((total, loan) => total + number(loan.balances?.principal_outstanding) + number(loan.balances?.interest_outstanding) + number(loan.balances?.penalty_outstanding), 0);
}
export async function getGuaranteeExposure(chamaId, membershipId, { excludeLoanId } = {}) {
  const match = { chama_id: chamaId, status: { $in: OPEN_LOAN_STATUSES }, guarantors: { $elemMatch: { membership_id: membershipId, status: GUARANTOR_STATUS.ACCEPTED } } }; if (excludeLoanId) match._id = { $ne: excludeLoanId };
  const loans = await ChamaLoan.find(match).select('guarantors');
  return loans.reduce((total, loan) => { const guarantee = loan.guarantors.find((g) => String(g.membership_id) === String(membershipId) && g.status === GUARANTOR_STATUS.ACCEPTED); return total + Math.max(0, number(guarantee?.guaranteed_amount) - number(guarantee?.recovered_amount)); }, 0);
}
export default { getMemberSavings, getExistingOutstanding, getGuaranteeExposure };
