/**
 * ============================================================================
 * ACCOUNTING RESULT
 * ============================================================================
 *
 * Immutable response returned by the Accounting Engine.
 *
 * Every successful financial posting returns an AccountingResult,
 * regardless of the originating business module.
 *
 * Responsibilities
 * ----------------
 * ✓ Encapsulate posting outcome
 * ✓ Standardize accounting responses
 * ✓ Provide immutable financial result
 * ✓ Support downstream audit, events, and reconciliation
 *
 * ============================================================================
 */

export default class AccountingResult {

    constructor({

        success = true,

        transaction,

        journal,

        entries = [],

        updatedAccounts = [],

        balanced = false,

        status = "POSTED",

        debit = 0,

        credit = 0,

        correlationId,

        provider = null,

        transactionType,

        metadata = {},

        warnings = []

    }) {

        this.success = success;

        this.transaction = transaction;

        this.journal = journal;

        this.entries = entries;

        this.updatedAccounts = updatedAccounts;

        this.balanced = balanced;

        this.status = status;

        this.debit = debit;

        this.credit = credit;

        this.correlationId = correlationId;

        this.provider = provider;

        this.transactionType = transactionType;

        this.metadata = metadata;

        this.warnings = warnings;

        Object.freeze(this);
    }

    /**
     * ============================================================
     * SUCCESS FLAG
     * ============================================================
     */

    get isSuccessful() {

        return this.success;

    }

    /**
     * ============================================================
     * NUMBER OF LEDGER ENTRIES
     * ============================================================
     */

    get entryCount() {

        return this.entries.length;

    }

    /**
     * ============================================================
     * NUMBER OF UPDATED ACCOUNTS
     * ============================================================
     */

    get accountCount() {

        return this.updatedAccounts.length;

    }

    /**
     * ============================================================
     * DOUBLE ENTRY VALIDATION
     * ============================================================
     */

    get isBalanced() {

        return this.debit === this.credit;

    }

    /**
     * ============================================================
     * SERIALIZE
     * ============================================================
     */

    toJSON() {

        return {

            success: this.success,

            status: this.status,

            balanced: this.balanced,

            debit: this.debit,

            credit: this.credit,

            correlationId: this.correlationId,

            provider: this.provider,

            transactionType: this.transactionType,

            transaction: this.transaction,

            journal: this.journal,

            entries: this.entries,

            updatedAccounts: this.updatedAccounts,

            metadata: this.metadata,

            warnings: this.warnings

        };

    }

}