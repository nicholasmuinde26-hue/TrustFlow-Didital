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

import mongoose from "mongoose"; // ADD
import FinancialTransaction from "../../models/FinancialTransaction.js";
import { TRANSACTION_STATUS } from "./accounting/accounting.constants.js";
import { toDecimal } from "../../shared/decimal.js";

// Helper: detect if mongo supports transactions
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// Helper: only add session to opts if transactions are supported
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class FinanceTransactionService {

    /**
     * ------------------------------------------------------------
     * CREATE
     * ------------------------------------------------------------
     */
    async create(context, session = null) {
        const opts = getOpts(session); // <-- KEY

        const transactionType = (context.transactionType || context.referenceType || '').toString().toLowerCase();
        const sourceType = context.source_type || context.referenceType || 'accounting_event';
        const sourceId = context.source_id || context.referenceId || context.reference_id;

        if (!sourceId) {
            throw new Error('Transaction source id is required.');
        }

        const [transaction] = await FinancialTransaction.create([{
            owner_type: context.owner_type,
            owner_id: context.owner_id,
            transaction_type: transactionType,
            amount: toDecimal(context.amount).toFixed(),
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
        }], opts); // <-- use opts

        return transaction;
    }

    /**
     * ------------------------------------------------------------
     * MARK COMPLETED
     * ------------------------------------------------------------
     */
    async markCompleted(id, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findByIdAndUpdate(
            id,
            { status: TRANSACTION_STATUS.COMPLETED, completedAt: new Date() },
            {...opts, new: true } // merge opts with new:true
        );
    }

    /**
     * ------------------------------------------------------------
     * MARK FAILED
     * ------------------------------------------------------------
     */
    async markFailed(id, reason, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findByIdAndUpdate(
            id,
            { status: TRANSACTION_STATUS.FAILED, failureReason: reason },
            {...opts, new: true }
        );
    }

    /**
     * ------------------------------------------------------------
     * FIND
     * ------------------------------------------------------------
     */
    async findById(id, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findById(id, null, opts);
    }

    /**
     * ------------------------------------------------------------
     * CORRELATION
     * ------------------------------------------------------------
     */
    async findByCorrelationId(correlationId, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findOne({ correlationId }, null, opts);
    }

    /**
     * ------------------------------------------------------------
     * PROVIDER REFERENCE
     * ------------------------------------------------------------
     */
    async findByProviderReference(reference, session = null) {
        const opts = getOpts(session);
        return FinancialTransaction.findOne({ providerReference: reference }, null, opts);
    }
}

export default new FinanceTransactionService();