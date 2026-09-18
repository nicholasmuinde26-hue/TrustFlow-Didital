import mongoose from "mongoose";

const ChatMessageSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------------
    // CONVERSATION TYPE
    // ---------------------------------------------------------
    // workspace = shared chama/contribution-group chat
    // direct    = 1:1 conversation between two users
    conversation_type: {
      type: String,
      enum: ["workspace", "direct"],
      default: "workspace",
      index: true,
    },

    // ---------------------------------------------------------
    // WORKSPACE CHAT
    // ---------------------------------------------------------
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: function () {
        return this.conversation_type === "workspace";
      },
      index: true,
    },

    workspace_type: {
      type: String,
      enum: ["chama", "contribution-group"],
      required: function () {
        return this.conversation_type === "workspace";
      },
    },

    // ---------------------------------------------------------
    // DIRECT MESSAGE
    // ---------------------------------------------------------
    recipient_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.conversation_type === "direct";
      },
    },

    // Sorted:
    // "<smallerUserId>_<largerUserId>"
    //
    // This gives both users the exact same thread key.
    //
    // Example:
    // User A -> User B
    // B -> A
    //
    // Both produce:
    // A_B
    thread_key: {
      type: String,
      index: true,
    },

    // ---------------------------------------------------------
    // SENDER
    // ---------------------------------------------------------
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ---------------------------------------------------------
    // MESSAGE TYPE
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // MESSAGE CONTENT
    // ---------------------------------------------------------
    message: {
      type: String,
      trim: true,
    },

    // ---------------------------------------------------------
    // ATTACHMENTS
    // ---------------------------------------------------------
    attachments: [
      {
        url: String,
        filename: String,
        size: Number,
        mimeType: String,
      },
    ],

    // ---------------------------------------------------------
    // MESSAGE LIFECYCLE
    // ---------------------------------------------------------
    edited_at: Date,

    deleted_at: Date,
  },
  {
    timestamps: true,
  }
);

// =============================================================
// DIRECT MESSAGE THREAD KEY
// =============================================================
//
// IMPORTANT:
// Do NOT use `next` here.
//
// This is a synchronous pre-validation hook. Mongoose will
// continue after this function returns.
//
// For direct messages:
//
// sender = A
// recipient = B
//
// OR:
//
// sender = B
// recipient = A
//
// Both generate:
//
// A_B
//
// This allows:
//
// ChatMessage.find({
//   conversation_type: "direct",
//   thread_key: "A_B"
// })
//
// without needing an $or query.
// =============================================================

ChatMessageSchema.pre("validate", function () {
  if (
    this.conversation_type === "direct" &&
    this.sender_id &&
    this.recipient_id
  ) {
    const [a, b] = [
      String(this.sender_id),
      String(this.recipient_id),
    ].sort();

    this.thread_key = `${a}_${b}`;
  }
});

// =============================================================
// INDEXES
// =============================================================

// Fast direct-message thread retrieval.
//
// Example:
//
// {
//   thread_key: "...",
//   createdAt: -1
// }
ChatMessageSchema.index({
  thread_key: 1,
  createdAt: -1,
});

// =============================================================
// MODEL
// =============================================================

export default mongoose.model(
  "ChatMessage",
  ChatMessageSchema
);