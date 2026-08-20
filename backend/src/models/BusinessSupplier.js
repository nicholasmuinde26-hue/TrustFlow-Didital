import mongoose from "mongoose";

const businessSupplierSchema = new mongoose.Schema(
  {
    business_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    contact_person: {
      type: String,
      default: null,
      trim: true,
    },
    payout_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_paid_out: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    is_auto_registered: {
      type: Boolean,
      default: false,
      index: true,
    },
    last_payout_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

businessSupplierSchema.index({ business_id: 1, phone: 1 });
businessSupplierSchema.index({ business_id: 1, name: 1 });

businessSupplierSchema.set("toJSON", {
  transform: (_doc, ret) => {
    if (ret.total_paid_out !== undefined && ret.total_paid_out !== null) {
      ret.total_paid_out = ret.total_paid_out.toString();
    }
    return ret;
  },
});

export default mongoose.models.BusinessSupplier ||
  mongoose.model("BusinessSupplier", businessSupplierSchema);
