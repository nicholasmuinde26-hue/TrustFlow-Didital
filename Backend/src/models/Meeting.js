import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    workspace_type: {
      type: String,
      enum: ["Chama", "ContributionGroup"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    starts_at: {
      type: Date,
      required: true,
      index: true,
    },
    link: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2048,
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

meetingSchema.index({ workspace_id: 1, cancelled_at: 1, starts_at: 1 });

export default mongoose.model("Meeting", meetingSchema);
