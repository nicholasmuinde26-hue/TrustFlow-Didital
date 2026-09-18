import {
  generateTrustScore,
  getLatestTrustScore,
  listTrustScoreHistory,
  createShareLink,
  revokeShareLink,
} from '../../services/Chamatrustscore.service.js';

// ========================================
// GENERATE (REFRESH) THE TRUST SCORE
// ========================================
//
// POST /api/v1/chamas/:chamaId/trust-score/generate
//
// Treasurer/Chairperson only (see requireChamaTreasurerOrChairperson on
// the route) — this writes a new persisted snapshot + an audit log
// entry, so it's an action, not a passive read.
//
// ========================================

export const generateTrustScoreController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;

    const snapshot = await generateTrustScore({
      chamaId,
      actorUserId: req.user._id,
    });

    res.status(201).json({ success: true, data: { trustScore: snapshot } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET LATEST SNAPSHOT
// ========================================
//
// GET /api/v1/chamas/:chamaId/trust-score
//
// Any active member can view — same principle as the Trust Timeline:
// this is a member-facing accountability artifact, not an officials-
// only report.
//
// ========================================

export const getLatestTrustScoreController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;

    const trustScore = await getLatestTrustScore(chamaId);

    res.status(200).json({ success: true, data: { trustScore } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// HISTORY
// ========================================
//
// GET /api/v1/chamas/:chamaId/trust-score/history?page=1&limit=12
//
// ========================================

export const listTrustScoreHistoryController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { page, limit } = req.query;

    const result = await listTrustScoreHistory({ chamaId, page, limit });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ========================================
// CREATE SHARE LINK
// ========================================
//
// POST /api/v1/chamas/:chamaId/trust-score/:trustScoreId/share
//
// ========================================

export const createShareLinkController = async (req, res, next) => {
  try {
    const { chamaId, trustScoreId } = req.params;

    const snapshot = await createShareLink({
      chamaId,
      trustScoreId,
      actorUserId: req.user._id,
    });

    res.status(200).json({
      success: true,
      data: {
        trustScore: snapshot,
        shareUrl: `/trust-score/${snapshot.share_token}`,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// REVOKE SHARE LINK
// ========================================
//
// POST /api/v1/chamas/:chamaId/trust-score/:trustScoreId/revoke
//
// ========================================

export const revokeShareLinkController = async (req, res, next) => {
  try {
    const { chamaId, trustScoreId } = req.params;

    const snapshot = await revokeShareLink({
      chamaId,
      trustScoreId,
      actorUserId: req.user._id,
    });

    res.status(200).json({ success: true, data: { trustScore: snapshot } });
  } catch (error) {
    next(error);
  }
};