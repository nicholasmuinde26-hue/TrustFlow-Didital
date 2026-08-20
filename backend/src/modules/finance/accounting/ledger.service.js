/**
 * ============================================================================
 * LEDGER SERVICE
 * ============================================================================
 *
 * Generates balanced ledger entries for an existing Journal.
 *
 * Responsibilities
 * ----------------
 * ✓ Read accounting rules
 * ✓ Generate ledger entries
 * ✓ Validate journal
 * ✓ Persist ledger entries
 * ✓ Return posting aggregate
 *
 * DOES NOT
 * --------
 * ✗ Create journals
 * ✗ Create financial transactions
 * ✗ Update account balances
 * ✗ Know about Contributions or Payouts
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import LedgerEntry from "../../../models/LedgerEntry.js";
import financeAccountService from "../financeAccount.service.js";

import { ACCOUNTING_RULES } from "./accounting.rules.js";

import {
    ENTRY_TYPES,
    POSTING_STATUS
} from "./accounting.constants.js";

import journalValidator from "./journal.validator.js";

class LedgerService {

    /**
     * ============================================================
     * POST JOURNAL
     * ============================================================
     */

    async post(journal, transaction, session = null) {

        const transactionType =
            transaction.transaction_type ||
            transaction.transactionType;

        const rule = ACCOUNTING_RULES[transactionType];

        if (!rule) {

            throw new Error(

                `No accounting rule defined for '${transaction.transactionType}'.`

            );

        }

        const entries = [];

        let totalDebit = 0;

        let totalCredit = 0;

        /**
         * --------------------------------------------------------
         * Generate Entries
         * --------------------------------------------------------
         */

        for (const line of rule.entries) {

            const entry = {

                journal: journal._id,

                transaction: transaction._id,

                chama: transaction.chama,

                member: transaction.member,

                account: line.account || line.accountCode,

                type: line.type || line.entry_type || line.entryType,

                amount: transaction.amount,

                currency: transaction.currency,

                provider: transaction.provider,

                reference: transaction.reference,

                description: line.description,

                status: POSTING_STATUS.POSTED,

                metadata: {

                    correlationId:
                        transaction.correlationId,

                    source:
                        rule.source,

                    payment:
                        transaction.payment,

                    obligation:
                        transaction.obligation,

                    payout:
                        transaction.payout

                }

            };

            entries.push(entry);

            if (entry.type === ENTRY_TYPES.DEBIT) {

                totalDebit += Number(entry.amount);

            }

            else {

                totalCredit += Number(entry.amount);

            }

        }

        /**
         * --------------------------------------------------------
         * Validate Journal
         * --------------------------------------------------------
         */

        journalValidator.validate(

            journal,

            entries

        );

        /**
         * --------------------------------------------------------
         * Persist Entries
         * --------------------------------------------------------
         */

        const savedEntries = await LedgerEntry.insertMany(

            entries,

            {

                session

            }

        );

        /**
         * --------------------------------------------------------
         * Update Journal Totals
         * --------------------------------------------------------
         */

        journal.totalDebit = totalDebit;

        journal.totalCredit = totalCredit;

        await journal.save({

            session

        });

        /**
         * --------------------------------------------------------
         * Return Aggregate
         * --------------------------------------------------------
         */

        return {

            journal,

            entries: savedEntries,

            debit: totalDebit,

            credit: totalCredit,

            balanced:

                totalDebit === totalCredit

        };

    }

    /**
     * ============================================================
     * CREATE LEDGER ENTRIES
     * ============================================================
     */

    async createEntries(
        journal,
        transaction,
        entries = [],
        session = null
    ) {

        if (!journal) {
            throw new Error(
                "Journal is required to create ledger entries."
            );
        }

        if (!transaction) {
            throw new Error(
                "Transaction is required to create ledger entries."
            );
        }

        const savedEntries = [];
        let totalDebit = 0;
        let totalCredit = 0;

        for (const entry of entries) {

            const accountReference =
                entry.account_id ||
                entry.account ||
                entry.accountCode;

            let accountId = entry.account_id || null;

            if (!accountId) {
                if (!accountReference) {
                    throw new Error(
                        "Each ledger entry requires an account reference."
                    );
                }

                if (mongoose.isValidObjectId(accountReference)) {
                    accountId = accountReference;
                }
                else {
                    const account =
                        await financeAccountService.findByCode(
                            accountReference,
                            transaction.owner_type,
                            transaction.owner_id,
                            session
                        );

                    if (!account) {
                        throw new Error(
                            `Financial account '${accountReference}' not found for ${transaction.owner_type}:${transaction.owner_id}`
                        );
                    }

                    accountId = account._id;
                }
            }

            const entryType =
                (entry.entry_type || entry.entryType || entry.type)
                .toLowerCase();

            const ledgerEntry = {
                transaction_id:
                    transaction._id || transaction,
                owner_type:
                    transaction.owner_type,
                owner_id:
                    transaction.owner_id,
                account_id:
                    accountId,
                entry_type:
                    entryType,
                amount:
                    entry.amount,
                currency:
                    entry.currency || transaction.currency || journal.currency,
                description:
                    entry.description || entry.narration || '',
                status:
                    entry.status || POSTING_STATUS.POSTED,
                posted_at:
                    entry.posted_at || new Date(),
                posted_by:
                    entry.posted_by || transaction.posted_by || null
            };

            if (entryType === ENTRY_TYPES.DEBIT) {
                totalDebit += Number(entry.amount);
            } else {
                totalCredit += Number(entry.amount);
            }

            const [savedEntry] = await LedgerEntry.insertMany([
                ledgerEntry
            ], {
                session
            });

            savedEntries.push(savedEntry);
        }

        journal.totalDebit = totalDebit;
        journal.totalCredit = totalCredit;
        await journal.save({ session });

        return savedEntries;

    }

    /**
     * ============================================================
     * BUILD REVERSAL ENTRIES
     * ============================================================
     */

    buildReversalEntries(entries = []) {

        return entries.map(entry => ({

            ...entry.toObject(),

            _id: undefined,

            journal: undefined,

            createdAt: undefined,

            updatedAt: undefined,

            type:

                entry.type === ENTRY_TYPES.DEBIT

                    ? ENTRY_TYPES.CREDIT

                    : ENTRY_TYPES.DEBIT,

            description:

                `Reversal - ${entry.description}`

        }));

    }

    /**
     * ============================================================
     * GET JOURNAL ENTRIES
     * ============================================================
     */

    async getJournalEntries(journalId) {

        return LedgerEntry.find({

            journal: journalId

        }).sort({

            createdAt: 1

        });

    }

}

export default new LedgerService();