import mongoose from 'mongoose';

// ======================================================================
// C2B PAYMENT
// ======================================================================
//
// One row per Safaricom ConfirmationURL delivery for the chama Paybill
// shortcode. This is the record the doc calls a "PaymentTransaction":
// every C2B payment lands here first, whether or not it could be
// automatically matched to a member/chama - unmatched rows are exactly
// the "Unmatched Payments" admin queue.
//
// mpesa_receipt_number is uniquely indexed so a retried confirmation
// delivery (Safaricom retries on any non-fast-200 response) can never
// create a duplicate row - see c2bReconciliation.service.js.
// ======================================================================

const c2bPaymentSchema = new mongoose.Schema(
  {
    mpesa_receipt_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    transaction_type: { type: String, trim: true },
    trans_time: { type: String, trim: true },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
    },

    business_short_code: { type: String, trim: true },

    // The free-text account number the payer typed on their handset.
    // Expected formats: "<phone>" or "<phone>-<chamaJoinCode>".
    bill_ref_number: { type: String, trim: true },

    invoice_number: { type: String, trim: true, default: '' },
    org_account_balance: { type: String, trim: true },
    third_party_trans_id: { type: String, trim: true, default: '' },

    msisdn: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    payer_name: { type: String, trim: true, default: '' },

    // ------------------------------------------------------
    // RECONCILIATION STATE
    // ------------------------------------------------------
    match_status: {
      type: String,
      enum: ['matched', 'unmatched', 'manually_matched'],
      default: 'unmatched',
      index: true,
    },
    match_note: { type: String, trim: true, default: '' },

    matched_chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', default: null },
    matched_membership_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', default: null },
    matched_payment_intent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentIntent', default: null },

    reconciled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reconciled_at: { type: Date, default: null },

    // Full raw ConfirmationURL payload, kept for audit/debugging.
    raw_callback: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

c2bPaymentSchema.index({ match_status: 1, createdAt: -1 });

c2bPaymentSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.amount !== undefined && ret.amount !== null) ret.amount = ret.amount.toString();
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model('C2bPayment', c2bPaymentSchema);
