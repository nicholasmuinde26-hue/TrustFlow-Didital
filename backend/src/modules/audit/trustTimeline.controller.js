import { getChamaTrustTimeline } from '../../services/trustTimeline.service.js';

// ========================================
// GET CHAMA TRUST TIMELINE
// ========================================
//
// GET /api/v1/chamas/:chamaId/trust-timeline
//
// Open to any active member (see requireChamaMember on the route) —
// unlike /audit-logs, which is restricted to treasurer/chairperson/
// auditor. This is the point of the feature: members get to see the
// same underlying record of what happened, not a summary someone wrote.
//
// Query:
// ?page=1&limit=20
//
// ========================================

export const getChamaTrustTimelineController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { page, limit } = req.query;

    const result = await getChamaTrustTimeline({ chamaId, page, limit });

    res.status(200).json({
      success: true,
      data: {
        events: result.events,
        pagination: result.pagination,
      },
    });
  } catch (error) {
    next(error);
  }
};
