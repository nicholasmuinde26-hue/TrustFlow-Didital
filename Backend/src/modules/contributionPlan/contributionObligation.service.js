/**
 * ============================================================================
 * CONTRIBUTION OBLIGATION SERVICE
 * ============================================================================
 *
 * Manages contribution obligations.
 *
 * Responsibilities
 * ----------------
 * ✓ Create obligations
 * ✓ Track expected contributions
 * ✓ Track paid amounts
 * ✓ Calculate outstanding balances
 * ✓ Update obligation status
 *
 * DOES NOT
 * --------
 * ✗ Handle payments
 * ✗ Create accounting entries
 * ✗ Update financial accounts
 * ✗ Know debit/credit rules
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import ContributionObligation from "../../models/ContributionObligation.js";

// Helper: detect if mongo supports transactions
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// Helper: only add session to opts if transactions are supported
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class ContributionObligationService {

    /**
     * ============================================================
     * CREATE OBLIGATION
     * ============================================================
     */
    async create(data, session = null) {
        const opts = getOpts(session);
        const [obligation] = await ContributionObligation.create([data], opts);
        return obligation;
    }

    /**
     * ============================================================
     * FIND OBLIGATION
     * ============================================================
     */
    async findById(id, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.findById(id, null, opts);
    }

    async findByPlan(planId, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.find({ plan_id: planId }, null, opts);
    }

    async findByParticipant(participantId, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.find({ participant_id: participantId }, null, opts);
    }

    /**
     * ============================================================
     * RECORD PAYMENT EFFECT
     * ============================================================
     *
     * Important:
     *
     * This DOES NOT process money.
     *
     * Money was already handled by:
     *
     * Accounting Engine
     *
     * This only updates business state.
     *
     */
    async recordPayment(obligationId, amount, session = null) {
        const opts = getOpts(session);

        const obligation = await this.findById(obligationId, session);
        if (!obligation) {
            throw new Error("Contribution obligation not found.");
        }

        const paidAmount = Number(obligation.paid_amount?.toString() || 0) + Number(amount);
        obligation.paid_amount = paidAmount;

        obligation.status = paidAmount >= Number(obligation.expected_amount?.toString() || 0)
        ? "paid"
         : "partially_paid";

        await obligation.save(opts); // <-- FIX: use opts, not {session}

        return obligation;
    }

    /**
     * ============================================================
     * GET OUTSTANDING BALANCE
     * ============================================================
     */
    calculateOutstanding(obligation) {
        return Math.max(
            Number(obligation.expected_amount || 0) - Number(obligation.paid_amount || 0),
            0
        );
    }

    /**
     * ============================================================
     * MARK AS OVERDUE
     * ============================================================
     */
    async markOverdue(obligationId, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.findByIdAndUpdate(
            obligationId,
            { status: "overdue" },
            {...opts, new: true } // merge opts with new:true
        );
    }

    /**
     * ============================================================
     * BULK UPDATE STATUS
     * ============================================================
     */
    async bulkUpdateStatus(ids, status, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.updateMany(
            { _id: { $in: ids } },
            { $set: { status } },
            opts
        );
    }
}

export default new ContributionObligationService();