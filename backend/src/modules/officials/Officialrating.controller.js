import {
  listRateableOfficials,
  submitOfficialRating,
  getOfficialRatingDetail,
} from '../../services/Officialrating.service.js';

// ========================================
// LIST OFFICIALS + AGGREGATE RATINGS
// ========================================
//
// GET /api/v1/chamas/:chamaId/officials
//
// Any active member — aggregate averages only, no rater identities.
//
// ========================================

export const listRateableOfficialsController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;

    const officials = await listRateableOfficials({
      chamaId,
      viewerMembershipId: req.membership?._id,
    });

    res.status(200).json({ success: true, data: { officials } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// SUBMIT (OR UPDATE) A RATING
// ========================================
//
// POST /api/v1/chamas/:chamaId/officials/:membershipId/ratings
//
// Body: { rating, integrityRating?, transparencyRating?,
//         responsivenessRating?, comment? }
//
// ========================================

export const submitOfficialRatingController = async (req, res, next) => {
  try {
    const { chamaId, membershipId } = req.params;
    const { rating, integrityRating, transparencyRating, responsivenessRating, comment } =
      req.body;

    const saved = await submitOfficialRating({
      chamaId,
      officialMembershipId: membershipId,
      raterMembershipId: req.membership._id,
      raterUserId: req.user._id,
      rating,
      integrityRating,
      transparencyRating,
      responsivenessRating,
      comment,
    });

    res.status(200).json({ success: true, data: { rating: saved } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// RAW RATING DETAIL (audit-access roles only)
// ========================================
//
// GET /api/v1/chamas/:chamaId/officials/:membershipId/ratings
//
// ========================================

export const getOfficialRatingDetailController = async (req, res, next) => {
  try {
    const { chamaId, membershipId } = req.params;

    const ratings = await getOfficialRatingDetail({ chamaId, officialMembershipId: membershipId });

    res.status(200).json({ success: true, data: { ratings } });
  } catch (error) {
    next(error);
  }
};