import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    listing_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceListing",
      required: true,
    },
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    line_total: { type: Number, required: true, min: 0 },
    commission_rate: { type: Number, default: 0 },
    commission_amount: { type: Number, default: 0 },
    net_settlement_amount: { type: Number, default: 0 },
    fulfillment_status: {
      type: String,
      enum: ["pending", "processing", "fulfilled", "cancelled"],
      default: "pending",
    },
    delivery_fee_allocation: { type: Number, default: 0 },
  },
  { _id: true }
);

const merchantAllocationSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
    },
    business_name: { type: String, default: "" },
    subtotal: { type: Number, default: 0 },
    delivery_fee: { type: Number, default: 0 },
    commission_amount: { type: Number, default: 0 },
    net_amount: { type: Number, default: 0 },
    settlement_status: {
      type: String,
      enum: ["pending", "cleared", "paid"],
      default: "pending",
    },
    fulfillment_status: {
      type: String,
      enum: ["pending", "processing", "fulfilled", "cancelled"],
      default: "pending",
    },
  },
  { _id: false }
);

const marketplaceOrderSchema = new mongoose.Schema(
  {
    order_number: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    buyer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    customer_name: { type: String, required: true, trim: true },
    customer_phone: { type: String, required: true, trim: true, index: true },
    customer_email: { type: String, default: "", trim: true },
    delivery_address: { type: String, default: "Store Pickup", trim: true },
    fulfillment_type: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    items: [orderItemSchema],
    merchant_allocations: [merchantAllocationSchema],
    is_multi_merchant: { type: Boolean, default: false },
    subtotal: { type: Number, required: true, min: 0 },
    total_delivery_fee: { type: Number, default: 0, min: 0 },
    total_commission_fee: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    payment_method: {
      type: String,
      enum: ["mpesa", "card", "cash_on_delivery"],
      default: "mpesa",
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    checkout_request_id: { type: String, default: null },
    mpesa_receipt_number: { type: String, default: null },
  },
  { timestamps: true }
);

marketplaceOrderSchema.index({ "items.business_id": 1, createdAt: -1 });

export default mongoose.models.MarketplaceOrder ||
  mongoose.model("MarketplaceOrder", marketplaceOrderSchema);
