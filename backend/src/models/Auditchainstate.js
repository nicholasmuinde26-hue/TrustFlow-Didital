import mongoose from 'mongoose';


// ========================================
// AUDIT CHAIN STATE
// ========================================
//
// One document per audit scope (one chama, or one contribution group),
// holding the tip of that scope's hash chain: the last sequence number
// issued and the hash of the entry that claimed it.
//
// Why this exists rather than "read the last AuditLog and add one":
// two concurrent writers doing that would both read the same tip and
// both build their entry on the same prevHash, forking the chain.
// Sequence allocation has to be a single atomic compare-and-swap, and
// that needs a single document to swap on. See appendToChain() in
// services/audit.service.js.
//
// WHAT THIS DOCUMENT IS NOT:
// --------------------------
// It is not the thing that makes the log tamper-evident, and it is
// deliberately mutable (unlike AuditLog, which blocks updates and
// deletes outright). The evidence lives in the AuditLog entries
// themselves - each one's stored hash commits to its own content plus
// its predecessor's hash. Someone who rewrites this document cannot
// make an edited AuditLog entry re-hash correctly; the most they can do
// is desynchronize the tip, which verifyAuditChain() reports as a
// separate, explicitly-flagged condition rather than silently passing.
//
// ========================================


const auditChainStateSchema = new mongoose.Schema(
  {

    // ======================================
    // SCOPE
    // ======================================

    scopeType: {

      type:
        String,

      enum: [

        'CHAMA',

        'CONTRIBUTION_GROUP'

      ],

      required:
        true,

      uppercase:
        true,

      trim:
        true

    },


    chamaId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'Chama',

      default:
        null

    },


    contributionGroupId: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'ContributionGroup',

      default:
        null

    },


    // ======================================
    // CHAIN TIP
    // ======================================
    //
    // `sequence` is the highest sequence number issued so far for this
    // scope (0 before the first entry). `lastHash` is the hash of the
    // entry that holds that sequence number - null before the first
    // entry, which is what makes the first entry hash against the
    // GENESIS sentinel.
    //
    // ======================================

    sequence: {

      type:
        Number,

      required:
        true,

      default:
        0,

      min:
        0

    },


    lastHash: {

      type:
        String,

      default:
        null

    }

  },

  {

    timestamps:
      true

  }

);


// ========================================
// ONE CHAIN PER SCOPE
// ========================================
//
// Unique so the upsert in appendToChain() can race safely: a duplicate
// insert loses on this index rather than creating a second chain tip
// for the same chama, which would let two entries claim sequence 1.
//
// Mongo treats a missing/null field as a real value for uniqueness
// purposes, so the (CHAMA, chamaId, null) and (CONTRIBUTION_GROUP,
// null, groupId) shapes both index cleanly without a partial filter.
//
// ========================================

auditChainStateSchema.index(
  {
    scopeType: 1,
    chamaId: 1,
    contributionGroupId: 1,
  },
  {
    unique: true,
  }
);


// ========================================
// MODEL
// ========================================

const AuditChainState =
  mongoose.model(
    'AuditChainState',
    auditChainStateSchema
  );


export default AuditChainState;