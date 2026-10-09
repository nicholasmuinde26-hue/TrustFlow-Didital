import mongoose from 'mongoose';


// ========================================
// CHAMA SCHEMA
// ========================================

const chamaSchema = new mongoose.Schema(
  {

    // ========================================
    // CHAMA NAME
    // ========================================

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },


    // ========================================
    // MONTHLY SAVINGS
    // ========================================

    monthly_savings: {
      type: Number,
      required: true,
      min: 1
    },


    // ========================================
    // CHAMA CREATOR
    // ========================================
    //
    // This identifies the User who originally
    // created the Chama.
    //
    // It does NOT determine the current role.
    //
    // The creator's role is stored in:
    //
    // ChamaMembership.role
    //
    // ========================================

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },


    // ========================================
    // CHAMA TYPE
    // ========================================
    //
    // 'standard' -> a regular rotating-savings/investment Chama.
    // 'burial'   -> a burial/welfare Chama, which additionally gets
    //               a BurialChamaProfile (see modules/burialChama)
    //               configured through the setup wizard right after
    //               creation. Chosen once, at creation time.
    //
    // ========================================

    chama_type: {
      type: String,
      enum: [
        'standard',
        'burial'
      ],
      default: 'standard'
    },


    // ========================================
    // CHAMA STATUS
    // ========================================

    status: {
      type: String,
      enum: [
        'active',
        'inactive',
        'closed'
      ],
      default: 'active'
    },


    // ========================================
    // VISIBILITY
    // ========================================
    //
    // 'public'  -> discoverable in the "Browse Public Chamas" list
    //              shown to any authenticated user looking to join.
    // 'private' -> only reachable via the join code or an invite link.
    //
    // Either way, joining still requires Treasurer/Chairperson
    // approval (see ChamaMembership status 'pending') — visibility
    // only controls whether the Chama can be *found*, not whether a
    // request is auto-approved.
    //
    // ========================================

    visibility: {
      type: String,
      enum: [
        'public',
        'private'
      ],
      default: 'private'
    },


    // ========================================
    // WORKSPACE CONFIG
    // ========================================
    //
    // Which feature modules this chama's workspace contains (loans, MGR,
    // assets, polls ...). See constants/workspaceModules.constants.js for the
    // catalog and presets.
    //
    //   preset  -> which template it started from (informational)
    //   modules -> { loans: { enabled: false }, mgr: { enabled: true }, ... }
    //
    // A chama WITHOUT this field (created before configurable workspaces)
    // is resolved from its chama_type by getEnabledModules(), so nothing
    // changes for it until scripts/backfillWorkspaceConfig.js is run - and
    // nothing changes even after, because the backfill writes the exact
    // legacy module set.
    //
    // Switching a module off hides and blocks it; it never deletes data.
    //
    // ========================================

    workspace_config: {
      preset: { type: String, default: 'standard' },
      modules: { type: mongoose.Schema.Types.Mixed, default: undefined },
      version: { type: Number, default: 1 },
      configured_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      configured_at: { type: Date, default: null }
    },


    // ========================================
    // JOIN CODE
    // ========================================
    //
    // A short, persistent, human-shareable code generated when the
    // Chama is created. Visible only to the Chairperson and Treasurer
    // (see chamaOperations.service.js getJoinCode), who can share it
    // with prospective members so they can join directly via
    // "Enter Invitation Code" instead of a link.
    //
    // Unlike ChamaInvitation.token, this code does NOT expire and is
    // NOT single-use — it lives for as long as the Chama does, and
    // can be regenerated (invalidating the old code) if it leaks.
    //
    // ========================================

    join_code: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    }

  },
  {
    timestamps: true
  }
);


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(
  'Chama',
  chamaSchema
);