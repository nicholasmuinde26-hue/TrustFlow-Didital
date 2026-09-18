import mongoose from 'mongoose';

const platformInquirySchema = new mongoose.Schema(
  {
    inquiryNumber: {
      type: String,
      unique: true,
      index: true,
    },

    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    workspaceType: {
      type: String,
      enum: ['chama', 'business', 'contribution_group'],
      required: true,
      index: true,
    },

    workspaceName: {
      type: String,
      required: true,
      trim: true,
    },

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    senderName: {
      type: String,
      trim: true,
      default: 'Workspace Member',
    },

    senderRole: {
      type: String,
      trim: true,
      default: 'member',
    },

    senderPhone: {
      type: String,
      trim: true,
      default: '',
    },

    senderEmail: {
      type: String,
      trim: true,
      default: '',
    },

    subject: {
      type: String,
      required: [true, 'Inquiry subject is required'],
      trim: true,
      maxlength: 200,
    },

    category: {
      type: String,
      enum: [
        'general_inquiry',
        'discrepancy_report',
        'technical_issue',
        'account_help',
        'governance_support',
        'other',
      ],
      default: 'general_inquiry',
      index: true,
    },

    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },

    message: {
      type: String,
      required: [true, 'Inquiry message details are required'],
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },

    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },

    responses: [
      {
        sender: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        senderName: {
          type: String,
          trim: true,
        },
        isAdmin: {
          type: Boolean,
          default: false,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 2000,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate sequential / formatted inquiryNumber (e.g. INQ-654321)
// NOTE: declared with ZERO parameters on purpose. Mongoose decides whether a
// hook is callback-style (needs `next()`) or promise/sync-style by inspecting
// the function's declared arity. Taking a `next` param at all — even in a
// plain non-async function — puts you at the mercy of that detection, and it
// can misfire in some setups ("next is not a function" even though the
// function isn't async). Since this hook does no async work, dropping the
// parameter entirely removes the ambiguity: Mongoose just runs it and moves
// on once it returns. No `next()` call needed, ever.
platformInquirySchema.pre('save', function () {
  if (!this.inquiryNumber) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.inquiryNumber = `INQ-${randomSuffix}`;
  }
});

export default mongoose.models.PlatformInquiry ||
  mongoose.model('PlatformInquiry', platformInquirySchema);