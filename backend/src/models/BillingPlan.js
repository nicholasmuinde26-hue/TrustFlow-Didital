import mongoose from 'mongoose';

// What the platform sells. Seeded from DEFAULT_PLANS once; after that the
// database copy is authoritative so a price can change without a deploy.
const billingPlanSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    tagline: { type: String, default: '', trim: true },
    price_monthly: { type: Number, required: true, min: 0 }, // whole KES
    max_members: { type: Number, default: null, min: 1 }, // null = unlimited
    modules: { type: [String], default: [] },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.BillingPlan || mongoose.model('BillingPlan', billingPlanSchema);
