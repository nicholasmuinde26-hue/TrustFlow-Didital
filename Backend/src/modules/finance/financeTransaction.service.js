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

import FinancialTransaction from "../../models/FinancialTransaction.js";

import {
    TRANSACTION_STATUS
} from "./accounting/accounting.constants.js";

import {
    toDecimal
} from "../../shared/decimal.js";

class FinanceTransactionService {

    /**
     * ------------------------------------------------------------
     * CREATE
     * ------------------------------------------------------------
     */

    async create(context, session = null) {

        const transactionType =
            (context.transactionType || context.referenceType || '')
            .toString()
            .toLowerCase();

        const sourceType =
            context.source_type ||
            context.referenceType ||
            'accounting_event';

        const sourceId =
            context.source_id ||
            context.referenceId ||
            context.reference_id;

        if (!sourceId) {
            throw new Error(
                'Transaction source id is required.'
            );
        }

        const transaction = await FinancialTransaction.create([{

            owner_type:
                context.owner_type,

            owner_id:
                context.owner_id,

            transaction_type:
                transactionType,

            amount:
                toDecimal(context.amount).toFixed(),

            currency:
                context.currency || 'KES',

            source_type:
                sourceType,

            source_id:
                sourceId,

            external_reference:
                context.externalReference || context.external_reference,

            reference:
                context.reference,

            status:
                TRANSACTION_STATUS.PENDING,

            description:
                context.description || context.narration || null,

            created_by:
                context.created_by,

            posted_by:
                context.posted_by || null,

            reversed_transaction_id:
                context.reversed_transaction_id || null,

            reversal_reason:
                context.reversal_reason || null

        }], { session });

        return transaction[0];

    }

    /**
     * ------------------------------------------------------------
     * MARK COMPLETED
     * ------------------------------------------------------------
     */

    async markCompleted(id, session = null) {

        return FinancialTransaction.findByIdAndUpdate(

            id,

            {

                status: TRANSACTION_STATUS.COMPLETED,

                completedAt: new Date()

            },

            {

                new: true,

                session

            }

        );

    }

    /**
     * ------------------------------------------------------------
     * MARK FAILED
     * ------------------------------------------------------------
     */

    async markFailed(id, reason, session = null) {

        return FinancialTransaction.findByIdAndUpdate(

            id,

            {

                status: TRANSACTION_STATUS.FAILED,

                failureReason: reason

            },

            {

                new: true,

                session

            }

        );

    }

    /**
     * ------------------------------------------------------------
     * FIND
     * ------------------------------------------------------------
     */

    async findById(id) {

        return FinancialTransaction.findById(id);

    }

    /**
     * ------------------------------------------------------------
     * CORRELATION
     * ------------------------------------------------------------
     */

    async findByCorrelationId(correlationId) {

        return FinancialTransaction.findOne({

            correlationId

        });

    }

    /**
     * ------------------------------------------------------------
     * PROVIDER REFERENCE
     * ------------------------------------------------------------
     */

    async findByProviderReference(reference) {

        return FinancialTransaction.findOne({

            providerReference: reference

        });

    }

}

export default new FinanceTransactionService();