import mongoose from "mongoose";

const marketplaceCommissionRuleSchema = new mongoose.Schema(
  {
    category_slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      default: null,
      index: true,
    },
    commission_rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 5, // 5% default platform commission
    },
    fixed_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    min_fee: {
      type: Number,
      default: 0,
      min: 0,
    },
    max_fee: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

marketplaceCommissionRuleSchema.index({ category_slug: 1, business_id: 1 });

export default mongoose.models.MarketplaceCommissionRule ||
  mongoose.model("MarketplaceCommissionRule", marketplaceCommissionRuleSchema);
