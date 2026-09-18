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

    /**
     * Period-by-period totals for a Chama/ContributionGroup — expected vs
     * paid per contribution period, oldest first. Feeds the forecasting
     * engine (ai/forecast.engine.js). Read-only aggregate over existing
     * obligation data; no new fields or writes required.
     */
    async getPeriodHistory(ownerType, ownerId, limit = 6, session = null) {
        const opts = getOpts(session);
        const rows = await ContributionObligation.aggregate([
            {
                $match: {
                    owner_type: ownerType,
                    owner_id: new mongoose.Types.ObjectId(ownerId),
                    period_start: { $type: "date" },
                },
            },
            {
                $group: {
                    _id: "$period_start",
                    periodStart: { $first: "$period_start" },
                    periodEnd: { $first: "$period_end" },
                    expected: { $sum: { $toDouble: "$expected_amount" } },
                    paid: { $sum: { $toDouble: "$paid_amount" } },
                },
            },
            { $sort: { periodStart: -1 } },
            { $limit: limit },
        ], opts);

        // oldest -> newest, the order the forecast engine expects
        return rows
            .sort((a, b) => new Date(a.periodStart) - new Date(b.periodStart))
            .map((r) => ({
                periodStart: r.periodStart,
                periodEnd: r.periodEnd,
                expected: r.expected,
                paid: r.paid,
            }));
    }
}

export default new ContributionObligationService();