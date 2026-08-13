import mongoose from 'mongoose';
import crypto from "node:crypto"; // not needed here but keep imports clean

// ========================================
// CONSTANTS
// ========================================
const OWNER_TYPES = ['Chama', 'ContributionGroup'];
const PARTICIPANT_TYPES = ['ChamaMembership', 'ContributionGroupMember'];
const PAYMENT_METHODS = ['cash', 'bank', 'mpesa', 'mobile_money', 'card', 'transfer', 'other'];
const PAYMENT_STATUSES = ['pending', 'processing', 'completed', 'failed', 'reversed', 'cancelled', 'refunded']; // FIX: added processing + refunded
const CHANNEL_TYPES = ['cash', 'mpesa', 'mobile_money', 'bank_account', 'bank_transfer', 'card', 'internal_transfer', 'other'];
const PROCESSING_MODES = ['manual', 'automated', 'webhook'];
const PAYMENT_PROVIDERS = ['mpesa', 'airtel_money', 'pesapal', 'stripe', 'card_processor', 'bank', 'internal', 'cash', 'other'];
const PAYMENT_INSTRUMENT_TYPES = ['cash', 'phone_number', 'mobile_money_account', 'bank_account', 'card', 'account', 'other'];
const PAYMENT_ATTEMPT_STATUSES = ['initiated', 'pending', 'processing', 'completed', 'failed', 'cancelled', 'expired'];
const PAYMENT_DIRECTIONS = ['inbound'];

// ========================================
// CONTRIBUTION PAYMENT SCHEMA
// ========================================

const contributionPaymentSchema = new mongoose.Schema(
  {
    obligation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionObligation',
      required: true,
      index: true
    },
    payment_intent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentIntent',
      required: false,
      index: true
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      required: true,
      index: true
    },
    owner_type: {
      type: String,
      enum: OWNER_TYPES,
      required: true,
      index: true
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    participant_type: {
      type: String,
      enum: PARTICIPANT_TYPES,
      required: true,
      index: true
    },
    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    payment_direction: {
      type: String,
      enum: PAYMENT_DIRECTIONS,
      required: true,
      default: 'inbound'
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0.01
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'KES'
    },
    payment_method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      index: true
    },
    channel_type: {
      type: String,
      enum: CHANNEL_TYPES,
      required: true,
      index: true
    },
    processing_mode: {
      type: String,
      enum: PROCESSING_MODES,
      required: true,
      default: 'manual'
    },
    payment_provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: null,
      index: true
    },
    provider_payment_id: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
      index: true
    },
    external_reference: {
      type: String,
      trim: true,
      maxlength: 150,
      index: true
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    payment_instrument: { 
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    idempotency_key: { // FIX: add this field to match store
      type: String,
      trim: true,
      index: true
    },
    status: { 
      type: String, 
      enum: PAYMENT_STATUSES, // now includes processing
      required: true, 
      default: 'pending', 
      index: true 
    },
    paid_at: { type: Date, required: true, default: Date.now, index: true },
    initiated_at: { type: Date, default: null },
    completed_at: { type: Date, default: null, index: true },
    failed_at: { type: Date, default: null },
    failure_code: { type: String, trim: true, maxlength: 100, default: null },
    failure_message: { type: String, trim: true, maxlength: 500, default: null },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    verified_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verified_at: { type: Date, default: null },
    financial_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
    reversal_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: 'FinancialTransaction', default: null },
    reversed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reversed_at: { type: Date, default: null },
    reversal_reason: { type: String, trim: true, maxlength: 500, default: null },
    attempts: [ 
      {
        attempt_number: Number,
        status: { type: String, enum: PAYMENT_ATTEMPT_STATUSES },
        attempted_at: Date,
        provider_response: mongoose.Schema.Types.Mixed
      }
    ],
    notes: { type: String, trim: true, maxlength: 1000, default: '' }
  },
  { timestamps: true }
);

// ========================================
// COMPOUND INDEXES
// ========================================
contributionPaymentSchema.index({ obligation_id: 1, status: 1, paid_at: -1, createdAt: -1 });
contributionPaymentSchema.index({ owner_type: 1, owner_id: 1, status: 1, paid_at: -1, createdAt: -1 });
contributionPaymentSchema.index({ participant_type: 1, participant_id: 1, status: 1, paid_at: -1, createdAt: -1 });
contributionPaymentSchema.index({ owner_type: 1, owner_id: 1, payment_method: 1, status: 1, createdAt: -1 });
contributionPaymentSchema.index({ payment_provider: 1, provider_payment_id: 1 });
contributionPaymentSchema.index({ payment_intent_id: 1 }, { name: 'payment_intent_lookup' });
contributionPaymentSchema.index(
  { owner_type: 1, owner_id: 1, external_reference: 1 },
  { 
    unique: true, 
    name: 'unique_external_reference_per_owner',
    partialFilterExpression: { 
      external_reference: { $type: "string" } 
    }
  }
);
contributionPaymentSchema.index({ financial_transaction_id: 1 }, { name: 'contribution_payment_financial_transaction_lookup' });
contributionPaymentSchema.index({ reversal_transaction_id: 1 }, { name: 'contribution_payment_reversal_transaction_lookup' });
contributionPaymentSchema.index({ obligation_id: 1, participant_type: 1, participant_id: 1 });

// NEW: Index for idempotency
contributionPaymentSchema.index(
  { owner_type: 1, owner_id: 1, idempotency_key: 1 },
  { 
    unique: true, 
    name: 'unique_payment_idempotency_key_per_owner',
    partialFilterExpression: { 
      idempotency_key: { $type: "string" } 
    }
  }
);

// ========================================
// PRE-VALIDATION
// ========================================
contributionPaymentSchema.pre('validate', function () {
  if (this.status === 'completed' && !this.completed_at) {
    this.completed_at = new Date();
  }
});

// ========================================
// JSON TRANSFORMATION
// ========================================
contributionPaymentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  }
});

// ========================================
// MODEL
// ========================================
const ContributionPayment =
  mongoose.models.ContributionPayment ||
  mongoose.model('ContributionPayment', contributionPaymentSchema);

export default ContributionPayment;

export {
  OWNER_TYPES,
  PARTICIPANT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  CHANNEL_TYPES,
  PROCESSING_MODES,
  PAYMENT_PROVIDERS,
  PAYMENT_INSTRUMENT_TYPES,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_DIRECTIONS
};