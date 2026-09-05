import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variant_sku: { type: String, default: null }, // If product has variants
  quantity: { type: Number, required: true, min: 1, default: 1 },
  price: { type: Number, required: true, min: 0 }, // Captured at add time
  name: { type: String, required: true }, // Captured at add time
  thumbnail: { type: String, default: null },
  attributes: { type: Map, of: String, default: {} } // e.g., { "color": "red", "size": "XL" }
}, { _id: false });

const shoppingCartSchema = new mongoose.Schema({
  // For authenticated users
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
    sparse: true
  },
  
  // For guest users (session-based)
  session_id: {
    type: String,
    index: true,
    sparse: true
  },
  
  // Business context (optional - for multi-vendor carts)
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    default: null
  },
  
  // Cart items
  items: [cartItemSchema],
  
  // Calculated totals
  subtotal: { type: Number, default: 0, min: 0 },
  discount_amount: { type: Number, default: 0, min: 0 },
  tax_amount: { type: Number, default: 0, min: 0 },
  shipping_amount: { type: Number, default: 0, min: 0 },
  total: { type: Number, default: 0, min: 0 },
  
  // Currency
  currency: { type: String, default: "KES", uppercase: true },
  
  // Discount code
  discount_code: { type: String, default: null },
  discount_percentage: { type: Number, default: 0, min: 0, max: 100 },
  
  // Cart status
  status: { type: String, enum: ["active", "abandoned", "converted"], default: "active", index: true },
  
  // Timestamps
  expires_at: { type: Date, default: null }, // For guest carts
  last_activity_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Indexes
shoppingCartSchema.index({ user_id: 1, status: 1 });
shoppingCartSchema.index({ session_id: 1, status: 1 });
shoppingCartSchema.index({ expires_at: 1 }, { sparse: true });

export default mongoose.models.ShoppingCart || mongoose.model("ShoppingCart", shoppingCartSchema);