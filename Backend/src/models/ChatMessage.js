import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    workspace_type: {
      type: String,
      enum: ["chama", "contribution-group"],
      required: true,
    },

    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "text",
        "image",
        "file",
        "system",
      ],
      default: "text",
    },

    message: {
      type: String,
      trim: true,
    },

    attachments: [
      {
        url: String,
        filename: String,
        size: Number,
        mimeType: String,
      },
    ],

    edited_at: Date,

    deleted_at: Date,
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "ChatMessage",
  ChatMessageSchema
);