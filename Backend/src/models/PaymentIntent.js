import mongoose from 'mongoose';

// ========================================
// PAYMENT INTENT SCHEMA
// ========================================
const paymentIntentSchema = new mongoose.Schema(
  {
    // ==================================
    // CONTRIBUTION CONTEXT
    // ==================================
    obligation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionObligation',
      required: true,
      index: true
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      default: null
    },

    // ==================================
    // OWNER
    // ==================================
    owner_type: {
      type: String,
      enum: ['Chama', 'ContributionGroup'],
      required: true,
      index: true
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    // ==================================
    // PARTICIPANT
    // ==================================
    participant_type: {
      type: String,
      enum: ['ChamaMembership', 'ContributionGroupMember'],
      required: true
    },
    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },

    // ==================================
    // PAYMENT AMOUNT
    // ==================================
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      default: 'KES'
    },

    // ==================================
    // PAYMENT METHOD
    // ==================================
    payment_method: {
      type: String,
      enum: ['mpesa', 'mobile_money', 'bank', 'cash', 'card', 'transfer', 'other'],
      required: true
    },

    // ==================================
    // CUSTOMER PHONE
    // ==================================
    phone_number: {
      type: String,
      default: null
    },

    // ==================================
    // INTERNAL REFERENCE - MUST BE UNIQUE PER TRANSACTION
    // ==================================
    reference: {
      type: String,
      required: true,
      unique: true, // keep this unique, but we will generate it with timestamp
      index: true
    },

    // NEW: What shows on M-Pesa statement. Can repeat.
    display_reference: {
      type: String,
      required: true,
      index: true
    },

    // ==================================
    // IDEMPOTENCY KEY
    // ==================================
    idempotency_key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },

    // ==================================
    // EXTERNAL REFERENCE
    // ==================================
    external_reference: {
      type: String,
      default: null,
      index: true
    },

    // ==================================
    // PROVIDER
    // ==================================
    provider: {
      type: String,
      enum: ['mpesa', 'stripe', 'paypal', 'bank', 'other'],
      required: true,
      default: 'mpesa'
    },

    // ==================================
    // PROVIDER REQUEST ID
    // ==================================
    provider_request_id: {
      type: String,
      default: null,
      index: true
    },

    // ==================================
    // PROVIDER RESPONSE ID
    // ==================================
    provider_response_id: {
      type: String,
      default: null
    },

    // ==================================
    // PAYMENT STATUS
    // ==================================
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true
    },

    // ==================================
    // FAILURE INFORMATION
    // ==================================
    failure_code: { type: String, default: null },
    failure_reason: { type: String, default: null },

    // ==================================
    // M-PESA RAW RESPONSE
    // ==================================
    provider_response: { type: mongoose.Schema.Types.Mixed, default: null },

    // ==================================
    // FINAL CONTRIBUTION PAYMENT
    // ==================================
    contribution_payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPayment',
      default: null,
      index: true
    },

    // ==================================
    // FINANCIAL TRANSACTION
    // ==================================
    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },

    // ==================================
    // AUDIT
    // ==================================
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completed_at: { type: Date, default: null },
    failed_at: { type: Date, default: null }
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================

// Prevent duplicate provider callbacks.
paymentIntentSchema.index(
  { provider: 1, provider_request_id: 1 },
  {
    unique: true,
    partialFilterExpression: { provider_request_id: { $type: 'string' } }
  }
);

// Find pending payments efficiently.
paymentIntentSchema.index({ status: 1, provider: 1, createdAt: -1 });

// NEW: Prevent spamming same display_reference by same user
paymentIntentSchema.index({ participant_id: 1, display_reference: 1, createdAt: -1 });

// ========================================
// JSON TRANSFORM
// ========================================
paymentIntentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);
export default PaymentIntent;