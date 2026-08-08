import mongoose from "mongoose";
const schema = new mongoose.Schema({ chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true }, membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaMembership", required: true }, id_number: { type: String, required: true }, selfie_url: { type: String, required: true }, id_document_url: { type: String, required: true }, status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending" }, reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, reviewed_at: Date }, { timestamps: true });
schema.index({ chama_id: 1, membership_id: 1 }, { unique: true });
export default mongoose.models.ChamaMemberKyc || mongoose.model("ChamaMemberKyc", schema);
