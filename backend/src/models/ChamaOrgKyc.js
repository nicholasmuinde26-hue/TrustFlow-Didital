import mongoose from "mongoose";

// ========================================
// CHAMA (ORGANISATION) KYC
// ========================================
//
// Member KYC (ChamaMemberKyc) proves WHO a person is. This proves WHAT the
// group is: its registration details and that its officials are authorised
// to act for it. One record per Chama, submitted by the chairperson and
// reviewed by the platform's admin team (the Chama cannot approve itself).
// A verified record puts a "Verified group" mark on the public profile.
//
// ========================================

export const ORG_REGISTRATION_TYPES = ["self_help_group", "cbo", "sacco", "society", "company", "informal", "other"];

const schema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, unique: true },
  legal_name: { type: String, required: true, trim: true, maxlength: 160 },
  registration_type: { type: String, enum: ORG_REGISTRATION_TYPES, required: true },
  registration_number: { type: String, default: "", trim: true, maxlength: 60 },
  kra_pin: { type: String, default: "", trim: true, maxlength: 20 },
  physical_address: { type: String, default: "", trim: true, maxlength: 240 },
  contact_phone: { type: String, default: "", trim: true, maxlength: 20 },
  certificate_url: { type: String, default: null, select: false },
  officials_confirmed: { type: Boolean, default: false },
  status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
  rejection_reason: { type: String, default: "", maxlength: 500 },
  submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  submitted_at: { type: Date, default: Date.now },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at: { type: Date, default: null },
}, { timestamps: true });

export default mongoose.models.ChamaOrgKyc || mongoose.model("ChamaOrgKyc", schema);
