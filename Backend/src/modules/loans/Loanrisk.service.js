import ChamaLoan from '../../models/ChamaLoan.js';
import { getGuaranteeExposure } from './loanSavings.service.js';

/**
 * Produces an advisory risk score for officials reviewing a loan.
 * This NEVER decides anything on its own — the official always makes
 * the final call. See spec section 22 ("AI should assist officials,
 * not make irreversible financial decisions automatically").
 */
export async function assessRisk({ chama, membership, loan, membershipMonths }) {
  const pastLoans = await ChamaLoan.find({
    chama_id: chama._id,
    membership_id: membership._id,
    status: { $in: ['closed', 'defaulted', 'recovered'] },
    _id: { $ne: loan._id },
  }).select('status closure default_info');

  const closedCleanly = pastLoans.filter((l) => l.status === 'closed').length;
  const defaulted = pastLoans.filter((l) => ['defaulted', 'recovered'].includes(l.status)).length;
  const repaymentHistoryRate = pastLoans.length ? closedCleanly / pastLoans.length : null;

  const guaranteeExposure = await getGuaranteeExposure(chama._id, membership._id, { excludeLoanId: loan._id });

  let score = 500;
  const positiveFactors = [];
  const riskFactors = [];

  if (membershipMonths >= 12) {
    score += 150;
    positiveFactors.push(`${membershipMonths} months of membership`);
  } else if (membershipMonths >= 6) {
    score += 75;
    positiveFactors.push(`${membershipMonths} months of membership`);
  }

  if (repaymentHistoryRate === 1) {
    score += 200;
    positiveFactors.push('100% repayment history on past loans');
  } else if (repaymentHistoryRate !== null && repaymentHistoryRate >= 0.5) {
    score += 80;
    positiveFactors.push('Majority of past loans repaid cleanly');
  }

  if (defaulted > 0) {
    score -= 250 * defaulted;
    riskFactors.push(`${defaulted} previous default${defaulted > 1 ? 's' : ''}`);
  } else if (pastLoans.length === 0) {
    riskFactors.push('No prior loan history with this Chama');
  }

  if (guaranteeExposure > 0) {
    riskFactors.push('High existing guarantee exposure');
    score -= Math.min(100, Math.round(guaranteeExposure / 1000));
  } else {
    score += 20;
    positiveFactors.push('Stable contributions, no outstanding guarantee exposure');
  }

  score = Math.max(0, Math.min(1000, score));

  const level = score >= 700 ? 'low' : score >= 450 ? 'medium' : 'high';

  return {
    score,
    level,
    positive_factors: positiveFactors,
    risk_factors: riskFactors,
    assessed_at: new Date(),
  };
}

export default { assessRisk };