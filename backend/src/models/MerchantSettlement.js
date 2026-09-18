import mongoose from "mongoose";

const merchantSettlementSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceOrder",
      required: true,
      index: true,
    },
    order_number: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    gross_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    platform_commission: {
      type: Number,
      default: 0,
      min: 0,
    },
    delivery_allocation: {
      type: Number,
      default: 0,
      min: 0,
    },
    net_settlement_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "KES",
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["pending", "cleared", "ready_for_payout", "paid", "held"],
      default: "pending",
      index: true,
    },
    cleared_at: {
      type: Date,
      default: null,
    },
    paid_at: {
      type: Date,
      default: null,
    },
    payout_reference: {
      type: String,
      default: null,
      trim: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { timestamps: true }
);

merchantSettlementSchema.index({ business_id: 1, status: 1 });
merchantSettlementSchema.index({ business_id: 1, createdAt: -1 });

export default mongoose.models.MerchantSettlement ||
  mongoose.model("MerchantSettlement", merchantSettlementSchema);
