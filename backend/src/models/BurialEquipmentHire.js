import mongoose from "mongoose";

const equipmentSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  chama_asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", default: null, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  quantity: { type: Number, required: true, min: 1 },
  daily_rate: { type: Number, required: true, min: 0 },
  deposit_amount: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ["active", "maintenance", "retired"], default: "active", index: true },
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const bookingSchema = new mongoose.Schema({
  chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
  equipment_id: { type: mongoose.Schema.Types.ObjectId, ref: "BurialEquipment", required: true, index: true },
  hirer_name: { type: String, required: true, trim: true, maxlength: 120 },
  hirer_phone: { type: String, trim: true, maxlength: 30, default: "" },
  event_date: { type: Date, required: true, index: true },
  due_back_at: { type: Date, required: true, index: true },
  quantity: { type: Number, required: true, min: 1 },
  amount: { type: Number, required: true, min: 0 },
  deposit_amount: { type: Number, default: 0, min: 0 },
  payment_method: { type: String, enum: ["cash", "mpesa", "bank", "unpaid"], default: "unpaid" },
  payment_reference: { type: String, trim: true, maxlength: 120, default: "" },
  financial_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "FinancialTransaction", default: null },
  status: { type: String, enum: ["confirmed", "issued", "returned", "cancelled", "overdue"], default: "confirmed", index: true },
  return_notes: { type: String, trim: true, maxlength: 1000, default: "" },
  issued_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  returned_at: { type: Date, default: null },
}, { timestamps: true });

bookingSchema.index({ chama_id: 1, equipment_id: 1, event_date: 1, due_back_at: 1, status: 1 });

export const BurialEquipment = mongoose.models.BurialEquipment || mongoose.model("BurialEquipment", equipmentSchema);
export const BurialEquipmentBooking = mongoose.models.BurialEquipmentBooking || mongoose.model("BurialEquipmentBooking", bookingSchema);
