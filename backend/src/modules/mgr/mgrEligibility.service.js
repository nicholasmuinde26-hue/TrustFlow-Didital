import ChamaLoan from '../../models/ChamaLoan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ChamaMembership from '../../models/ChamaMembership.js';

class MgrEligibilityService {
  /**
   * Evaluate member eligibility for an MGR Payout against the active policy.
   */
  async evaluateEligibility({ round, policy, memberId }) {
    const reasons = [];
    let passed = true;

    const membership = await ChamaMembership.findById(memberId);
    if (!membership) {
      return { passed: false, reasons: ['Member does not exist in Chama'] };
    }

    // Rule 1: Active membership check
    if (policy.eligibility_rule?.require_active_membership) {
      if (membership.status !== 'active') {
        passed = false;
        reasons.push(`Membership status is '${membership.status}', required 'active'`);
      }
    }

    // Rule 2: Active participant check (must be listed in policy participants)
    const isParticipant = policy.participants.some(
      (p) => String(p) === String(memberId) || String(p._id) === String(memberId)
    );
    if (!isParticipant) {
      passed = false;
      reasons.push('Member is not an active participant in this MGR Policy');
    }

    // Rule 3: Full contribution payment check
    if (policy.eligibility_rule?.require_full_contributions && round.contribution_plan_id) {
      const unpaidObligations = await ContributionObligation.find({
        plan_id: round.contribution_plan_id,
        participant_id: memberId,
        status: { $in: ['pending', 'partially_paid', 'overdue'] },
      });

      if (unpaidObligations.length > 0) {
        passed = false;
        reasons.push(`Member has ${unpaidObligations.length} unpaid MGR contribution obligation(s)`);
      }
    }

    // Rule 4: Overdue chama loan check
    if (policy.eligibility_rule?.check_overdue_loans) {
      const overdueLoans = await ChamaLoan.find({
        member_id: memberId,
        status: 'overdue',
      });

      if (overdueLoans.length > 0) {
        passed = false;
        reasons.push(`Member has ${overdueLoans.length} overdue Chama loan(s)`);
      }
    }

    // Rules 5 & 6: outstanding penalties / minimum savings.
    // NOTE: no Penalty or Savings model exists yet in this codebase to
    // check against. Rather than silently treating these toggles as
    // no-ops (which would let an official believe a check is enforced
    // when it isn't), fail closed with an explicit reason so this is
    // visible instead of a false pass.
    if (policy.eligibility_rule?.check_outstanding_penalties) {
      passed = false;
      reasons.push('Outstanding-penalties check is enabled but not yet implemented - resolve manually or disable this rule');
    }
    if (policy.eligibility_rule?.check_minimum_savings) {
      passed = false;
      reasons.push('Minimum-savings check is enabled but not yet implemented - resolve manually or disable this rule');
    }

    // Update round's eligibility result snapshot
    round.eligibility_result = {
      passed,
      evaluated_at: new Date(),
      reasons,
      override_by: round.eligibility_result?.override_by || null,
      override_reason: round.eligibility_result?.override_reason || null,
    };

    await round.save();

    return {
      passed: round.eligibility_result.override_by ? true : passed,
      overridden: !!round.eligibility_result.override_by,
      reasons,
    };
  }
}

export default new MgrEligibilityService();