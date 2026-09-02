import MgrRound from '../../models/MgrRound.js';
import MgrAuditLog from '../../models/MgrAuditLog.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import Payout from '../../models/Payout.js';

class MgrReconciliationService {
  /**
   * Reconciles a completed/paid MGR round before closing it and opening the next round.
   */
  async reconcileRound({ roundId, actorUserId }) {
    const round = await MgrRound.findById(roundId).populate('policy_id');
    if (!round) throw new Error('MGR round not found');

    if (round.status !== 'paid' && round.status !== 'disbursing') {
      throw new Error(`Round status must be 'paid' to perform reconciliation, currently '${round.status}'`);
    }

    const expectedPool = Number(round.expected_amount);
    const collected = Number(round.collected_amount);

    // Verify obligations
    let obligationsPaid = 0;
    if (round.contribution_plan_id) {
      const obligations = await ContributionObligation.find({
        contribution_plan_id: round.contribution_plan_id,
      });

      const totalPaid = obligations.reduce((acc, ob) => acc + Number(ob.amount_paid || 0), 0);
      obligationsPaid = totalPaid;
    }

    // Verify payout settlement
    let payoutStatus = 'paid';
    if (round.payout_id) {
      const payout = await Payout.findById(round.payout_id);
      if (payout) payoutStatus = payout.status;
    }

    const isMatch = Math.abs(collected - obligationsPaid) < 0.01 && (payoutStatus === 'paid' || payoutStatus === 'approved');

    round.reconciled_at = new Date();
    if (isMatch) {
      round.status = 'reconciled';
      round.completed_at = new Date();
    } else {
      // Don't close the round or let the cycle advance on a mismatch -
      // hold it for a treasurer/chair to investigate.
      round.status = 'on_hold';
    }
    await round.save();

    await MgrAuditLog.create({
      chama_id: round.chama_id,
      policy_id: round.policy_id._id,
      round_id: round._id,
      actor_id: actorUserId,
      event_type: isMatch ? 'ROUND_RECONCILED' : 'ROUND_RECONCILIATION_MISMATCH',
      summary: isMatch
        ? `Round #${round.round_number} successfully reconciled`
        : `Round #${round.round_number} reconciliation MISMATCH - held for review`,
      details: {
        expectedPool,
        collectedAmount: collected,
        obligationsPaid,
        payoutStatus,
        isMatch,
      },
    });

    return {
      success: isMatch,
      round,
      reconciliation: {
        expectedPool,
        collected,
        obligationsPaid,
        payoutStatus,
        isMatch,
      },
    };
  }
}

export default new MgrReconciliationService();