import mongoose from 'mongoose';

// ========================================
// CHAMA TRUST SCORE (SNAPSHOT)
// ========================================
//
// A point-in-time, persisted computation of a chama's shareable trust
// score — the single exportable artifact a chama can hand to a bank, a
// SACCO federation, or a prospective member, instead of asking them to
// take the group's word for it.
//
// Each call to generateTrustScore() (chamaTrustScore.service.js) writes
// a NEW snapshot rather than overwriting the last one, so:
//
//   1. A shared link keeps showing exactly what was shared, even if the
//      chama's numbers move later — a bank looking at a report from
//      March shouldn't silently see June's numbers under the same URL.
//   2. History of the score over time is queryable (getScoreHistory),
//      which is itself a trust signal — "steadily improving" reads very
//      differently from "spiked right before we applied for a loan".
//
// `components` mirrors the weights in constants/trustScore.constants.js
// — each key there has a matching key here with the raw numbers behind
// it, not just the rolled-up score, so the report is inspectable rather
// than a single opaque number.
//
// ========================================

const componentSchema = new mongoose.Schema(
  {
    score: { type: Number, default: null }, // 0-100, null = no data
    hasData: { type: Boolean, default: false },
    weight: { type: Number, default: 0 }, // weight actually used after renormalization
  },
  { _id: false, strict: false } // strict:false — each component adds its own raw fields (rate, counts, etc.) on top of score/hasData/weight
);

const chamaTrustScoreSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    generated_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null when system-generated (e.g. a scheduled refresh)
    },
    is_system_generated: {
      type: Boolean,
      default: false,
    },

    // Overall 0-100 composite, and letter grade. Null score means there
    // wasn't enough data for ANY component yet (brand-new chama) — the
    // UI shows "Not enough activity yet" rather than a misleading 0.
    score: { type: Number, default: null },
    grade: { type: String, default: null },

    components: {
      repayment: { type: componentSchema, default: () => ({}) },
      kyc: { type: componentSchema, default: () => ({}) },
      disputes: { type: componentSchema, default: () => ({}) },
      auditIntegrity: { type: componentSchema, default: () => ({}) },
      officialAccountability: { type: componentSchema, default: () => ({}) },
    },

    // Which component keys actually contributed to `score` (had data).
    components_used: { type: [String], default: [] },

    // Denormalized chama facts at generation time, so a public viewer
    // (and later snapshots viewed in history) don't depend on a live
    // join and don't change retroactively if the chama is later renamed.
    chama_snapshot: {
      name: { type: String, required: true },
      chama_type: { type: String, default: 'standard' },
      active_member_count: { type: Number, default: 0 },
      chama_created_at: { type: Date, default: null },
    },

    // ======================================
    // SHARING
    // ======================================
    //
    // A snapshot is private by default. share_token is only set once an
    // official explicitly shares it (createShareLink), and only a
    // snapshot with is_public true is servable from the unauthenticated
    // public endpoint (see publicTrustScore.controller.js). Revoking
    // clears the token entirely rather than just flipping a flag, so an
    // old link can never be replayed even if is_public were somehow
    // flipped back.
    //
    // ======================================

    share_token: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    is_public: {
      type: Boolean,
      default: false,
    },
    shared_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    shared_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

chamaTrustScoreSchema.index({ chama_id: 1, createdAt: -1 });

export default mongoose.models.ChamaTrustScore || mongoose.model('ChamaTrustScore', chamaTrustScoreSchema);