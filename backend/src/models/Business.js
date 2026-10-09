import mongoose from "mongoose";

export const BUSINESS_CATEGORIES = ["retail", "rental", "restaurant", "service", "other"];

const businessSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  owner_type: { type: String, enum: ["user", "chama"], default: "user", index: true },
  owner_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
  chama_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", default: null, index: true },
  workspace_request_id: { type: mongoose.Schema.Types.ObjectId, ref: "WorkspaceRequest", default: null, index: true },
  workspace_settings: {
    enabled_sections: {
      type: [String],
      enum: ["overview", "operations", "people", "finance", "statements", "reports", "settings"],
      default: ["overview", "operations", "people", "finance", "statements", "reports", "settings"],
    },
  },
  category: { type: String, enum: BUSINESS_CATEGORIES, default: "other", trim: true },
  // Free-text label kept for display/back-compat (e.g. "Hardware & Construction")
  category_label: { type: String, default: "", trim: true },
  marketplace_paused: { type: Boolean, default: false, index: true },
  // Public URL segment for the business page inside the VeriCircle marketplace
  marketplace_slug: { type: String, lowercase: true, trim: true, unique: true, sparse: true, index: true },
  currency: { type: String, default: "KES", uppercase: true, trim: true },
  location: { type: String, default: null, trim: true },
  fiscal_year_start: { type: String, default: "January", trim: true },
  tax_settings: {
    vat_registered: { type: Boolean, default: false },
    vat_rate: { type: Number, default: 16 },
    tax_id: { type: String, default: null, trim: true },
  },
  mpesa_till: { type: String, default: null, trim: true },
  mpesa_paybill: { type: String, default: null, trim: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
}, { timestamps: true });

export default mongoose.models.Business || mongoose.model("Business", businessSchema);
