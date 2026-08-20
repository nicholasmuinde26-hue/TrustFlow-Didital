import mongoose from "mongoose";
const schema = new mongoose.Schema({ chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true }, token: { type: String, required: true, unique: true }, phone: String, role: { type: String, enum: ["member", "treasurer", "secretary", "auditor", "chairperson"], default: "member" }, invited_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, expires_at: { type: Date, required: true }, accepted_at: Date }, { timestamps: true });
export default mongoose.models.ChamaInvitation || mongoose.model("ChamaInvitation", schema);
