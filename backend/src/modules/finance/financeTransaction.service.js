/**
 * ============================================================================
 * FINANCIAL TRANSACTION SERVICE
 * ============================================================================
 *
 * Immutable recorder of financial events.
 *
 * This service records WHAT happened.
 * It does NOT decide HOW accounting should happen.
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import { TRANSACTION_STATUS } from "./accounting/accounting.constants.js";
import { toDecimal } from "../../shared/decimal.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// FIX: was missing :
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class FinanceTransactionService {

    async create(context, session = null) {
        const opts = getOpts(session);

        const transactionType = (context.transactionType || context.referenceType || '').toString().toLowerCase();
        const sourceType = context.source_type || context.referenceType || 'accounting_event';
        const sourceId = context.source_id || context.referenceId || context.reference_id;

        if (!sourceId) {
            throw new Error('Transaction source id is required.');
        }

        const amount = toDecimal(context.amount); // FIX: keep as Decimal128

        const [transaction] = await FinancialTransaction.create([{
            owner_type: context.owner_type,
            owner_id: context.owner_id,
            transaction_type: transactionType,
            amount: amount, // FIX: pass Decimal128 directly, not.toFixed()
            currency: context.currency || 'KES',
            source_type: sourceType,
            source_id: sourceId,
            external_reference: context.externalReference || context.external_reference,
            reference: context.reference,
            status: TRANSACTION_STATUS.PENDING,
            description: context.description || context.narration || null,
            created_by: context.created_by,
            posted_by: context.posted_by || null,
            reversed_transaction_id: context.reversed_transaction_id || null,
            reversal_reason: context.reversal_reason || null
        }], opts);

        return transaction;
    }

    async markCompleted(id, session = null) {
        const opts = getOpts(session);
        // FIX: the schema's status enum is ['pending','posted','failed','reversed','cancelled'] —
        // there is no 'completed' value. Writing "completed" silently satisfied
        // findByIdAndUpdate (which skips validators by default) but never matched
        // any query filtering on status: "posted", so the finance dashboard's
        // transaction count was always 0. Same for `completed_at`, which isn't a
        // field on this schema (the real field is `posted_at`) and was being
        // silently dropped by strict mode.
        return FinancialTransaction.findByIdAndUpdate(
            id,
            { status: TRANSACTION_STATUS.POSTED, posted_at: new Date() },
            { ...opts, returnDocument: "after", runValidators: true }
        );
    }

    async markFailed(id, reason, session = null) {
        const opts = getOpts(session);
        // FIX: `failure_reason` isn't a field on this schema either — it was being
        // silently dropped. Fold the reason into `description` instead so it's
        // actually persisted and visible on the transaction record.
        const transaction = await FinancialTransaction.findById(id, null, opts);
        if (!transaction) return null;

        transaction.status = TRANSACTION_STATUS.FAILED;
        if (reason) {
            transaction.description = transaction.description
                ? `${transaction.description} | Failed: ${reason}`
                : `Failed: ${reason}`;
        }

        return transaction.save(opts);
    }

    async findById(id, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findById(id, null, opts);
    }

    async findByCorrelationId(correlationId, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findOne({ correlationId }, null, opts);
    }

    async findByProviderReference(reference, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findOne({ providerReference: reference }, null, opts);
    }
}

export default new FinanceTransactionService();