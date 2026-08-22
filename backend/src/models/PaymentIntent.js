import mongoose from 'mongoose';

// ========================================
// PAYMENT INTENT SCHEMA
// ========================================
const paymentIntentSchema = new mongoose.Schema(
  {
    obligation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionObligation',
      required: false,
      default: null,
      index: true
    },
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      default: null
    },
    owner_type: {
      type: String,
      enum: ['Chama', 'ContributionGroup', 'Business'],
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
      enum: ['ChamaMembership', 'ContributionGroupMember'],
      required: true
    },
    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
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
    payment_method: {
      type: String,
      enum: ['mpesa', 'mobile_money', 'bank', 'cash', 'card', 'transfer', 'other'],
      required: true
    },
    phone_number: {
      type: String,
      default: null
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    display_reference: {
      type: String,
      required: true,
      index: true
    },
    idempotency_key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    external_reference: {
      type: String,
      default: null,
      index: true
    },
    provider: {
      type: String,
      enum: ['mpesa', 'stripe', 'paypal', 'bank', 'cash', 'other'],
      required: true,
      default: 'mpesa'
    },
    provider_request_id: {
      type: String,
      default: null,
      index: true
    },
    provider_response_id: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'], // FIX: added refunded
      default: 'pending',
      index: true
    },
    failure_code: { type: String, default: null },
    failure_reason: { type: String, default: null },
    provider_response: { type: mongoose.Schema.Types.Mixed, default: null },
    contribution_payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPayment',
      default: null,
      index: true
    },
    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    completed_at: { type: Date, default: null },
    failed_at: { type: Date, default: null }
  },
  { timestamps: true }
);

// ========================================
// INDEXES
// ========================================
paymentIntentSchema.index(
  { provider: 1, provider_request_id: 1 },
  { unique: true, partialFilterExpression: { provider_request_id: { $type: 'string' } } }
);
paymentIntentSchema.index({ status: 1, provider: 1, createdAt: -1 });
paymentIntentSchema.index({ participant_id: 1, display_reference: 1, createdAt: -1 });

// ========================================
// JSON TRANSFORM
// ========================================
paymentIntentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    if (ret.amount !== undefined && ret.amount !== null) {
      ret.amount = ret.amount.toString();
    }
    return ret;
  }
});

const PaymentIntent = mongoose.model('PaymentIntent', paymentIntentSchema);
export default PaymentIntent;