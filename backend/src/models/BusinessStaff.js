import mongoose from "mongoose";

const businessStaffSchema = new mongoose.Schema({
  business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["manager", "cashier", "inventory", "accountant"], default: "cashier" },
  permissions: { type: [String], default: [] },
  status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
  appointed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

businessStaffSchema.index({ business_id: 1, user_id: 1 }, { unique: true });
export default mongoose.models.BusinessStaff || mongoose.model("BusinessStaff", businessStaffSchema);
