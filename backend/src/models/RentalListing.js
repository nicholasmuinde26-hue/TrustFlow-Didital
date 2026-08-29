import mongoose from "mongoose";

const rentalListingSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    listing_type: { type: String, enum: ["room", "plot"], default: "room" },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    location_text: { type: String, default: "", trim: true },
    bedrooms: { type: Number, default: null, min: 0 },
    bathrooms: { type: Number, default: null, min: 0 },
    size_text: { type: String, default: "", trim: true },
    rent_amount: { type: Number, required: true, min: 0 },
    rent_period: { type: String, enum: ["month", "year", "one_time"], default: "month" },
    deposit_amount: { type: Number, default: 0, min: 0 },
    amenities: { type: [String], default: [] },
    // Photos of the room/plot — data URIs or hosted image URLs, capped at 8 per listing
    images: { type: [String], default: [] },
    status: { type: String, enum: ["vacant", "occupied"], default: "vacant", index: true },
    visible_online: { type: Boolean, default: true, index: true },
    // Soft-delete flag so a removed listing stops appearing without breaking
    // any inquiries that already reference it
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

rentalListingSchema.index({ business_id: 1, archived: 1 });
rentalListingSchema.index({ business_id: 1, status: 1 });

export default mongoose.models.RentalListing || mongoose.model("RentalListing", rentalListingSchema);
