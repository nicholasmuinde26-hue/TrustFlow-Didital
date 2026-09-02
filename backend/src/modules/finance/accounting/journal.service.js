/**
 * ============================================================================
 * JOURNAL SERVICE
 * ============================================================================
 *
 * Aggregate Root for accounting journals.
 *
 * Responsibilities
 * ----------------
 * ✓ Generate journal numbers
 * ✓ Create journal headers
 * ✓ Change journal status
 * ✓ Reverse journals
 * ✓ Retrieve journals
 * ✓ Close journals
 *
 * DOES NOT
 * --------
 * ✗ Generate ledger entries
 * ✗ Update account balances
 * ✗ Create Financial Transactions
 *
 * ============================================================================
 */

import Journal from "../../../models/Journal.js";

import crypto from "crypto";

class JournalService {

    /**
     * ============================================================
     * CREATE JOURNAL
     * ============================================================
     */

    async create(context, transaction, session = null) {
        const chamaId =
            context.chama ||
            context.chamaId ||
            context.chama_id ||
            context.owner_id ||
            context.ownerId ||
            transaction?.chama ||
            transaction?.chama_id ||
            transaction?.owner_id;

        const memberId =
            context.member ||
            context.memberId ||
            context.participant_id ||
            context.participantId ||
            transaction?.member ||
            transaction?.member_id ||
            null;

        let parsedAmount = context.amount;
        if (parsedAmount === undefined || parsedAmount === null) {
            parsedAmount = transaction?.amount;
        }

        let numAmount = 0;
        if (parsedAmount !== null && parsedAmount !== undefined) {
            if (typeof parsedAmount === 'object' && typeof parsedAmount.toString === 'function') {
                numAmount = Number(parsedAmount.toString());
            } else {
                numAmount = Number(parsedAmount);
            }
        }
        if (isNaN(numAmount)) {
            numAmount = 0;
        }

        const journal = await Journal.create([{

            journalNumber:
                await this.generateJournalNumber(),

            transaction:
                transaction._id || transaction,

            chama:
                chamaId,

            member:
                memberId,

            transactionType:
                context.transactionType || context.referenceType || "PAYOUT",
 
            amount:
                numAmount,
 
            currency:
                context.currency || transaction?.currency || "KES",
 
            narration:
                context.description || context.narration || "",

            provider:
                context.provider,

            correlationId:
                context.correlationId,

            status: "PENDING",

            totalDebit: 0,

            totalCredit: 0,

            metadata:
                context.metadata || {}

        }], { session });

        return journal[0];

    }

    /**
     * ============================================================
     * MARK POSTED
     * ============================================================
     */

    async markPosted(journalId, session = null) {

        return Journal.findByIdAndUpdate(

            journalId,

            {

                status: "POSTED",

                postingDate: new Date()

            },

            {

                returnDocument: "after",

                session

            }

        );

    }

    /**
     * ============================================================
     * MARK FAILED
     * ============================================================
     */

    async markFailed(
        journalId,
        reason,
        session = null
    ) {

        return Journal.findByIdAndUpdate(

            journalId,

            {

                status: "FAILED",

                failureReason: reason

            },

            {

                returnDocument: "after",

                session

            }

        );

    }

    /**
     * ============================================================
     * REVERSE JOURNAL
     * ============================================================
     */

    async createReversal(
        originalJournal,
        transaction,
        session = null
    ) {

        const reversal = await Journal.create([{

            journalNumber:
                await this.generateJournalNumber(),

            transaction:
                transaction._id,

            chama:
                originalJournal.chama,

            member:
                originalJournal.member,

            transactionType:
                originalJournal.transactionType,

            amount:
                originalJournal.amount,

            currency:
                originalJournal.currency,

            narration:
                `Reversal of ${originalJournal.journalNumber}`,

            provider:
                originalJournal.provider,

            correlationId:
                crypto.randomUUID(),

            status: "PENDING",

            parentJournal:
                originalJournal._id,

            journalType:
                "REVERSAL"

        }], { session });

        return reversal[0];

    }

    /**
     * ============================================================
     * FIND BY ID
     * ============================================================
     */

    async findById(id) {

        return Journal.findById(id);

    }

    /**
     * ============================================================
     * FIND BY NUMBER
     * ============================================================
     */

    async findByNumber(number) {

        return Journal.findOne({

            journalNumber: number

        });

    }

    /**
     * ============================================================
     * GENERATE JOURNAL NUMBER
     * ============================================================
     */

    async generateJournalNumber() {

        const now = new Date();

        const year = now.getFullYear();

        const random = crypto
            .randomBytes(3)
            .toString("hex")
            .toUpperCase();

        return `JR-${year}-${random}`;

    }

}

export default new JournalService();