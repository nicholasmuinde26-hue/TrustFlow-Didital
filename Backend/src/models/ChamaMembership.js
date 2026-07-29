import mongoose from 'mongoose';


// ========================================
// CHAMA MEMBERSHIP
// ========================================
//
// A User can belong to many Chamas.
//
// User
//  │
//  ├── Chama A → Treasurer
//  ├── Chama B → Member
//  └── Chama C → Auditor
//
// This document represents the relationship
// between ONE User and ONE Chama.
//
// NAMING CONVENTION:
//
// Every other model in this codebase
// (Chama, FinancialAccount, FinancialTransaction,
// ContributionGroup, ContributionPayment, ...)
// uses snake_case field names.
//
// This schema MUST also use snake_case.
//
// Every consumer of this model
// (member.service.js, chama.service.js,
// chama.middleware.js, contributionObligation.service.js,
// payout.service.js) already queries and creates
// documents using snake_case field names
// (user_id, chama_id, payout_position, ...).
//
// A previous version of this schema used
// camelCase (userId, chamaId, payoutPosition, ...),
// which silently broke every one of those call
// sites: Mongoose's default strict mode drops
// unrecognized fields, so ChamaMembership.create()
// calls throw "user_id is required" / "chama_id is
// required" validation errors, and every
// ChamaMembership.findOne({ user_id, chama_id })
// lookup always returns null.
//
// Do NOT rename these fields back to camelCase
// without also updating every call site above.
//
// ========================================


// ========================================
// MEMBERSHIP ROLES
// ========================================

const MEMBERSHIP_ROLES = [
  'member',
  'treasurer',
  'secretary',
  'auditor',
  'chairperson'
];


// ========================================
// MEMBERSHIP STATUS
// ========================================

const MEMBERSHIP_STATUS = [
  'active',
  'inactive',
  'suspended',
  'removed'
];


// ========================================
// CHAMA MEMBERSHIP SCHEMA
// ========================================

const chamaMembershipSchema = new mongoose.Schema(
  {

    // ======================================
    // USER
    // ======================================
    //
    // The global User identity.
    //
    // A User can have multiple memberships
    // across different Chamas.
    //
    // ======================================

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },


    // ======================================
    // CHAMA
    // ======================================
    //
    // The Chama this membership belongs to.
    //
    // ======================================

    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },


    // ======================================
    // ROLE
    // ======================================
    //
    // The user's role inside THIS Chama.
    //
    // Example:
    //
    // User A
    //   ├── Chama A → Treasurer
    //   ├── Chama B → Member
    //   └── Chama C → Auditor
    //
    // Role is therefore scoped to the
    // membership, not the User.
    //
    // ======================================

    role: {
      type: String,
      enum: MEMBERSHIP_ROLES,
      default: 'member',
      required: true,
      index: true
    },


    // ======================================
    // MEMBERSHIP STATUS
    // ======================================
    //
    // Controls the lifecycle of membership.
    //
    // active
    // inactive
    // suspended
    // removed
    //
    // ======================================

    status: {
      type: String,
      enum: MEMBERSHIP_STATUS,
      default: 'active',
      required: true,
      index: true
    },


    // ======================================
    // PAYOUT POSITION
    // ======================================
    //
    // Used for simple rotational Chamas.
    //
    // Example:
    //
    // Member A → Position 1
    // Member B → Position 2
    // Member C → Position 3
    //
    // For advanced rotations, this can later
    // move into a dedicated RotationParticipant
    // model.
    //
    // ======================================

    payout_position: {
      type: Number,
      min: 1,
      default: null
    },


    // ======================================
    // INVITED BY
    // ======================================
    //
    // User who invited this member.
    //
    // ======================================

    invited_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },


    // ======================================
    // JOINED DATE
    // ======================================

    joined_at: {
      type: Date,
      default: Date.now,
      immutable: true
    },


    // ======================================
    // ACCEPTED DATE
    // ======================================
    //
    // Useful when we implement invitations.
    //
    // Example:
    //
    // Invitation Sent
    //       ↓
    // Member Accepts
    //       ↓
    // accepted_at = Date
    //
    // ======================================

    accepted_at: {
      type: Date,
      default: null
    },


    // ======================================
    // REMOVED DATE
    // ======================================

    removed_at: {
      type: Date,
      default: null
    },


    // ======================================
    // REMOVED BY
    // ======================================
    //
    // User who removed this member.
    //
    // ======================================

    removed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }

  },
  {
    // Automatically adds:
    //
    // createdAt
    // updatedAt
    //
    timestamps: true
  }
);


// ========================================
// UNIQUE MEMBERSHIP CONSTRAINT
// ========================================
//
// A user can only have ONE membership
// record for a specific Chama.
//
// User A + Chama A
//       ↓
// ONE membership
//
// User A + Chama B
//       ↓
// ANOTHER membership
//
// ========================================

chamaMembershipSchema.index(
  {
    user_id: 1,
    chama_id: 1
  },
  {
    unique: true,
    name: 'unique_user_chama_membership'
  }
);


// ========================================
// CHAMA MEMBERS LOOKUP
// ========================================
//
// Efficiently find members of a Chama.
//
// Example:
//
// GET /chamas/:chamaId/members
//
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  status: 1
});


// ========================================
// ROLE LOOKUP
// ========================================
//
// Efficiently find members by role.
//
// Example:
//
// Find all active auditors
// in a specific Chama.
//
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  role: 1,
  status: 1
});


// ========================================
// PAYOUT ORDER LOOKUP
// ========================================
//
// Efficiently find active members of a
// Chama in payout rotation order.
//
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  status: 1,
  payout_position: 1
});


// ========================================
// USER MEMBERSHIP LOOKUP
// ========================================
//
// Efficiently find all Chamas
// belonging to a specific User.
//
// ========================================

chamaMembershipSchema.index({
  user_id: 1,
  status: 1,
  createdAt: -1
});


// ========================================
// EXPORT MODEL
// ========================================

const ChamaMembership = mongoose.model(
  'ChamaMembership',
  chamaMembershipSchema
);


export default ChamaMembership;