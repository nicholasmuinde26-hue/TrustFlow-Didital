import mongoose from "mongoose";

const businessItemSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sku: { type: String, trim: true, default: "" },
    category: { type: String, default: "General", trim: true },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    price: { type: Number, required: true, min: 0 },
    online_price: { type: Number, default: null, min: 0 },
    cost_price: { type: Number, default: 0, min: 0 },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    // false for things like services/menu items that aren't counted as
    // physical stock — quantity is ignored and they're always orderable
    track_stock: { type: Boolean, default: true },
    visible_online: { type: Boolean, default: true, index: true },
    icon: { type: String, default: "📦" },
    image_url: { type: String, default: "" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
  },
  { timestamps: true }
);

businessItemSchema.index({ business_id: 1, visible_online: 1 });
businessItemSchema.index({ business_id: 1, category: 1 });

export default mongoose.models.BusinessItem || mongoose.model("BusinessItem", businessItemSchema);