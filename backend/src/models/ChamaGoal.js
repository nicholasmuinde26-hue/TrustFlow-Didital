import mongoose from "mongoose";
const schema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", default: null, index: true },
  name: { type: String, required: true, trim: true },
  target_amount: { type: Number, required: true, min: 1 },
  saved_amount: { type: Number, default: 0, min: 0 },
  target_date: Date,
  break_even_date: { type: Date, default: null },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["active", "completed", "archived"], default: "active" }
}, { timestamps: true });
export default mongoose.models.ChamaGoal || mongoose.model("ChamaGoal", schema);
