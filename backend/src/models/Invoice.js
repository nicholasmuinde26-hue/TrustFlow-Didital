import mongoose from 'mongoose';

// One STK attempt against an invoice. Safaricom's callback is matched to the
// invoice through checkout_request_id.
const attemptSchema = new mongoose.Schema(
  {
    checkout_request_id: { type: String, default: null },
    merchant_request_id: { type: String, default: null },
    phone: { type: String, default: null },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled', 'duplicate'],
      default: 'pending',
    },
    mpesa_receipt: { type: String, default: null },
    result_desc: { type: String, default: null },
    initiated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, _id: true }
);

// What a chama owes the PLATFORM for the software. Separate from member
// contributions: nothing here is posted to a chama's ledger.
const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, index: true },
    plan_code: { type: String, required: true },
    plan_name: { type: String, required: true },
    months: { type: Number, required: true },
    base_amount: { type: Number, required: true, min: 0 }, // price for the months, before credit
    credit: { type: Number, default: 0, min: 0 }, // unused value of the old plan
    amount: { type: Number, required: true, min: 0 }, // what is actually charged (KES)
    currency: { type: String, default: 'KES' },
    status: { type: String, enum: ['open', 'paid', 'void'], default: 'open', index: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paid_at: { type: Date, default: null },
    period_start: { type: Date, default: null }, // filled in when paid
    period_end: { type: Date, default: null },
    mpesa_receipt: { type: String, default: null },
    needs_review: { type: Boolean, default: false }, // e.g. paid twice
    // How a flagged payment was settled by a human. Kept after needs_review
    // clears so there is always a record of who decided what.
    review: {
      type: {
        resolution: { type: String, enum: ['marked_paid', 'refunded', 'credited', 'dismissed'] },
        note: { type: String, default: '' },
        reference: { type: String, default: null }, // refund / reversal reference
        resolved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        resolved_at: { type: Date },
      },
      default: undefined,
    },
    attempts: { type: [attemptSchema], default: [] },
  },
  { timestamps: true }
);

invoiceSchema.index({ 'attempts.checkout_request_id': 1 });
invoiceSchema.index({ status: 1, paid_at: -1 });

export default mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);
