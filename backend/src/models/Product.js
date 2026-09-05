import mongoose from "mongoose";

/**
 * PRODUCT CATEGORIES
 * Similar to AliExpress/Jumia category structure
 */
export const PRODUCT_CATEGORIES = [
  // Electronics
  { id: "electronics", name: "Electronics", parent: null },
  { id: "phones", name: "Mobile Phones", parent: "electronics" },
  { id: "laptops", name: "Laptops & Computers", parent: "electronics" },
  { id: "tablets", name: "Tablets", parent: "electronics" },
  { id: "accessories", name: "Electronics Accessories", parent: "electronics" },
  
  // Fashion
  { id: "fashion", name: "Fashion", parent: null },
  { id: "mens_clothing", name: "Men's Clothing", parent: "fashion" },
  { id: "womens_clothing", name: "Women's Clothing", parent: "fashion" },
  { id: "shoes", name: "Shoes", parent: "fashion" },
  { id: "accessories_fashion", name: "Fashion Accessories", parent: "fashion" },
  
  // Home & Living
  { id: "home", name: "Home & Living", parent: null },
  { id: "furniture", name: "Furniture", parent: "home" },
  { id: "kitchen", name: "Kitchen & Dining", parent: "home" },
  { id: "decor", name: "Home Decor", parent: "home" },
  { id: "appliances", name: "Home Appliances", parent: "home" },
  
  // Beauty & Health
  { id: "beauty", name: "Beauty & Health", parent: null },
  { id: "skincare", name: "Skincare", parent: "beauty" },
  { id: "makeup", name: "Makeup", parent: "beauty" },
  { id: "hair_care", name: "Hair Care", parent: "beauty" },
  { id: "health", name: "Health & Wellness", parent: "beauty" },
  
  // Sports & Outdoors
  { id: "sports", name: "Sports & Outdoors", parent: null },
  { id: "fitness", name: "Fitness Equipment", parent: "sports" },
  { id: "outdoor", name: "Outdoor Gear", parent: "sports" },
  { id: "team_sports", name: "Team Sports", parent: "sports" },
  
  // Automotive
  { id: "automotive", name: "Automotive", parent: null },
  { id: "car_parts", name: "Car Parts", parent: "automotive" },
  { id: "motorcycle", name: "Motorcycle Parts", parent: "automotive" },
  { id: "tools", name: "Automotive Tools", parent: "automotive" },
  
  // Groceries
  { id: "groceries", name: "Groceries", parent: null },
  { id: "food", name: "Food & Pantry", parent: "groceries" },
  { id: "beverages", name: "Beverages", parent: "groceries" },
  { id: "household", name: "Household Essentials", parent: "groceries" },
  
  // Other
  { id: "other", name: "Other", parent: null }
];

const productVariantSchema = new mongoose.Schema({
  sku: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  compare_price: { type: Number, min: 0, default: null },
  cost_price: { type: Number, min: 0, default: null },
  stock: { type: Number, required: true, min: 0, default: 0 },
  weight: { type: Number, min: 0, default: null },
  attributes: { type: Map, of: String, default: {} }, // e.g., { "color": "red", "size": "XL" }
}, { _id: false });

const productSchema = new mongoose.Schema({
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },
  
  // Basic Information
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  short_description: { type: String, trim: true, maxlength: 500 },
  
  // Category
  category: { type: String, required: true, enum: PRODUCT_CATEGORIES.map(c => c.id) },
  subcategory: { type: String, default: null },
  tags: { type: [String], default: [] },
  
  // Pricing
  base_price: { type: Number, required: true, min: 0 },
  compare_price: { type: Number, min: 0, default: null },
  cost_price: { type: Number, min: 0, default: null },
  currency: { type: String, default: "KES", uppercase: true },
  
  // Inventory
  stock: { type: Number, required: true, min: 0, default: 0 },
  stock_management: { type: Boolean, default: true },
  low_stock_threshold: { type: Number, min: 0, default: 5 },
  
  // Variants (for products with multiple options like size, color)
  has_variants: { type: Boolean, default: false },
  variants: [productVariantSchema],
  
  // Images
  images: { type: [String], default: [] },
  thumbnail: { type: String, default: null },
  
  // Weight & Dimensions
  weight: { type: Number, min: 0, default: null },
  dimensions: {
    length: { type: Number, min: 0, default: null },
    width: { type: Number, min: 0, default: null },
    height: { type: Number, min: 0, default: null },
    unit: { type: String, default: "cm" }
  },
  
  // Shipping
  shipping_required: { type: Boolean, default: true },
  shipping_weight: { type: Number, min: 0, default: null },
  shipping_class: { type: String, default: "standard" },
  
  // SEO
  slug: { type: String, unique: true, lowercase: true, trim: true },
  meta_title: { type: String, trim: true, maxlength: 60 },
  meta_description: { type: String, trim: true, maxlength: 160 },
  
  // Status
  status: { type: String, enum: ["draft", "active", "archived"], default: "draft", index: true },
  visibility: { type: String, enum: ["public", "private"], default: "public", index: true },
  
  // Featured
  is_featured: { type: Boolean, default: false, index: true },
  featured_order: { type: Number, default: 0 },
  
  // Reviews & Ratings
  rating: { type: Number, min: 0, max: 5, default: 0 },
  review_count: { type: Number, min: 0, default: 0 },
  
  // Sales
  sales_count: { type: Number, min: 0, default: 0 },
  view_count: { type: Number, min: 0, default: 0 },
  
  // Timestamps
  created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

// Indexes for search and filtering
productSchema.index({ business_id: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, visibility: 1, is_featured: 1 });
productSchema.index({ title: "text", description: "text", tags: "text" });
productSchema.index({ created_at: -1 });
productSchema.index({ sales_count: -1 });
productSchema.index({ rating: -1 });

export default mongoose.models.Product || mongoose.model("Product", productSchema);