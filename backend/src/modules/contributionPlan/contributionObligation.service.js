/**
 * ============================================================================
 * CONTRIBUTION OBLIGATION SERVICE
 * ============================================================================
 */

import mongoose from "mongoose";
import ContributionObligation from "../../models/ContributionObligation.js";
import { toDecimal, addMoney } from "../../shared/decimal.js"; // use decimal helpers

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class ContributionObligationService {

    async create(data, session = null) {
        const opts = getOpts(session);
        const [obligation] = await ContributionObligation.create([data], opts);
        return obligation;
    }

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
     * NEW: Called by Payment Engine after successful payment
     * Increments paid_amount and closes obligation if fully paid
     */
    async markPaid(obligationId, amountPaid, session = null) {
        const opts = getOpts(session);

        const obligation = await this.findById(obligationId, session);
        if (!obligation) throw new Error("Contribution obligation not found.");

        const currentPaid = toDecimal(obligation.paid_amount);
        const newPaid = addMoney(currentPaid, toDecimal(amountPaid)); // Decimal safe add
        const expected = toDecimal(obligation.expected_amount);

        const status = newPaid.greaterThanOrEqualTo(expected)? "paid" : "partially_paid";

        obligation.paid_amount = newPaid;
        obligation.status = status;
        if (status === 'paid') obligation.paid_at = new Date();

        await obligation.save(opts);
        return obligation;
    }

    /**
     * LEGACY: For manual admin adjustments
     */
    async recordPayment(obligationId, amount, session = null) {
        return this.markPaid(obligationId, amount, session); // just alias it
    }

    calculateOutstanding(obligation) {
        const expected = toDecimal(obligation.expected_amount || 0);
        const paid = toDecimal(obligation.paid_amount || 0);
        return expected.minus(paid).max(0).toString();
    }

    async markOverdue(obligationId, session = null) {
        const opts = getOpts(session);
        return ContributionObligation.findByIdAndUpdate(
            obligationId,
            { status: "overdue" },
            {...opts, new: true }
        );
    }

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