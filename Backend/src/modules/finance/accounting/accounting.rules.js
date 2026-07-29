/**
 * ============================================================================
 * ACCOUNTING RULES
 * ============================================================================
 *
 * Defines how every financial transaction is posted.
 *
 * The Ledger Service reads these rules and generates
 * balanced journal entries.
 *
 * No service should hardcode debit/credit accounts.
 *
 * ============================================================================
 */

import {
    TRANSACTION_TYPES,
    ACCOUNT_CODES,
    ENTRY_TYPES,
    JOURNAL_SOURCES
} from "./accounting.constants.js";

/**
 * ============================================================================
 * ACCOUNTING RULES
 * ============================================================================
 */

export const ACCOUNTING_RULES = Object.freeze({

    /**
     * ============================================================
     * MEMBER CONTRIBUTION
     * ============================================================
     *
     * Debit:
     *      M-Pesa Clearing (Asset ↑)
     *
     * Credit:
     *      Member Contributions (Liability ↑)
     *
     */

    [TRANSACTION_TYPES.CONTRIBUTION]: {

        description: "Member Contribution",

        source: JOURNAL_SOURCES.PAYMENT_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Contribution received"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.MEMBER_CONTRIBUTIONS,

                description: "Contribution liability"

            }

        ]

    },

    /**
     * ============================================================
     * CONTRIBUTION REFUND
     * ============================================================
     */

    [TRANSACTION_TYPES.CONTRIBUTION_REFUND]: {

        description: "Contribution Refund",

        source: JOURNAL_SOURCES.PAYMENT_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.REFUNDS,

                description: "Contribution refund"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Refund paid"

            }

        ]

    },

    /**
     * ============================================================
     * LOAN DISBURSEMENT
     * ============================================================
     */

    [TRANSACTION_TYPES.LOAN_DISBURSEMENT]: {

        description: "Loan Disbursement",

        source: JOURNAL_SOURCES.LOAN_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.LOAN_RECEIVABLE,

                description: "Loan issued"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Funds disbursed"

            }

        ]

    },

    /**
     * ============================================================
     * LOAN REPAYMENT
     * ============================================================
     */

    [TRANSACTION_TYPES.LOAN_REPAYMENT]: {

        description: "Loan Repayment",

        source: JOURNAL_SOURCES.LOAN_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Loan repayment received"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.LOAN_RECEIVABLE,

                description: "Reduce loan balance"

            }

        ]

    },

    /**
     * ============================================================
     * PENALTY PAYMENT
     * ============================================================
     */

    [TRANSACTION_TYPES.PENALTY]: {

        description: "Penalty Payment",

        source: JOURNAL_SOURCES.CONTRIBUTION_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Penalty received"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.PENALTY_INCOME,

                description: "Penalty income"

            }

        ]

    },

    /**
     * ============================================================
     * INTEREST PAYMENT
     * ============================================================
     */

    [TRANSACTION_TYPES.INTEREST]: {

        description: "Interest Payment",

        source: JOURNAL_SOURCES.LOAN_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Interest received"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.INTEREST_INCOME,

                description: "Interest income"

            }

        ]

    },

    /**
     * ============================================================
     * PAYOUT
     * ============================================================
     */

    [TRANSACTION_TYPES.PAYOUT]: {

        description: "Member Payout",

        source: JOURNAL_SOURCES.PAYOUT_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MEMBER_SAVINGS,

                description: "Reduce member savings"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.PAYOUT_CLEARING,

                description: "Funds reserved for payout"

            }

        ]

    },

    /**
     * ============================================================
     * WALLET TOP-UP
     * ============================================================
     */

    [TRANSACTION_TYPES.WALLET_TOPUP]: {

        description: "Wallet Top-up",

        source: JOURNAL_SOURCES.PAYMENT_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Wallet funded"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.WALLET,

                description: "Wallet balance"

            }

        ]

    },

    /**
     * ============================================================
     * ESCROW FUNDING
     * ============================================================
     */

    [TRANSACTION_TYPES.ESCROW_FUNDING]: {

        description: "Escrow Funding",

        source: JOURNAL_SOURCES.ESCROW_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.MPESA_CLEARING,

                description: "Escrow funded"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.ESCROW_HOLDING,

                description: "Escrow liability"

            }

        ]

    },

    /**
     * ============================================================
     * ESCROW RELEASE
     * ============================================================
     */

    [TRANSACTION_TYPES.ESCROW_RELEASE]: {

        description: "Escrow Release",

        source: JOURNAL_SOURCES.ESCROW_ENGINE,

        entries: [

            {

                type: ENTRY_TYPES.DEBIT,

                account: ACCOUNT_CODES.ESCROW_HOLDING,

                description: "Release escrow"

            },

            {

                type: ENTRY_TYPES.CREDIT,

                account: ACCOUNT_CODES.ESCROW_SETTLEMENT,

                description: "Settlement"

            }

        ]

    }

});