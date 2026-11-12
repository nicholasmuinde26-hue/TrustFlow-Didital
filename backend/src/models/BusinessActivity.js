import mongoose from "mongoose";

const businessActivitySchema = new mongoose.Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  actor_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  action: { type: String, required: true },
  detail: { type: String, default: "" },
  status_code: { type: Number, default: 200 },
}, { timestamps: true });

businessActivitySchema.index({ business_id: 1, createdAt: -1 });
export default mongoose.models.BusinessActivity || mongoose.model("BusinessActivity", businessActivitySchema);
