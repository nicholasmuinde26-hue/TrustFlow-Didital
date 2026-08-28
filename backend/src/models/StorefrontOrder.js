import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    item_id: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessItem", required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const storefrontOrderSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    storefront_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Storefront",
      required: true,
      index: true,
    },
    order_code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    channel: { type: String, default: "online" },
    customer_name: { type: String, required: true, trim: true },
    customer_phone: { type: String, required: true, trim: true, index: true },
    customer_email: { type: String, default: "", trim: true },
    delivery_address: { type: String, default: "Store Pickup", trim: true },
    fulfillment_type: {
      type: String,
      enum: ["delivery", "pickup"],
      default: "delivery",
    },
    fulfillment_status: {
      type: String,
      enum: ["pending", "processing", "fulfilled", "cancelled"],
      default: "pending",
      index: true,
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    delivery_fee: { type: Number, default: 0, min: 0 },
    total_amount: { type: Number, required: true, min: 0 },
    payment_method: {
      type: String,
      enum: ["mpesa", "card", "cash_on_delivery"],
      default: "mpesa",
    },
    payment_status: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    checkout_request_id: { type: String, default: null },
    mpesa_receipt_number: { type: String, default: null },
  },
  { timestamps: true }
);

storefrontOrderSchema.index({ business_id: 1, createdAt: -1 });

export default mongoose.models.StorefrontOrder ||
  mongoose.model("StorefrontOrder", storefrontOrderSchema);
