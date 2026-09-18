import mongoose from 'mongoose';

import {
  OFFICIAL_RATING_MIN,
  OFFICIAL_RATING_MAX,
} from '../constants/Trustscore.constants.js';

// ========================================
// OFFICIAL RATING
// ========================================
//
// Peer rating of a chama official (treasurer, chairperson, secretary,
// auditor, committee member) by a fellow active member. This is member
// -> official accountability, the direction the existing risk/fraud
// tooling (loan risk scoring, contribution anomaly detection) doesn't
// cover — that tooling watches members; nothing previously watched the
// officials members have to trust with custody of the fund.
//
// One rating per (official, rater) pair — a member updates their own
// rating over time rather than submitting a new one each time (same
// upsert pattern as ChamaMemberKyc), so the aggregate reflects each
// member's CURRENT opinion, not a pile of stale one-off submissions.
//
// ========================================

const officialRatingSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    official_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      index: true,
    },

    // Snapshot of the role being rated at the time of rating — an
    // official's accountability record for their term as Treasurer
    // shouldn't silently get relabelled if they later become Secretary.
    official_role_at_rating: {
      type: String,
      required: true,
    },

    rated_by_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },
    rated_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Overall 1-5 rating. Required — the dimension breakdowns below are
    // optional detail on top of it, not a replacement for it.
    rating: {
      type: Number,
      required: true,
      min: OFFICIAL_RATING_MIN,
      max: OFFICIAL_RATING_MAX,
    },

    // Optional dimension breakdown. Left null when a rater only gives
    // the headline rating.
    integrity_rating: {
      type: Number,
      min: OFFICIAL_RATING_MIN,
      max: OFFICIAL_RATING_MAX,
      default: null,
    },
    transparency_rating: {
      type: Number,
      min: OFFICIAL_RATING_MIN,
      max: OFFICIAL_RATING_MAX,
      default: null,
    },
    responsiveness_rating: {
      type: Number,
      min: OFFICIAL_RATING_MIN,
      max: OFFICIAL_RATING_MAX,
      default: null,
    },

    comment: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },
  },
  { timestamps: true }
);

// One rating per rater, per official — resubmitting updates it.
officialRatingSchema.index(
  { chama_id: 1, official_membership_id: 1, rated_by_membership_id: 1 },
  { unique: true, name: 'unique_official_rater' }
);

officialRatingSchema.index({ chama_id: 1, official_membership_id: 1, createdAt: -1 });

export default mongoose.models.OfficialRating || mongoose.model('OfficialRating', officialRatingSchema);