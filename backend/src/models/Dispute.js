import mongoose from 'mongoose';

import {
  DISPUTE_SUBJECT_TYPES,
  DISPUTE_STATUSES,
} from '../constants/Trustscore.constants.js';

// ========================================
// DISPUTE
// ========================================
//
// A member-raised complaint or flag — against a transaction, a loan
// decision, a payout, or an official's conduct. This is the "official
// accountability" counterpart to the KYC/anomaly tooling that already
// exists for member-side risk: chamas mostly fail when a TRUSTED
// official misuses funds, not when a rank-and-file member defaults, so
// there needs to be a place for "something is wrong here" that isn't
// filtered through the very official it might be about.
//
// Deliberately lightweight — this is a flag-and-track record, not a
// dispute-resolution workflow engine. Status moves:
//
//   open -> investigating -> resolved
//                          -> dismissed
//
// Feeds the "dispute rate" component of the Chama Trust Score (see
// chamaTrustScore.service.js) and appears (as a content-free event —
// see trustTimeline.constants.js) in the member-facing trust timeline,
// so members can see the mechanism is actually being used without
// reading anyone's complaint.
//
// ========================================

const disputeSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    // Who raised it. Both refs are kept: the membership for chama-scoped
    // queries/permission checks, the user for AuditLog's actorUserId.
    raised_by_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },
    raised_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    subject_type: {
      type: String,
      enum: DISPUTE_SUBJECT_TYPES,
      required: true,
    },

    // Optional pointer to the record in question (a ChamaLoan _id, a
    // FinancialTransaction _id, a Payout _id, etc.) — not populated or
    // strongly typed against one collection since subject_type varies.
    subject_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // The official this dispute concerns, if any (subject_type
    // 'official_conduct', or any other type where a specific official's
    // decision is being challenged). Left null for a dispute about a
    // transaction/loan with no specific official named.
    against_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },

    status: {
      type: String,
      enum: DISPUTE_STATUSES,
      default: 'open',
      index: true,
    },

    resolution_notes: {
      type: String,
      trim: true,
      maxlength: 3000,
      default: null,
    },

    resolved_by_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null,
    },
    resolved_by_user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolved_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

disputeSchema.index({ chama_id: 1, status: 1, createdAt: -1 });
disputeSchema.index({ chama_id: 1, createdAt: -1 });
disputeSchema.index({ raised_by_membership_id: 1, createdAt: -1 });

export default mongoose.models.Dispute || mongoose.model('Dispute', disputeSchema);