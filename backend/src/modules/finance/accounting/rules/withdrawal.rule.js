/**
 * ============================================================================
 * WITHDRAWAL ACCOUNTING RULE
 * ============================================================================
 *
 * Converts member-withdrawal business events into accounting instructions.
 * Mirrors payout.rule.js exactly — a withdrawal is the same shape of event
 * as a payout (chama owes a member money, then pays it), just sourced from
 * the member's SAVINGS balance instead of the rotational contribution pool.
 *
 * Supported events:
 *
 * WITHDRAWAL_OBLIGATION   (posted when a withdrawal request is APPROVED)
 *
 *      DR MEMBER_SAVINGS       (the member's savings liability shrinks)
 *      CR WITHDRAWAL_CLEARING  (chama now owes this cash out)
 *
 *
 * WITHDRAWAL_SETTLEMENT   (posted when the treasurer disburses)
 *
 *      DR WITHDRAWAL_CLEARING
 *      CR CASH/BANK/MPESA
 *
 *
 * WITHDRAWAL_CANCELLATION (posted if an approved-but-unpaid withdrawal is
 *                          cancelled — reverses the obligation)
 *
 *      DR WITHDRAWAL_CLEARING
 *      CR MEMBER_SAVINGS
 *
 *
 * DOES NOT:
 *
 * ✗ Query FinancialAccount
 * ✗ Modify balances
 * ✗ Create journals
 *
 * ============================================================================
 */

import {
    ACCOUNT_CODES,
    ENTRY_TYPES
} from "../accounting.constants.js";

class WithdrawalRule {

    /**
     * =========================================================================
     * BUILD ACCOUNTING POSTING
     * =========================================================================
     */

    async build(context) {

        switch (context.referenceType) {

            case "WITHDRAWAL_OBLIGATION":
                return this.buildObligation(context);

            case "WITHDRAWAL_SETTLEMENT":
                return this.buildSettlement(context);

            case "WITHDRAWAL_CANCELLATION":
                return this.buildCancellation(context);

            default:
                throw new Error(`Unsupported withdrawal event ${context.referenceType}`);
        }
    }

    /**
     * =========================================================================
     * WITHDRAWAL RECOGNITION
     * =========================================================================
     *
     * The member's request has been approved. Chama now owes the member
     * cash out of the WITHDRAWAL_CLEARING liability instead of the general
     * MEMBER_SAVINGS pool.
     *
     * DR Member Savings
     * CR Withdrawal Clearing
     *
     * =========================================================================
     */

    buildObligation(context) {
        return {
            transactionType: "WITHDRAWAL_OBLIGATION",
            description: context.description || "Withdrawal obligation created",
            chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
            member: context.member || context.memberId || context.created_by,
            amount: context.amount,
            currency: context.currency || "KES",
            entries: [
                {
                    accountCode: ACCOUNT_CODES.MEMBER_SAVINGS,
                    entryType: ENTRY_TYPES.DEBIT,
                    amount: context.amount
                },
                {
                    accountCode: ACCOUNT_CODES.WITHDRAWAL_CLEARING,
                    entryType: ENTRY_TYPES.CREDIT,
                    amount: context.amount
                }
            ]
        };
    }

    /**
     * =========================================================================
     * WITHDRAWAL SETTLEMENT
     * =========================================================================
     *
     * Treasurer confirms the money was actually disbursed.
     *
     * DR Withdrawal Clearing
     * CR Cash/Bank/Mpesa
     *
     * =========================================================================
     */

    buildSettlement(context) {
        const assetAccount = this.resolveDisbursementAccount(
            context.disbursement_method || context.metadata?.disbursement_method
        );

        return {
            transactionType: "WITHDRAWAL_SETTLEMENT",
            description: context.description || "Withdrawal settlement",
            chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
            member: context.member || context.memberId || context.created_by,
            amount: context.amount,
            currency: context.currency || "KES",
            entries: [
                {
                    accountCode: ACCOUNT_CODES.WITHDRAWAL_CLEARING,
                    entryType: ENTRY_TYPES.DEBIT,
                    amount: context.amount
                },
                {
                    accountCode: assetAccount,
                    entryType: ENTRY_TYPES.CREDIT,
                    amount: context.amount
                }
            ]
        };
    }

    /**
     * =========================================================================
     * WITHDRAWAL CANCELLATION
     * =========================================================================
     *
     * Reverse an obligation that was approved but never disbursed.
     *
     * DR Withdrawal Clearing
     * CR Member Savings
     *
     * =========================================================================
     */

    buildCancellation(context) {
        return {
            transactionType: "WITHDRAWAL_CANCELLATION",
            description: context.description || "Withdrawal cancelled",
            chama: context.chama || context.owner_id || context.ownerId || context.chamaId,
            member: context.member || context.memberId || context.created_by,
            amount: context.amount,
            currency: context.currency || "KES",
            entries: [
                {
                    accountCode: ACCOUNT_CODES.WITHDRAWAL_CLEARING,
                    entryType: ENTRY_TYPES.DEBIT,
                    amount: context.amount
                },
                {
                    accountCode: ACCOUNT_CODES.MEMBER_SAVINGS,
                    entryType: ENTRY_TYPES.CREDIT,
                    amount: context.amount
                }
            ]
        };
    }

    /**
     * =========================================================================
     * DISBURSEMENT METHOD → ACCOUNT CODE
     * =========================================================================
     */

    resolveDisbursementAccount(method) {
        const accounts = {
            cash: ACCOUNT_CODES.CASH,
            bank: ACCOUNT_CODES.BANK,
            mpesa: ACCOUNT_CODES.MPESA_CLEARING,
            wallet: ACCOUNT_CODES.MPESA_CLEARING
        };

        const account = accounts[method];

        if (!account) {
            throw new Error(`Unsupported withdrawal disbursement method ${method}`);
        }

        return account;
    }
}

export default new WithdrawalRule();
