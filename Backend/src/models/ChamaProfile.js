import mongoose from "mongoose";

const chamaProfileSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", unique: true, required: true },
  constitution_url: { type: String, default: null },
  contribution_cycle: { type: String, enum: ["weekly", "monthly", "quarterly"], default: "monthly" },
  fine_amount: { type: Number, default: 0, min: 0 },
  loan_policy: { min_savings_months: { type: Number, default: 3 }, max_multiple: { type: Number, default: 3 }, interest_rate: { type: Number, default: 0 }, repayment_months: { type: Number, default: 6 } },
  meeting_day: { type: String, default: null },
  approval_threshold: { type: Number, default: 20000 },
  required_payout_approvals: { type: Number, default: 2, min: 1, max: 3 },
  mpesa_shortcode: { type: String, default: null }, mpesa_account_reference: { type: String, default: null },
  bank_name: { type: String, default: null }, bank_account_name: { type: String, default: null }, bank_account_number: { type: String, default: null },
}, { timestamps: true });
export default mongoose.models.ChamaProfile || mongoose.model("ChamaProfile", chamaProfileSchema);
