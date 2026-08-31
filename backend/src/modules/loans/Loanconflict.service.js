import ChamaMembership from '../../models/ChamaMembership.js';
import { resolveApprovalRoles } from './Loanpolicy.service.js';
import { LOAN_OFFICIAL_ROLES } from './Loan.constants.js';

/**
 * Conflict-of-Interest routing — spec section 5:
 *
 *   "The applicant can never approve or disburse their own loan.
 *    So the system dynamically changes the approval path."
 *
 * Given the base approval matrix for this loan amount, this recuses any
 * required role the applicant themself holds, and works out whether the
 * remaining independent officials in the Chama can form a replacement
 * quorum. If they can't, the application must be blocked rather than let
 * someone bypass governance by approving their own loan under a
 * technicality (spec: "ChamaManager should stop the process rather than
 * allowing someone to bypass the governance rule").
 */
export async function resolveApprovalPlan({ chama, membership, policy, amount }) {
  const baseRoles = resolveApprovalRoles(policy, amount);
  const applicantRole = membership.role;

  const recusedRoles = baseRoles.filter((role) => role === applicantRole);
  const requiredRoles = baseRoles.filter((role) => role !== applicantRole);
  const conflict = recusedRoles.length > 0;

  if (!conflict) {
    return {
      requiredRoles,
      recusedRoles: [],
      conflict: false,
      quorumRequired: 0,
      quorumFeasible: true,
      availableOfficialsCount: null,
      blockReason: null,
    };
  }

  const quorumRequired = Math.max(1, Number(policy.recusal_quorum_size || 2));

  // Independent officials = active members holding any governance role,
  // other than the applicant themself. They cover both the still-required
  // role seats and the quorum standing in for the recused seat(s).
  const availableOfficialsCount = await ChamaMembership.countDocuments({
    chama_id: chama._id,
    _id: { $ne: membership._id },
    status: 'active',
    role: { $in: LOAN_OFFICIAL_ROLES },
  });

  const neededOfficials = requiredRoles.length + quorumRequired;
  const quorumFeasible = availableOfficialsCount >= neededOfficials;

  return {
    requiredRoles,
    recusedRoles,
    conflict: true,
    quorumRequired,
    quorumFeasible,
    availableOfficialsCount,
    blockReason: quorumFeasible
      ? null
      : `You hold the ${recusedRoles.join(', ')} role, so you are automatically recused from approving your own loan. ` +
        `This Chama needs ${neededOfficials} other independent official(s) (${quorumRequired} to form a replacement quorum` +
        `${requiredRoles.length ? ` plus ${requiredRoles.join(', ')}` : ''}), but only ${availableOfficialsCount} are currently available. ` +
        `The application cannot proceed until enough independent officials are available.`,
  };
}

export default { resolveApprovalPlan };
