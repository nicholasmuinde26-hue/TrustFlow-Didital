import mongoose from "mongoose";

const productReviewSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
    index: true
  },
  business_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Business",
    required: true,
    index: true
  },
  
  // Reviewer information (no account required for public storefront)
  customer_name: { type: String, required: true, trim: true, maxlength: 100 },
  customer_email: { type: String, trim: true, maxlength: 100 },
  customer_phone: { type: String, trim: true, maxlength: 20 },
  
  // Review content
  rating: { type: Number, required: true, min: 1, max: 5 },
  title: { type: String, trim: true, maxlength: 100 },
  comment: { type: String, required: true, trim: true, maxlength: 1000 },
  
  // Photos (optional)
  images: { type: [String], default: [] },
  
  // Helpful votes
  helpful_count: { type: Number, min: 0, default: 0 },
  
  // Verified purchase
  verified_purchase: { type: Boolean, default: false },
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "BusinessTransaction" },
  
  // Status
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
  
  // Admin response
  seller_response: { type: String, trim: true, maxlength: 1000 },
  seller_response_date: { type: Date },
  
  // Timestamps
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { timestamps: false });

// Indexes
productReviewSchema.index({ product_id: 1, status: 1 });
productReviewSchema.index({ business_id: 1, status: 1 });
productReviewSchema.index({ rating: -1 });
productReviewSchema.index({ helpful_count: -1 });
productReviewSchema.index({ created_at: -1 });

export default mongoose.models.ProductReview || mongoose.model("ProductReview", productReviewSchema);