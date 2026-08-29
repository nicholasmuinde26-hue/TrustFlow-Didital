import mongoose from "mongoose";

export const BUSINESS_CATEGORIES = ["retail", "rental", "restaurant", "service", "other"];

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  category: { type: String, enum: BUSINESS_CATEGORIES, default: "other", trim: true },
  // Free-text label kept for display/back-compat (e.g. "Hardware & Construction")
  category_label: { type: String, default: "", trim: true },
  currency: { type: String, default: "KES", uppercase: true, trim: true },
  mpesa_till: { type: String, default: null, trim: true },
  mpesa_paybill: { type: String, default: null, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
}, { timestamps: true });

export default mongoose.models.Business || mongoose.model("Business", businessSchema);