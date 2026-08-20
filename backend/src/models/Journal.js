import mongoose from "mongoose";

const journalSchema = new mongoose.Schema(
    {
        /**
         * Journal Number
         */
        journalNumber: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        /**
         * Financial Transaction
         */
        transaction: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FinancialTransaction",
            required: true,
            index: true
        },

        /**
         * Chama
         */
        chama: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chama",
            required: true,
            index: true
        },

        /**
         * Member
         */
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

        /**
         * Posting Type
         */
        transactionType: {
            type: String,
            required: true,
            index: true
        },

        /**
         * Posting Status
         */
        status: {
            type: String,
            enum: [
                "PENDING",
                "POSTED",
                "REVERSED",
                "FAILED"
            ],
            default: "PENDING",
            index: true
        },

        /**
         * Currency
         */
        currency: {
            type: String,
            default: "KES"
        },

        /**
         * Total Amount
         */
        amount: {
            type: Number,
            required: true
        },

        /**
         * Debit Total
         */
        totalDebit: {
            type: Number,
            required: true
        },

        /**
         * Credit Total
         */
        totalCredit: {
            type: Number,
            required: true
        },

        /**
         * Posting Date
         */
        postingDate: {
            type: Date,
            default: Date.now
        },

        /**
         * Narration
         */
        narration: {
            type: String
        },

        /**
         * Provider
         */
        provider: {
            type: String
        },

        /**
         * Correlation Id
         */
        correlationId: {
            type: String,
            index: true
        },

        /**
         * Parent Journal (for reversals)
         */
        parentJournal: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Journal",
            default: null
        },

        /**
         * Journal Type
         */
        journalType: {
            type: String,
            default: "STANDARD"
        },

        /**
         * Failure Reason
         */
        failureReason: {
            type: String,
            default: null,
            trim: true,
            maxlength: 500
        },

        /**
         * Metadata
         */
        metadata: {
            type: Object,
            default: {}
        }

    },
    {
        timestamps: true
    }
);

export default mongoose.model(
    "Journal",
    journalSchema
);