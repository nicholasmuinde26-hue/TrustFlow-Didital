/**
 * ============================================================================
 * LEDGER SERVICE
 * ============================================================================
 *
 * Generates and persists ledger entries for an existing Journal, from
 * entries an accounting rule has already built (see accounting.service.js /
 * financeEngine.service.js, which call createEntries()).
 *
 * Responsibilities
 * ----------------
 * ✓ Persist ledger entries
 * ✓ Update journal running totals
 * ✓ Build reversal entries
 *
 * DOES NOT
 * --------
 * ✗ Create journals
 * ✗ Create financial transactions
 * ✗ Update account balances
 * ✗ Know about Contributions or Payouts
 * ✗ Decide which accounts a transaction type posts to (that's an
 *   accounting rule's job, e.g. rules/mgrContribution.rule.js)
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import LedgerEntry from "../../../models/LedgerEntry.js";
import financeAccountService from "../financeAccount.service.js";

import {
    ENTRY_TYPES,
    POSTING_STATUS
} from "./accounting.constants.js";

class LedgerService {

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