import mongoose from 'mongoose';


// ========================================
// FINANCIAL TRANSACTION MODEL
// ========================================
//
// A FinancialTransaction represents a
// financial business event.
//
// It is the HEADER of a double-entry
// accounting transaction.
//
// Examples:
//
// - Member contribution
// - Loan disbursement
// - Loan repayment
// - Chama payout
// - Withdrawal
// - Deposit
// - Transfer
// - Fee
// - Penalty
// - Financial adjustment
//
// IMPORTANT:
//
// FinancialTransaction does NOT represent
// individual debit and credit entries.
//
// Those are stored in:
//
// LedgerEntry
//
// Example:
//
// FinancialTransaction
//       │
//       ├── LedgerEntry
//       │       Debit
//       │
//       └── LedgerEntry
//               Credit
//
// Total debits MUST equal total credits.
//
// ========================================


const OWNER_TYPES = [
  'Chama',
  'ContributionGroup',
  'Business'
];


const TRANSACTION_TYPES = [
  'contribution',
  'contribution_payment',
  'contribution_reversal',
  'mgr_contribution',
  'payout',
  'payout_obligation',
  'payout_settlement',
  'payout_cancellation',
  'savings_shareout_obligation',
  'savings_shareout_settlement',
  'savings_shareout_cancellation',
  'loan_disbursement',
  'loan_repayment',
  'deposit',
  'withdrawal',
  'transfer',
  'fee',
  'penalty',
  'adjustment',
  'sale',
  'expense',
  'customer_payout'
];



const TRANSACTION_STATUSES = [
  'pending',
  'posted',
  'failed',
  'reversed',
  'cancelled'
];


// ========================================
// FINANCIAL TRANSACTION SCHEMA
// ========================================

const financialTransactionSchema =
  new mongoose.Schema(
    {

      // ========================================
      // OWNER TYPE
      // ========================================

      owner_type: {
        type: String,
        enum: OWNER_TYPES,
        required: true,
        index: true
      },


      // ========================================
      // OWNER ID
      // ========================================

      owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
      },


      // ========================================
      // TRANSACTION TYPE
      // ========================================

      transaction_type: {
        type: String,
        enum: TRANSACTION_TYPES,
        required: true,
        index: true
      },


      // ========================================
      // TOTAL TRANSACTION AMOUNT
      // ========================================

      amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true,
        min: 0
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
        required: true
      },


      // ========================================
      // SOURCE TYPE
      // ========================================

      source_type: {
        type: String,
        required: true,
        trim: true,
        index: true
      },


      // ========================================
      // SOURCE ID
      // ========================================

      source_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        index: true
      },


      // ========================================
      // EXTERNAL REFERENCE
      // ========================================
      //
      // IMPORTANT:
      //
      // Do NOT use index: true here.
      //
      // The index is explicitly declared below.
      //
      // This prevents Mongoose from creating
      // the same index twice.
      //
      // ========================================

      external_reference: {
        type: String,
        trim: true,
        default: null
      },


      // ========================================
      // INTERNAL REFERENCE
      // ========================================
      //
      // unique: true automatically creates
      // the unique index.
      //
      // Therefore index: true is unnecessary.
      //
      // ========================================

      reference: {
        type: String,
        trim: true,
        unique: true,
        sparse: true
      },


      // ========================================
      // TRANSACTION STATUS
      // ========================================

      status: {
        type: String,
        enum: TRANSACTION_STATUSES,
        default: 'pending',
        required: true,
        index: true
      },


      // ========================================
      // DESCRIPTION
      // ========================================

      description: {
        type: String,
        default: '',
        trim: true,
        maxlength: 500
      },


      // ========================================
      // CREATED BY
      // ========================================

      created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },


      // ========================================
      // POSTED BY
      // ========================================

      posted_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },


      // ========================================
      // POSTED DATE
      // ========================================

      posted_at: {
        type: Date,
        default: null
      },


      // ========================================
      // REVERSED TRANSACTION
      // ========================================

      reversed_transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialTransaction',
        default: null
      },


      // ========================================
      // REVERSAL REASON
      // ========================================

      reversal_reason: {
        type: String,
        default: null,
        trim: true,
        maxlength: 500
      }

    },

    {
      timestamps: true
    }

  );


// ========================================
// OWNER TRANSACTION LOOKUP
// ========================================

financialTransactionSchema.index(
  {
    owner_type: 1,
    owner_id: 1,
    createdAt: -1
  },
  {
    name: 'financial_transaction_owner_lookup'
  }
);


// ========================================
// TRANSACTION TYPE LOOKUP
// ========================================

financialTransactionSchema.index(
  {
    owner_type: 1,
    owner_id: 1,
    transaction_type: 1,
    createdAt: -1
  },
  {
    name: 'financial_transaction_type_lookup'
  }
);


// ========================================
// STATUS LOOKUP
// ========================================

financialTransactionSchema.index(
  {
    owner_type: 1,
    owner_id: 1,
    status: 1,
    createdAt: -1
  },
  {
    name: 'financial_transaction_status_lookup'
  }
);


// ========================================
// SOURCE LOOKUP
// ========================================
//
// Used to find the transaction created
// from a specific business event.
//
// The application/service layer should
// enforce idempotency where required.
//
// ========================================

financialTransactionSchema.index(
  {
    source_type: 1,
    source_id: 1
  },
  {
    name: 'financial_transaction_source_lookup'
  }
);


// ========================================
// EXTERNAL REFERENCE LOOKUP
// ========================================
//
// IMPORTANT:
//
// This is the ONLY index definition for
// external_reference.
//
// Do not add index: true to the field.
//
// ========================================

financialTransactionSchema.index(
  {
    external_reference: 1
  },
  {
    name: 'financial_transaction_external_reference_lookup'
  }
);


// ========================================
// REVERSED TRANSACTION LOOKUP
// ========================================

financialTransactionSchema.index(
  {
    reversed_transaction_id: 1
  },
  {
    name: 'financial_transaction_reversal_lookup'
  }
);


// ========================================
// JSON TRANSFORMATION
// ========================================
//
// Convert Decimal128 to string so that
// financial amounts are returned consistently
// through API responses.
//
// ========================================

financialTransactionSchema.set(
  'toJSON',
  {
    transform: (_doc, ret) => {

      if (
        ret.amount !== undefined &&
        ret.amount !== null
      ) {
        ret.amount = ret.amount.toString();
      }

      return ret;

    }
  }
);


// ========================================
// MODEL
// ========================================
//
// Reuse existing model during nodemon
// reloads to prevent OverwriteModelError.
//
// ========================================

const FinancialTransaction =
  mongoose.models.FinancialTransaction ||
  mongoose.model(
    'FinancialTransaction',
    financialTransactionSchema
  );


// ========================================
// EXPORT
// ========================================

export default FinancialTransaction;