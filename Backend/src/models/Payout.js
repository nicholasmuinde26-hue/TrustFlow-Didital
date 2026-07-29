import mongoose from 'mongoose';


// ========================================
// PAYOUT SCHEMA
// ========================================
//
// A Payout is the OPERATIONAL record of a
// rotational Chama payout — mirroring how
// ContributionObligation / ContributionPayment
// work for contributions.
//
// Architecture:
//
// Payout (this model)
//       │
//       │  status: pending
//       ▼
// FinancialTransaction  (transaction_type: 'payout_obligation')
//       │
//       ├── DR 3000 Member Contributions
//       └── CR 2000 Payouts Payable
//
//       │  treasurer confirms disbursement
//       │  status: paid
//       ▼
// FinancialTransaction  (transaction_type: 'payout_settlement')
//       │
//       ├── DR 2000 Payouts Payable
//       └── CR 1000 / 1100 / 1200 (cash / bank / mpesa)
//
// IMPORTANT — NON-CUSTODIAL:
//
// Neither phase moves any money. The first
// phase records that the Chama now OWES the
// member a payout. The second phase records
// that the treasurer has ALREADY disbursed
// the funds themselves (cash handover, bank
// transfer, M-Pesa send) — disbursement_method
// and external_reference capture how/where
// that happened for reconciliation, exactly
// like ContributionPayment does for money
// coming in.
//
// ========================================


const payoutSchema = new mongoose.Schema(
  {

    // ========================================
    // CHAMA
    // ========================================

    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },


    // ========================================
    // RECIPIENT
    // ========================================
    //
    // References ChamaMembership (not User
    // directly) — payout_position and role
    // are scoped to the membership, not the
    // global user account.
    //
    // ========================================

    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true
    },


    // ========================================
    // PAYOUT POSITION
    // ========================================

    payout_position: {
      type: Number,
      required: true
    },


    // ========================================
    // AMOUNT
    // ========================================
    //
    // Decimal128, matching every other money
    // field in the finance engine
    // (FinancialAccount, FinancialTransaction,
    // LedgerEntry, ContributionObligation,
    // ContributionPayment). Plain Number was
    // used previously, which loses precision
    // and was inconsistent with the rest of
    // the ledger.
    //
    // ========================================

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true
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
    // STATUS
    // ========================================

    status: {
      type: String,

      enum: [
        'pending',
        'paid',
        'cancelled'
      ],

      default: 'pending',

      index: true
    },


    // ========================================
    // DISBURSEMENT METHOD
    // ========================================
    //
    // How the treasurer says they actually
    // sent the money. Only set once the
    // payout is marked paid.
    //
    // ========================================

    // ========================================
    // DISBURSEMENT METHOD
    // ========================================
    //
    // How the treasurer says they actually
    // sent the money. Only set once the
    // payout is marked paid.
    //
    // IMPORTANT:
    //
    // This must stay in sync with
    // getContributionPaymentAssetAccount()'s
    // paymentAccountCodes map (financeAccount.
    // service.js), which only resolves a real
    // ledger account for 'cash' / 'bank' /
    // 'mpesa'. There is no 'mobile_money' or
    // 'other' asset account in the Chama chart
    // of accounts — adding either here without
    // also adding a matching account (and
    // updating that map) will throw at
    // settlement time.
    //
    // ========================================

    disbursement_method: {
      type: String,

      enum: [
        'cash',
        'bank',
        'mpesa'
      ],

      default: null
    },


    // ========================================
    // EXTERNAL REFERENCE
    // ========================================
    //
    // M-Pesa confirmation code / bank
    // reference the treasurer used when
    // disbursing, for reconciliation.
    //
    // ========================================

    external_reference: {
      type: String,
      trim: true,
      default: null
    },


    // ========================================
    // RECOGNITION TRANSACTION LINK
    // ========================================
    //
    // The FinancialTransaction that recorded
    // this payout becoming owed
    // (transaction_type: 'payout_obligation').
    //
    // ========================================

    obligation_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },


    // ========================================
    // SETTLEMENT TRANSACTION LINK
    // ========================================
    //
    // The FinancialTransaction that recorded
    // the disbursement actually happening
    // (transaction_type: 'payout_settlement').
    //
    // ========================================

    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },


    // ========================================
    // PAYMENT DATE
    // ========================================

    paid_at: {
      type: Date,
      default: null
    },


    // ========================================
    // CANCEL DATE
    // ========================================

    cancelled_at: {
      type: Date,
      default: null
    }
  },

  {
    timestamps: true
  }
);


// ========================================
// PREVENT MULTIPLE ACTIVE PAYOUTS
// ========================================

payoutSchema.index(
  {
    chama_id: 1,
    status: 1
  }
);


export default mongoose.model(
  'Payout',
  payoutSchema
);