import mongoose from "mongoose";

const marketplaceListingSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    category_slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source_type: {
      type: String,
      enum: ["Product", "RentalListing", "BusinessItem"],
      default: "Product",
      index: true,
    },
    source_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },
    short_description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },
    compare_price: {
      type: Number,
      min: 0,
      default: null,
    },
    currency: {
      type: String,
      default: "KES",
      uppercase: true,
      trim: true,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    track_stock: {
      type: Boolean,
      default: true,
    },
    images: {
      type: [String],
      default: [],
    },
    thumbnail: {
      type: String,
      default: "",
    },
    subcategory: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    // Category-specific details
    rental_attributes: {
      listing_type: { type: String, default: "apartment" },
      property_type: { type: String, default: "Apartment" },
      bedrooms: { type: Number, default: null },
      bathrooms: { type: Number, default: null },
      rent_period: { type: String, default: "month" },
      deposit_amount: { type: Number, default: 0 },
      area_sqm: { type: Number, default: null },
      floor: { type: String, default: "" },
      year_built: { type: Number, default: null },
      pets_allowed: { type: Boolean, default: false },
      parking_spaces: { type: Number, default: 0 },
      furnished: { type: Boolean, default: false },
      is_occupied: { type: Boolean, default: false },
      amenities: { type: [String], default: [] },
      location_text: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "Nairobi" },
      neighborhood: { type: String, default: "" },
      coordinates: {
        lat: { type: Number, default: -1.2921 },
        lng: { type: Number, default: 36.8219 },
      },
      agent: {
        name: { type: String, default: "" },
        role: { type: String, default: "Property Manager" },
        phone: { type: String, default: "" },
        whatsapp: { type: String, default: "" },
        avatar: { type: String, default: "" },
        verified: { type: Boolean, default: true },
        rating: { type: Number, default: 4.9 },
        reviews_count: { type: Number, default: 24 },
        experience_years: { type: Number, default: 4 },
        active_ads_count: { type: Number, default: 8 },
      },
      room_breakdown: [
        {
          room_name: { type: String, default: "" },
          image_url: { type: String, default: "" },
          area_sqm: { type: Number, default: null },
          description: { type: String, default: "" },
        },
      ],
    },
    service_attributes: {
      duration_minutes: { type: Number, default: 60 },
      service_mode: { type: String, default: "on_site" },
      service_area: { type: String, default: "" },
    },
    food_attributes: {
      cuisine_type: { type: String, default: "" },
      is_vegetarian: { type: Boolean, default: false },
      preparation_time_minutes: { type: Number, default: 20 },
    },
    // Moderation & publishing workflow
    moderation_status: {
      type: String,
      enum: ["draft", "pending", "approved", "rejected", "changes_requested"],
      default: "pending",
      index: true,
    },
    moderated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    moderated_at: {
      type: Date,
      default: null,
    },
    moderation_notes: {
      type: String,
      default: "",
      trim: true,
    },
    visibility: {
      type: String,
      enum: ["public", "unlisted", "archived"],
      default: "public",
      index: true,
    },
    is_featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    featured_rank: {
      type: Number,
      default: 0,
    },
    sales_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    view_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    review_count: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

marketplaceListingSchema.index({ category_slug: 1, moderation_status: 1, visibility: 1 });
marketplaceListingSchema.index({ business_id: 1, moderation_status: 1 });
marketplaceListingSchema.index({ title: "text", description: "text", tags: "text" });

export default mongoose.models.MarketplaceListing ||
  mongoose.model("MarketplaceListing", marketplaceListingSchema);
