import mongoose from "mongoose";

const mpesaAttemptSchema = new mongoose.Schema({
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: "ContributionObligation", required: true, index: true },
  payment_intent_id: { type: mongoose.Schema.Types.ObjectId, ref: "PaymentIntent", default: null, index: true },
  amount: { type: mongoose.Schema.Types.Decimal128, required: true },
  phone_number: { type: String, required: true, index: true },
  initiated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  checkout_request_id: { type: String, unique: true, sparse: true, index: true }, // ADDED index
  merchant_request_id: { type: String, default: null, index: true },
  status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
  mpesa_receipt_number: { type: String, default: null, unique: true, sparse: true }, // sparse so nulls don't collide
}, { timestamps: true });

// Extra compound index for callback lookup
mpesaAttemptSchema.index({ checkout_request_id: 1, status: 1 });

export default mongoose.models.MpesaAttempt || mongoose.model("MpesaAttempt", mpesaAttemptSchema);