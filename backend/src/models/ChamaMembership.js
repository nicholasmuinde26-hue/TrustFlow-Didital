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
// NAMING CONVENTION: snake_case required
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
  'chairperson',
  'committee_member',
  'patron'
];

// ========================================
// MEMBERSHIP STATUS
// ========================================

const MEMBERSHIP_STATUS = [
  'active',
  'inactive',
  'suspended',
  'removed',
  // A join request made via an invite link. Created by acceptInvite()
  // in chamaOperations.service.js and only becomes 'active' once the
  // Treasurer or Chairperson approves it (member.service.js
  // updateMemberStatus). Excluded from getChamaMembers() so pending
  // requesters don't show up as members yet, and requireChamaMember
  // rejects them (status !== 'active') so they can't access the
  // Chama's data while awaiting approval.
  'pending'
];

// ========================================
// CHAMA MEMBERSHIP SCHEMA
// ========================================

const chamaMembershipSchema = new mongoose.Schema(
  {

    // ======================================
    // USER
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

    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },

    // ======================================
    // ROLE
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
    // Must be unique 1..N among active members.
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

    removed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // --------------------------------------
    // SUSPENSION / MANAGEMENT RESTRICTION
    // --------------------------------------
    //
    // A suspended member remains in the Chama
    // history and can later be returned to active
    // membership. Suspension always strips the
    // member of governance/management authority.
    //
    suspended_at: {
      type: Date,
      default: null
    },

    management_restriction_until: {
      type: Date,
      default: null
    },

    returned_at: {
      type: Date,
      default: null
    },

    // --------------------------------------
    // LEADERSHIP PIN
    // --------------------------------------
    //
    // A second factor guarding the Leadership Desk, stored HERE and not
    // on User on purpose: the same person can be a plain member in one
    // Chama and Chairperson in another, and each leadership seat should
    // carry its own PIN. Losing/leaving a seat therefore also takes the
    // PIN with it — nothing to clean up on the User document.
    //
    // Only ever stores a bcrypt hash of a 4-6 digit PIN. `select: false`
    // so it never leaks through the many places that do
    // ChamaMembership.find(...) and hand the result to a controller.
    //
    // The lockout counters live alongside it because rate limiting a PIN
    // has to be per-seat, not per-IP: an attacker with a stolen session
    // is already "the right IP".
    //
    leadership_pin_hash: {
      type: String,
      default: null,
      select: false
    },

    leadership_pin_set_at: {
      type: Date,
      default: null
    },

    // Consecutive failed unlock attempts. Reset to 0 on any success.
    leadership_pin_failed_attempts: {
      type: Number,
      default: 0,
      select: false
    },

    // Set once failed attempts cross the threshold; all verification is
    // refused until this passes, even with the correct PIN.
    leadership_pin_locked_until: {
      type: Date,
      default: null,
      select: false
    },

    // Bumped whenever the PIN is changed or reset. Leadership tokens
    // carry the version they were minted against, so changing the PIN
    // instantly invalidates every outstanding unlocked session.
    leadership_pin_version: {
      type: Number,
      default: 0
    }

  },
  {
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
// ========================================

chamaMembershipSchema.index(
  { user_id: 1, chama_id: 1 },
  { unique: true, name: 'unique_user_chama_membership' }
);

// ========================================
// CHAMA MEMBERS LOOKUP
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  status: 1
});

// ========================================
// ROLE LOOKUP
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  role: 1,
  status: 1
});

// ========================================
// PAYOUT ORDER LOOKUP
// ========================================

chamaMembershipSchema.index({
  chama_id: 1,
  status: 1,
  payout_position: 1
});

// ========================================
// USER MEMBERSHIP LOOKUP
// ========================================

chamaMembershipSchema.index({
  user_id: 1,
  status: 1,
  createdAt: -1
});

// ========================================
// PAYOUT POSITION UNIQUE CONSTRAINT
// ========================================
//
// Prevent 2 active members in same Chama from having same position
// Allows nulls and removed/inactive members to have duplicate/null
//
// This is what stops the "Duplicate payout positions" error
//
// IMPORTANT: the partialFilterExpression also requires payout_position
// to actually be a number. MongoDB's unique index treats null as a
// real, comparable value (not exempted the way sparse indexes exempt
// *missing* fields) — so without this, a SECOND active membership with
// payout_position: null (e.g. a Patron, or any regular member added
// via addMemberToChama/join-request approval, both of which default to
// null) would hit a duplicate-key error on save. Restricting the index
// to numeric values means only real position collisions are enforced;
// any number of active members can share payout_position: null.
//
// ========================================

chamaMembershipSchema.index(
  { chama_id: 1, payout_position: 1 },
  {
    unique: true,
    name: 'unique_active_payout_position',
    partialFilterExpression: { status: 'active', payout_position: { $type: 'number' } }
  }
);

// ========================================
// EXPORT MODEL
// ========================================

const ChamaMembership = mongoose.model(
  'ChamaMembership',
  chamaMembershipSchema
);

export default ChamaMembership;