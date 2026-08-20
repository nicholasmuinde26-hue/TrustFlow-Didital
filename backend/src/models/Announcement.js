import mongoose from "mongoose";

// ========================================
// ANNOUNCEMENT SCHEMA
// ========================================

const announcementSchema = new mongoose.Schema(
  {
    // ========================================
    // WORKSPACE IDENTIFIERS
    // ========================================
    workspace_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    workspace_type: {
      type: String,
      required: true,
      enum: ["chama", "contribution-group", "business"],
      index: true,
    },

    // ========================================
    // BASIC ANNOUNCEMENT FIELDS
    // ========================================
    title: {
      type: String,
      required: [true, "Announcement title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    content: {
      type: String,
      required: [true, "Announcement content is required"],
      trim: true,
      maxlength: [5000, "Content cannot exceed 5000 characters"],
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ========================================
    // PINNING FUNCTIONALITY
    // ========================================
    is_pinned: {
      type: Boolean,
      default: false,
    },
    pinned_at: {
      type: Date,
      default: null,
    },

    // ========================================
    // CHAMA TASTE: TRUST & TRANSPARENCY
    // ========================================
    chama_details: {
      transparency_reason: {
        type: String,
        trim: true,
        default: null,
      },
      financial_impact: {
        type: String,
        trim: true,
        default: null,
      },
      consensus_voted: {
        type: Boolean,
        default: false,
      },
      consensus_link: {
        type: String,
        trim: true,
        default: null,
      },
    },

    // ========================================
    // CONTRIBUTION GROUP TASTE: CLARITY, ACCOUNTABILITY, NO EXCUSES
    // ========================================
    contribution_details: {
      deadline: {
        type: Date,
        default: null,
      },
      penalty_details: {
        type: String,
        trim: true,
        default: null,
      },
      action_items: [
        {
          type: String,
          trim: true,
        },
      ],
      accountability_checklist: [
        {
          type: String,
          trim: true,
        },
      ],
    },

    // ========================================
    // BUSINESS TASTE: DECISIONS, GROWTH, COMPLIANCE
    // ========================================
    business_details: {
      decision_made: {
        type: String,
        trim: true,
        default: null,
      },
      growth_metrics: {
        type: String,
        trim: true,
        default: null,
      },
      compliance_reference: {
        type: String,
        trim: true,
        default: null,
      },
      authorized_by: {
        type: String,
        trim: true,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pinned announcements are sorted first, then by creation date descending
announcementSchema.index({ workspace_id: 1, is_pinned: -1, createdAt: -1 });

export default mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
