import mongoose from "mongoose";

const rentalInquirySchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    listing_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RentalListing",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    phone: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true, maxlength: 500 },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new", index: true },
  },
  { timestamps: true }
);

rentalInquirySchema.index({ business_id: 1, status: 1 });

export default mongoose.models.RentalInquiry || mongoose.model("RentalInquiry", rentalInquirySchema);
