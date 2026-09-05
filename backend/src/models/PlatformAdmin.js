import mongoose from 'mongoose';

const platformAdminSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    adminRole: {
      type: String,
      enum: ['SUPER_ADMIN', 'PLATFORM_ADMIN'],
      default: 'PLATFORM_ADMIN',
      required: true,
      index: true,
    },

    permissions: {
      users: { type: Boolean, default: true },
      chamas: { type: Boolean, default: true },
      businesses: { type: Boolean, default: false },
      contributionGroups: { type: Boolean, default: true },
      finance: { type: Boolean, default: false },
      auditLogs: { type: Boolean, default: true },
      settings: { type: Boolean, default: false },
    },

    status: {
      type: String,
      enum: ['ACTIVE', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },

    appointedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PlatformAdmin ||
  mongoose.model('PlatformAdmin', platformAdminSchema);
