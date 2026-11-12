import mongoose from "mongoose";

const contributionSchema = new mongoose.Schema({
  donor_name: { type: String, trim: true, maxlength: 120, default: "" },
  anonymous: { type: Boolean, default: false },
  amount: { type: Number, min: 0.01, required: true },
  method: { type: String, enum: ["cash", "mpesa", "bank"], required: true },
  reference: { type: String, trim: true, maxlength: 120, default: "" },
  status: { type: String, enum: ["pending", "posted", "failed"], default: "pending" },
  financial_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
  received_at: { type: Date, default: Date.now },
  received_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const campaignSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  case_id: { type: mongoose.Schema.Types.ObjectId, ref: "BurialCase", default: null, index: true },
  title: { type: String, required: true, trim: true, minlength: 3, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  target_amount: { type: Number, required: true, min: 1 },
  raised_amount: { type: Number, default: 0, min: 0 },
  deadline: { type: Date, default: null },
  status: { type: String, enum: ["active", "completed", "cancelled"], default: "active", index: true },
  contributions: { type: [contributionSchema], default: [] },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  closed_at: { type: Date, default: null },
}, { timestamps: true });

campaignSchema.index({ chama_id: 1, createdAt: -1 });

export default mongoose.models.BurialFundraisingCampaign || mongoose.model("BurialFundraisingCampaign", campaignSchema);
