import mongoose from "mongoose";

const businessTransactionSchema = new mongoose.Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  type: { type: String, enum: ["sale", "expense", "customer_payout"], required: true },
  direction: { type: String, enum: ["cash_in", "cash_out"], required: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 },
  currency: { type: String, default: "KES", uppercase: true },
  payment_channel: { type: String, enum: ["cash", "bank", "till", "paybill", "mpesa"], required: true },
  status: { type: String, enum: ["pending", "completed", "failed"], default: "completed", index: true },
  description: { type: String, default: "", trim: true, maxlength: 500 },
  customer_name: { type: String, default: null, trim: true },
  customer_phone: { type: String, default: null, trim: true },
  external_reference: { type: String, default: null, trim: true, index: true },
  checkout_request_id: { type: String, default: null, sparse: true, unique: true },
  mpesa_receipt_number: { type: String, default: null, sparse: true, unique: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

businessTransactionSchema.index({ business_id: 1, createdAt: -1 });
businessTransactionSchema.set("toJSON", { transform: (_doc, value) => {
  if (value.amount) value.amount = value.amount.toString();
  return value;
} });

export default mongoose.models.BusinessTransaction || mongoose.model("BusinessTransaction", businessTransactionSchema);