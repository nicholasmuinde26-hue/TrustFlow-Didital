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
platformInquirySchema.pre('save', async function (next) {
  if (!this.inquiryNumber) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.inquiryNumber = `INQ-${randomSuffix}`;
  }
  next();
});

export default mongoose.models.PlatformInquiry ||
  mongoose.model('PlatformInquiry', platformInquirySchema);
