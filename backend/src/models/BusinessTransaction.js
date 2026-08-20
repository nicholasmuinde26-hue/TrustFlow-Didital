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
  checkout_request_id: { type: String, sparse: true, unique: true },
  mpesa_receipt_number: { type: String, sparse: true, unique: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

// Pre-save hook to ensure null or empty values are converted to undefined, preventing sparse index duplicate key errors in MongoDB
businessTransactionSchema.pre("save", function () {
  if (this.checkout_request_id === null || this.checkout_request_id === "") {
    this.checkout_request_id = undefined;
  }
  if (this.mpesa_receipt_number === null || this.mpesa_receipt_number === "") {
    this.mpesa_receipt_number = undefined;
  }
});

businessTransactionSchema.index({ business_id: 1, createdAt: -1 });
businessTransactionSchema.set("toJSON", { transform: (_doc, value) => {
  if (value.amount) value.amount = value.amount.toString();
  return value;
} });

const BusinessTransaction = mongoose.models.BusinessTransaction || mongoose.model("BusinessTransaction", businessTransactionSchema);

// Safely drop index if legacy MongoDB collection has conflicting non-sparse null index entries
if (BusinessTransaction.collection) {
  BusinessTransaction.collection.dropIndex("mpesa_receipt_number_1").catch(() => {});
  BusinessTransaction.collection.dropIndex("checkout_request_id_1").catch(() => {});
}

export default BusinessTransaction;