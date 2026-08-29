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