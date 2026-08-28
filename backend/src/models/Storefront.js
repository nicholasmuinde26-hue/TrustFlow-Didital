import mongoose from "mongoose";

const storefrontSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    location_text: {
      type: String,
      default: "Nairobi, Kenya · Usually replies within a day",
      trim: true,
    },
    headline: {
      type: String,
      default: "Fresh stock, fair prices, fast pickup or delivery.",
      trim: true,
    },
    subtitle: {
      type: String,
      default:
        "Everything here is pulled straight from what's actually on our shelf right now — if it's listed, it's in stock.",
      trim: true,
    },
    theme: {
      logo_text: { type: String, default: "JW" },
      primary_color: { type: String, default: "#064e3b" },
      banner_bg: { type: String, default: "#064e3b" },
    },
    badges: {
      type: [String],
      default: [
        "🚚 Delivery in Nairobi",
        "🏬 Store pickup available",
        "💳 M-Pesa · Card · Cash on delivery",
      ],
    },
    status: { type: String, enum: ["live", "paused"], default: "live" },
  },
  { timestamps: true }
);

export default mongoose.models.Storefront || mongoose.model("Storefront", storefrontSchema);
