/**
 * ============================================================================
 * JOURNAL VALIDATOR
 * ============================================================================
 *
 * Validates accounting journals before they are posted.
 *
 * Responsibilities
 * ----------------
 * ✓ Ensure journal contains entries
 * ✓ Ensure debit equals credit
 * ✓ Validate entry amounts
 * ✓ Validate currencies
 * ✓ Validate account references
 * ✓ Prevent invalid journals
 *
 * ============================================================================
 */

import {
    ENTRY_TYPES
} from "./accounting.constants.js";

class JournalValidator {

    /**
     * ============================================================
     * VALIDATE COMPLETE JOURNAL
     * ============================================================
     */

    validate(journal, entries = []) {

        this.validateJournal(journal);

        this.validateEntries(entries);

        this.validateAmounts(entries);

        this.validateCurrencies(entries);

        this.validateAccounts(entries);

        this.validateBalance(entries);

        this.validateDuplicates(entries);

        return true;

    }

    /**
     * ============================================================
     * JOURNAL
     * ============================================================
     */

    validateJournal(journal) {

        if (!journal) {

            throw new Error(
                "Journal is required."
            );

        }

        if (!journal.transaction) {

            throw new Error(
                "Journal transaction is required."
            );

        }

        if (!journal.chama) {

            throw new Error(
                "Journal chama is required."
            );

        }

    }

    /**
     * ============================================================
     * ENTRIES
     * ============================================================
     */

    validateEntries(entries) {

        if (!Array.isArray(entries)) {

            throw new Error(
                "Journal entries must be an array."
            );

        }

        if (entries.length < 2) {

            throw new Error(
                "A journal requires at least two entries."
            );

        }

    }

    /**
     * ============================================================
     * AMOUNTS
     * ============================================================
     */

    validateAmounts(entries) {

        for (const entry of entries) {

            if (entry.amount == null) {

                throw new Error(
                    "Ledger entry amount is required."
                );

            }

            if (Number(entry.amount) <= 0) {

                throw new Error(
                    "Ledger entry amount must be greater than zero."
                );

            }

        }

    }

    /**
     * ============================================================
     * CURRENCY
     * ============================================================
     */

    validateCurrencies(entries) {

        const currencies = new Set();

        for (const entry of entries) {

            currencies.add(entry.currency);

        }

        if (currencies.size > 1) {

            throw new Error(
                "Mixed currencies are not allowed in one journal."
            );

        }

    }

    /**
     * ============================================================
     * ACCOUNTS
     * ============================================================
     */

    validateAccounts(entries) {

        for (const entry of entries) {

            if (
                !entry.account &&
                !entry.account_id &&
                !entry.accountCode
            ) {

                throw new Error(
                    "Ledger account is required."
                );

            }

            if(
                !entry.entryType &&
                !entry.type &&
                !entry.entry_type
            ) {

                throw new Error(
                    "Ledger entry type is required."
                );

            }

        }

    }

    /**
     * ============================================================
     * BALANCE
     * ============================================================
     */

    validateBalance(entries) {

        let debit = 0;

        let credit = 0;

        for (const entry of entries) {

            const type =
                (entry.type || entry.entryType || entry.entry_type)
                .toLowerCase();

            if (type === ENTRY_TYPES.DEBIT) {

                debit += Number(entry.amount);

            }

            else if (type === ENTRY_TYPES.CREDIT) {

                credit += Number(entry.amount);

            }

            else {

                throw new Error(
                    `Invalid entry type '${type}'.`
                );

            }

        }

        if (debit !== credit) {

            throw new Error(

                `Journal is not balanced. Debit=${debit}, Credit=${credit}`

            );

        }

    }

    /**
     * ============================================================
     * DUPLICATES
     * ============================================================
     */

    validateDuplicates(entries) {

        const seen = new Set();

        for (const entry of entries) {

            const key = [

                entry.account || entry.account_id || entry.accountCode,

                entry.type || entry.entryType || entry.entry_type,

                entry.amount

            ].join(":");

            if (seen.has(key)) {

                console.warn(

                    `Duplicate journal entry detected: ${key}`

                );

            }

            seen.add(key);

        }

    }

}

export default new JournalValidator();