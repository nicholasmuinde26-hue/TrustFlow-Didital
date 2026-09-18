import mongoose from "mongoose";

const subcategorySchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    icon: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const marketplaceCategorySchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    tagline: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    icon: {
      type: String,
      default: "Store",
    },
    hero_title: {
      type: String,
      default: "",
      trim: true,
    },
    hero_subtitle: {
      type: String,
      default: "",
      trim: true,
    },
    hero_banner_image: {
      type: String,
      default: "",
    },
    theme_color: {
      type: String,
      default: "#4f46e5",
    },
    theme_gradient: {
      type: String,
      default: "from-indigo-900 via-slate-900 to-violet-950",
    },
    subcategories: [subcategorySchema],
    filter_keys: {
      type: [String],
      default: ["price", "in_stock", "location"],
    },
    featured_collections: [
      {
        name: { type: String, required: true },
        tag: { type: String, required: true },
        badge_color: { type: String, default: "emerald" },
      },
    ],
    announcement_banner: {
      text: { type: String, default: "" },
      link: { type: String, default: "" },
      is_active: { type: Boolean, default: false },
    },
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.models.MarketplaceCategory ||
  mongoose.model("MarketplaceCategory", marketplaceCategorySchema);
