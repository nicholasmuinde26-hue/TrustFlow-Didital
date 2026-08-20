/**
 * ============================================================================
 * ACCOUNTING CONSTANTS
 * ============================================================================
 *
 * Shared vocabulary for the Finance Engine.
 *
 * Used by:
 *
 * ✓ Accounting Service
 * ✓ Journal Service
 * ✓ Ledger Service
 * ✓ Finance Account Service
 * ✓ Validators
 * ✓ Payment Engine
 * ✓ Contribution Engine
 * ✓ Payout Engine
 *
 * ============================================================================
 */


/**
 * ============================================================================
 * TRANSACTION TYPES
 * ============================================================================
 */

export const TRANSACTION_TYPES = Object.freeze({

    CONTRIBUTION_PAYMENT:
        "contribution_payment",


    CONTRIBUTION_REVERSAL:
        "contribution_reversal",


    PAYOUT_OBLIGATION:
        "payout_obligation",


    PAYOUT_SETTLEMENT:
        "payout_settlement",


    PAYOUT_CANCELLATION:
        "payout_cancellation",


    LOAN_DISBURSEMENT:
        "loan_disbursement",


    LOAN_REPAYMENT:
        "loan_repayment",


    EXPENSE_PAYMENT:
        "expense_payment",


    ADJUSTMENT:
        "adjustment"

});





/**
 * ============================================================================
 * ACCOUNT TYPES
 * ============================================================================
 */

export const ACCOUNT_TYPES = Object.freeze({

    ASSET:
        "asset",


    LIABILITY:
        "liability",


    EQUITY:
        "equity",


    REVENUE:
        "revenue",


    EXPENSE:
        "expense"

});





/**
 * ============================================================================
 * ACCOUNT NORMAL BALANCE
 * ============================================================================
 *
 * Asset + Expense  => Debit increases
 *
 * Liability +
 * Equity +
 * Revenue          => Credit increases
 *
 * ============================================================================
 */

export const ACCOUNT_NORMAL_BALANCE = Object.freeze({

    DEBIT:
        "debit",


    CREDIT:
        "credit"

});





/**
 * ============================================================================
 * LEDGER ENTRY TYPES
 * ============================================================================
 */

export const ENTRY_TYPES = Object.freeze({

    DEBIT:
        "debit",


    CREDIT:
        "credit"

});





/**
 * ============================================================================
 * POSTING STATUS
 * ============================================================================
 */

export const POSTING_STATUS = Object.freeze({

    PENDING:
        "pending",


    POSTED:
        "posted",


    REVERSED:
        "reversed",


    FAILED:
        "failed"

});





/**
 * ============================================================================
 * PAYMENT PROVIDERS
 * ============================================================================
 *
 * Used by payment validation
 * and payment accounting rules.
 *
 * ============================================================================
 */

export const PAYMENT_PROVIDERS = Object.freeze({

    MPESA:
        "mpesa",


    BANK:
        "bank",


    CASH:
        "cash",


    WALLET:
        "wallet",


    MANUAL:
        "manual",


    AIRTEL:
        "airtel",


    STRIPE:
        "stripe"

});





/**
 * ============================================================================
 * PAYMENT METHODS
 * ============================================================================
 */

export const PAYMENT_METHODS = Object.freeze({

    MPESA:
        "mpesa",


    BANK:
        "bank",


    CASH:
        "cash"

});





/**
 * ============================================================================
 * ACCOUNT CODES
 * ============================================================================
 */

export const ACCOUNT_CODES = Object.freeze({

    CASH:
        "CASH",


    BANK:
        "BANK",


    MPESA:
        "MPESA",


    MPESA_CLEARING:
        "MPESA_CLEARING",


    WALLET:
        "WALLET",


    MEMBER_CONTRIBUTIONS:
        "MEMBER_CONTRIBUTIONS",


    CONTRIBUTION_INCOME:
        "CONTRIBUTION_INCOME",


    CONTRIBUTION_RECEIVABLE:
        "CONTRIBUTION_RECEIVABLE",


    PAYOUT_CLEARING:
        "PAYOUT_CLEARING",


    PAYOUT_PAYABLE:
        "PAYOUT_PAYABLE",


    LOAN_RECEIVABLE:
        "LOAN_RECEIVABLE",


    LOAN_PAYABLE:
        "LOAN_PAYABLE",


    PENALTY_INCOME:
        "PENALTY_INCOME",


    INTEREST_INCOME:
        "INTEREST_INCOME",


    MEMBER_SAVINGS:
        "MEMBER_SAVINGS",


    ESCROW_HOLDING:
        "ESCROW_HOLDING",


    ESCROW_SETTLEMENT:
        "ESCROW_SETTLEMENT",


    REFUNDS:
        "REFUNDS",


    RETAINED_EARNINGS:
        "RETAINED_EARNINGS"

});





/**
 * ============================================================================
 * JOURNAL SOURCES
 * ============================================================================
 */

export const JOURNAL_SOURCES = Object.freeze({

    PAYMENT_ENGINE:
        "payment_engine",


    CONTRIBUTION_ENGINE:
        "contribution_engine",


    PAYOUT_ENGINE:
        "payout_engine",


    LOAN_ENGINE:
        "loan_engine",


    ADMIN:
        "admin"

});



export const TRANSACTION_STATUS = Object.freeze({

    PENDING:
        "pending",


    // NOTE: FinancialTransaction.status enum is
    // ['pending','posted','failed','reversed','cancelled'] — there is no
    // 'completed' value. POSTED is the correct "done" status; COMPLETED is
    // kept only so any existing external references to it don't break, but
    // nothing in this codebase should use it going forward.
    POSTED:
        "posted",

    COMPLETED:
        "posted",


    FAILED:
        "failed",


    REVERSED:
        "reversed",


    CANCELLED:
        "cancelled"

});



/**
 * ============================================================================
 * ACCOUNTING EVENTS
 * ============================================================================
 */
export const ACCOUNTING_EVENTS = Object.freeze({

    JOURNAL_CREATED:
        "accounting.journal.created",


    TRANSACTION_POSTED:
        "accounting.transaction.posted",


    LEDGER_CREATED:
        "accounting.ledger.created",


    BALANCE_UPDATED:
        "accounting.balance.updated"

});





/**
 * ============================================================================
 * POSTING DIRECTION
 * ============================================================================
 */

export const POSTING_DIRECTION = Object.freeze({

    INCOMING:
        "incoming",


    OUTGOING:
        "outgoing"

});