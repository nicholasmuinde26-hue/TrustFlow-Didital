import mongoose from 'mongoose';

const workspaceRequestSchema = new mongoose.Schema(
  {
    requestNumber: {
      type: String,
      unique: true,
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    entityType: {
      type: String,
      enum: ['chama', 'business', 'contribution_group'],
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },

    description: {
      type: String,
      trim: true,
      default: '',
    },

    category: {
      type: String,
      trim: true,
      default: 'standard',
    },

    monthlySavings: {
      type: Number,
      default: 1000,
    },

    // Detailed metadata for Kenyan Chamas and organizations
    details: {
      registrationType: { type: String, trim: true, default: 'Self-Help Group' }, // Self-Help Group, CBO, Welfare Society, Informal Table Banking
      county: { type: String, trim: true, default: '' },
      subCounty: { type: String, trim: true, default: '' },
      location: { type: String, trim: true, default: '' },
      physicalAddress: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      yearEstablished: { type: String, trim: true, default: '' },
      purpose: { type: String, trim: true, default: '' },
      memberCount: { type: Number, default: 0 },
      meetingFrequency: { type: String, trim: true, default: 'Monthly' }, // Weekly, Bi-Weekly, Monthly, Quarterly
      contributionFrequency: { type: String, trim: true, default: 'Monthly' },
    },

    // Dedicated Leadership Section
    chairperson: {
      fullName: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      idNumber: { type: String, trim: true, default: '' }, // National ID / Reference
    },

    treasurer: {
      fullName: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      idNumber: { type: String, trim: true, default: '' },
    },

    secretary: {
      fullName: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, default: '' },
      idNumber: { type: String, trim: true, default: '' },
    },

    // Dynamic Committee Members (Configurable roles)
    committeeMembers: [
      {
        role: { type: String, trim: true, default: 'Committee Member' }, // e.g. Vice Chairperson, Organizing Secretary, Committee Member
        fullName: { type: String, trim: true, default: '' },
        phone: { type: String, trim: true, default: '' },
        email: { type: String, trim: true, default: '' },
        idNumber: { type: String, trim: true, default: '' },
      },
    ],

    status: {
      type: String,
      enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },

    // Notes submitted by the applicant when creating the request (not the reviewing admin's notes)
    applicantNotes: {
      type: String,
      trim: true,
      default: '',
    },

    adminNotes: {
      type: String,
      trim: true,
      default: '',
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    createdEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        performedAt: { type: Date, default: Date.now },
        notes: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to generate sequential / formatted requestNumber (e.g. CHAMA-REQ-000184)
workspaceRequestSchema.pre('save', async function () {
  if (!this.requestNumber) {
    const prefix =
      this.entityType === 'business'
        ? 'BIZ-REQ'
        : this.entityType === 'contribution_group'
        ? 'GRP-REQ'
        : 'CHAMA-REQ';
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    this.requestNumber = `${prefix}-${randomSuffix}`;
  }
});

export default mongoose.models.WorkspaceRequest ||
  mongoose.model('WorkspaceRequest', workspaceRequestSchema);