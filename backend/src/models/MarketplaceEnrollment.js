import mongoose from "mongoose";

const marketplaceEnrollmentSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    category_slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
      index: true,
    },
    merchant_profile: {
      display_name: { type: String, trim: true, default: "" },
      tagline: { type: String, trim: true, default: "" },
      description: { type: String, trim: true, default: "" },
      logo_url: { type: String, default: "" },
      banner_url: { type: String, default: "" },
      phone: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, default: "" },
      physical_location: { type: String, trim: true, default: "" },
      return_policy: { type: String, trim: true, default: "" },
      delivery_info: { type: String, trim: true, default: "" },
      badges: {
        type: [String],
        default: ["Verified Merchant"],
      },
    },
    applied_at: {
      type: Date,
      default: Date.now,
    },
    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewed_at: {
      type: Date,
      default: null,
    },
    review_notes: {
      type: String,
      default: "",
      trim: true,
    },
    rejection_reason: {
      type: String,
      default: "",
      trim: true,
    },
    custom_commission_rate: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
  },
  { timestamps: true }
);

marketplaceEnrollmentSchema.index({ business_id: 1, category_slug: 1 }, { unique: true });

export default mongoose.models.MarketplaceEnrollment ||
  mongoose.model("MarketplaceEnrollment", marketplaceEnrollmentSchema);
