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
      enum: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'FINANCE_ADMIN', 'SECURITY_ADMIN', 'SUPPORT_ADMIN', 'OPERATIONS_ADMIN', 'COMPLIANCE_ADMIN', 'ONBOARDING_ADMIN', 'MARKETPLACE_ADMIN'],
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
      // Workspace-gating keys: these draw the line between admin consoles
      security: { type: Boolean, default: false },
      support: { type: Boolean, default: false },
      onboarding: { type: Boolean, default: false },
      marketplace: { type: Boolean, default: false },
      // Granular marketplace admin permissions
      manageMarketplaceDesign: { type: Boolean, default: false },
      approveListings: { type: Boolean, default: false },
      manageCategories: { type: Boolean, default: false },
      manageFeaturedContent: { type: Boolean, default: false },
      viewMarketplaceAnalytics: { type: Boolean, default: false },
      manageCommissions: { type: Boolean, default: false },
      accessMerchantPayouts: { type: Boolean, default: false },
    },

    // Category hubs this marketplace admin is authorized to govern (e.g. ['retail', 'rentals'])
    marketplaceScopes: {
      type: [String],
      default: [],
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

    // A category is deliberately separate from permissions: it gives the
    // operations console a clear workspace and makes least-privilege review
    // possible without inferring intent from a collection of booleans.
    category: {
      type: String,
      enum: ['finance', 'security', 'support', 'operations', 'compliance', 'onboarding', 'marketplace'],
      default: 'operations',
      index: true,
    },

    notes: { type: String, trim: true, maxlength: 500, default: '' },
  },
  {
    timestamps: true,
  }
);

export default mongoose.models.PlatformAdmin ||
  mongoose.model('PlatformAdmin', platformAdminSchema);