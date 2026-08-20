import mongoose from "mongoose";

const businessCustomerSchema = new mongoose.Schema(
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
    transaction_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    total_spent: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    is_auto_registered: {
      type: Boolean,
      default: false,
      index: true,
    },
    last_transaction_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

businessCustomerSchema.index({ business_id: 1, phone: 1 });
businessCustomerSchema.index({ business_id: 1, email: 1 });

businessCustomerSchema.set("toJSON", {
  transform: (_doc, ret) => {
    if (ret.total_spent !== undefined && ret.total_spent !== null) {
      ret.total_spent = ret.total_spent.toString();
    }
    return ret;
  },
});

export default mongoose.models.BusinessCustomer ||
  mongoose.model("BusinessCustomer", businessCustomerSchema);
