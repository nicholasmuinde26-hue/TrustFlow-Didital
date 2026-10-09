import mongoose from 'mongoose';

// One row per chama. `status` is what was last recorded; what the chama can
// actually do right now is derived from the dates (computeAccess), so a
// lapsed subscription locks itself without waiting for a job to run.
const subscriptionSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Chama', required: true, unique: true },
    plan_code: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ['trialing', 'active'], required: true },
    trial_started_at: { type: Date, default: null },
    trial_ends_at: { type: Date, default: null },
    current_period_start: { type: Date, default: null },
    current_period_end: { type: Date, default: null },
    last_paid_at: { type: Date, default: null },
    // Per-group monthly price for specific plans, set by the platform admin
    // (e.g. { standard: 10 }). A plan with no entry uses the list price.
    price_overrides: { type: Map, of: Number, default: undefined },
    last_invoice_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    // Access given by platform support without a payment (extensions, comps,
    // plan overrides). Kept apart from invoices so it never counts as revenue.
    support_grants: {
      type: [{
        kind: { type: String, enum: ['extend', 'comp', 'plan_change'], required: true },
        plan_code: { type: String, default: null },
        days: { type: Number, default: null },
        months: { type: Number, default: null },
        reason: { type: String, required: true },
        granted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        granted_at: { type: Date, default: Date.now },
        access_until_after: { type: Date, default: null },
      }],
      default: [],
    },
  },
  { timestamps: true }
);

subscriptionSchema.index({ current_period_end: 1 });

export default mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
