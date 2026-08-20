import mongoose from 'mongoose';


// ========================================
// LEDGER ENTRY SCHEMA
// ========================================
//
// Represents ONE side of a double-entry
// accounting transaction.
//
// Every FinancialTransaction must have:
//
// At least one DEBIT
// At least one CREDIT
//
// And:
//
// TOTAL DEBITS === TOTAL CREDITS
//
// Example:
//
// FinancialTransaction
// amount = KES 1,000
//
// Ledger Entry 1
// account = Clearing Account
// type = debit
// amount = KES 1,000
//
// Ledger Entry 2
// account = Chama Main Account
// type = credit
// amount = KES 1,000
//
// ========================================
//
// IMPORTANT:
//
// LedgerEntry is IMMUTABLE after posting.
//
// We should NOT update or delete historical
// ledger entries.
//
// If a mistake occurs:
//
// Original Transaction
//        │
//        ▼
// Reversal Transaction
//        │
//        ▼
// New Correct Transaction
//
// ========================================


const ledgerEntrySchema =
  new mongoose.Schema(
    {

      // ========================================
      // FINANCIAL TRANSACTION
      // ========================================
      //
      // Parent transaction.
      //
      // Every ledger entry MUST belong to
      // exactly one FinancialTransaction.
      //
      // ========================================

      transaction_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'FinancialTransaction',

        required: true,

        index: true,

        immutable: true

      },


      // ========================================
      // OWNER TYPE
      // ========================================
      //
      // Denormalized from the transaction.
      //
      // This improves financial reporting
      // queries without requiring joins.
      //
      // ========================================

      owner_type: {

        type: String,

        enum: [

          'Chama',

          'ContributionGroup',

          'Business'

        ],

        required: true,

        index: true,

        immutable: true

      },


      // ========================================
      // OWNER ID
      // ========================================

      owner_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        required: true,

        index: true,

        immutable: true

      },


      // ========================================
      // FINANCIAL ACCOUNT
      // ========================================
      //
      // The account affected by this
      // individual ledger entry.
      //
      // ========================================

      account_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'FinancialAccount',

        required: true,

        index: true,

        immutable: true

      },


      // ========================================
      // ENTRY TYPE
      // ========================================
      //
      // DEBIT
      // CREDIT
      //
      // This determines how the ledger entry
      // affects the account.
      //
      // ========================================

      entry_type: {

        type: String,

        enum: [

          'debit',

          'credit'

        ],

        required: true,

        immutable: true

      },


      // ========================================
      // AMOUNT
      // ========================================

      amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        required: true,

        min: 0,

        immutable: true

      },


      // ========================================
      // CURRENCY
      // ========================================

      currency: {

        type: String,

        default: 'KES',

        uppercase: true,

        trim: true,

        minlength: 3,

        maxlength: 3,

        required: true,

        immutable: true

      },


      // ========================================
      // ENTRY DESCRIPTION
      // ========================================

      description: {

        type: String,

        default: '',

        trim: true,

        maxlength: 500,

        immutable: true

      },


      // ========================================
      // ENTRY STATUS
      // ========================================
      //
      // Posted:
      // Normal active accounting entry.
      //
      // Reversed:
      // The entry has been neutralized by
      // a reversal transaction.
      //
      // ========================================

      status: {

        type: String,

        enum: [

          'posted',

          'reversed'

        ],

        default: 'posted',

        required: true

      },


      // ========================================
      // POSTED DATE
      // ========================================

      posted_at: {

        type: Date,

        required: true,

        default: Date.now,

        immutable: true

      },


      // ========================================
      // POSTED BY
      // ========================================

      posted_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref: 'User',

        default: null,

        immutable: true

      }

    },

    {

      timestamps: true

    }

  );


// ========================================
// TRANSACTION LEDGER LOOKUP
// ========================================

ledgerEntrySchema.index({

  transaction_id: 1,

  entry_type: 1

});


// ========================================
// ACCOUNT LEDGER LOOKUP
// ========================================
//
// Used to calculate account balances.
//
// ========================================

ledgerEntrySchema.index({

  account_id: 1,

  posted_at: -1

});


// ========================================
// OWNER LEDGER LOOKUP
// ========================================

ledgerEntrySchema.index({

  owner_type: 1,

  owner_id: 1,

  posted_at: -1

});


// ========================================
// ACCOUNT + ENTRY TYPE LOOKUP
// ========================================

ledgerEntrySchema.index({

  account_id: 1,

  entry_type: 1,

  posted_at: -1

});


// ========================================
// JSON TRANSFORM
// ========================================
// Same Decimal128-serialization issue as FinancialAccount/PaymentIntent:
// without this, `amount` comes back as { $numberDecimal: "..." } and
// breaks Number(entry.amount) on the frontend ledger table.
ledgerEntrySchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  }
});

// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.models.LedgerEntry || mongoose.model(

  'LedgerEntry',

  ledgerEntrySchema

);