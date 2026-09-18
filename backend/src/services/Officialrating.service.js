import mongoose from 'mongoose';

import ChamaMembership from '../models/ChamaMembership.js';
import OfficialRating from '../models/Officialrating.js';

import AppError from '../utils/AppError.js';

import { createAuditLog, AUDIT_SCOPE_TYPES } from './audit.service.js';
import { AUDIT_ACTIONS } from '../constants/audit.constants.js';
import { OFFICIAL_ROLES } from '../constants/Trustscore.constants.js';

// ========================================
// OFFICIAL RATING SERVICE
// ========================================
//
// Peer accountability for the people who actually hold custody/
// governance authority over the chama — treasurer, chairperson,
// secretary, auditor, committee members. Any active member can rate
// any current official; an official cannot rate themselves.
//
// Two views are deliberately different shapes:
//
//   - listRateableOfficials(): what EVERY member sees — officials with
//     an aggregate average + count only. No rater identity, no raw
//     comments. This is what feeds the trust score and what a member
//     browses before deciding whether/how to rate.
//
//   - getOfficialRatingDetail(): the raw, per-rater breakdown with
//     comments — restricted to audit-access roles (treasurer/auditor;
//     see requireAuditAccess on the route), the same people who already
//     see the full audit log. An official being rated should not be
//     able to see who rated them what — that's exactly the pressure a
//     peer-accountability mechanism needs to be safe from.
//
// ========================================

const validateObjectId = (value, fieldName) => {
  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
};

// ========================================
// LIST RATEABLE OFFICIALS (aggregate only)
// ========================================

export const listRateableOfficials = async ({ chamaId, viewerMembershipId }) => {
  validateObjectId(chamaId, 'Chama ID');

  const officials = await ChamaMembership.find({
    chama_id: chamaId,
    status: 'active',
    role: { $in: OFFICIAL_ROLES },
  })
    .populate('user_id', 'name')
    .lean();

  if (!officials.length) return [];

  const officialIds = officials.map((o) => o._id);

  const ratings = await OfficialRating.find({
    chama_id: chamaId,
    official_membership_id: { $in: officialIds },
  })
    .select('official_membership_id rating rated_by_membership_id')
    .lean();

  const byOfficial = new Map();
  for (const id of officialIds) byOfficial.set(String(id), []);
  for (const r of ratings) {
    const key = String(r.official_membership_id);
    if (byOfficial.has(key)) byOfficial.get(key).push(r);
  }

  return officials.map((official) => {
    const officialRatings = byOfficial.get(String(official._id)) || [];
    const avg = officialRatings.length
      ? officialRatings.reduce((sum, r) => sum + r.rating, 0) / officialRatings.length
      : null;

    const viewerRating = viewerMembershipId
      ? officialRatings.find((r) => String(r.rated_by_membership_id) === String(viewerMembershipId))
      : null;

    return {
      membershipId: String(official._id),
      name: official.user_id?.name || 'Chama official',
      role: official.role,
      averageRating: avg !== null ? Math.round(avg * 10) / 10 : null,
      ratingCount: officialRatings.length,
      viewerRating: viewerRating ? viewerRating.rating : null,
      isSelf: viewerMembershipId ? String(official._id) === String(viewerMembershipId) : false,
    };
  });
};

// ========================================
// SUBMIT (OR UPDATE) A RATING
// ========================================

export const submitOfficialRating = async ({
  chamaId,
  officialMembershipId,
  raterMembershipId,
  raterUserId,
  rating,
  integrityRating = null,
  transparencyRating = null,
  responsivenessRating = null,
  comment = null,
}) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(officialMembershipId, 'Official membership ID');

  if (String(officialMembershipId) === String(raterMembershipId)) {
    throw new AppError('You cannot rate yourself', 400);
  }

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new AppError('Rating must be a number between 1 and 5', 400);
  }

  const official = await ChamaMembership.findOne({
    _id: officialMembershipId,
    chama_id: chamaId,
    status: 'active',
    role: { $in: OFFICIAL_ROLES },
  }).lean();

  if (!official) {
    throw new AppError('That member is not a current official of this chama', 404);
  }

  const clampDimension = (value) =>
    value === null || value === undefined
      ? null
      : Math.min(5, Math.max(1, Math.round(Number(value))));

  const saved = await OfficialRating.findOneAndUpdate(
    {
      chama_id: chamaId,
      official_membership_id: officialMembershipId,
      rated_by_membership_id: raterMembershipId,
    },
    {
      $set: {
        official_role_at_rating: official.role,
        rated_by_user_id: raterUserId,
        rating: numericRating,
        integrity_rating: clampDimension(integrityRating),
        transparency_rating: clampDimension(transparencyRating),
        responsiveness_rating: clampDimension(responsivenessRating),
        comment: comment ? String(comment).trim().slice(0, 1000) : null,
      },
    },
    { upsert: true, new: true, runValidators: true }
  );

  await createAuditLog({
    actorUserId: raterUserId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId,
    action: AUDIT_ACTIONS.OFFICIAL_RATING_SUBMITTED,
    resourceType: 'OfficialRating',
    resourceId: saved._id,
    // Deliberately no rating value/comment in the audit log — the
    // timeline shows *that* accountability is happening, never what
    // was said, to keep the mechanism safe for raters to use honestly.
    metadata: { officialRole: official.role },
  });

  return saved.toObject();
};

// ========================================
// RAW DETAIL (audit-access roles only — enforced by the route)
// ========================================

export const getOfficialRatingDetail = async ({ chamaId, officialMembershipId }) => {
  validateObjectId(chamaId, 'Chama ID');
  validateObjectId(officialMembershipId, 'Official membership ID');

  const ratings = await OfficialRating.find({
    chama_id: chamaId,
    official_membership_id: officialMembershipId,
  })
    .populate('rated_by_user_id', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return ratings.map((r) => ({
    id: String(r._id),
    ratedBy: r.rated_by_user_id?.name || 'A member',
    rating: r.rating,
    integrityRating: r.integrity_rating,
    transparencyRating: r.transparency_rating,
    responsivenessRating: r.responsiveness_rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));
};