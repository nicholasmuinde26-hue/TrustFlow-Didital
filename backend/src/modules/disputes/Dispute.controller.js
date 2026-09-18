import { raiseDispute, listDisputes, updateDisputeStatus } from '../../services/Dispute.service.js';

const AUDIT_ACCESS_ROLES = ['treasurer', 'chairperson', 'auditor'];

// ========================================
// RAISE A DISPUTE
// ========================================
//
// POST /api/v1/chamas/:chamaId/disputes
//
// Body: { subjectType, subjectId?, againstMembershipId?, title,
//         description }
//
// ========================================

export const raiseDisputeController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { subjectType, subjectId, againstMembershipId, title, description } = req.body;

    const dispute = await raiseDispute({
      chamaId,
      raisedByMembershipId: req.membership._id,
      raisedByUserId: req.user._id,
      subjectType,
      subjectId,
      againstMembershipId,
      title,
      description,
    });

    res.status(201).json({ success: true, data: { dispute } });
  } catch (error) {
    next(error);
  }
};

// ========================================
// LIST DISPUTES
// ========================================
//
// GET /api/v1/chamas/:chamaId/disputes?status=open&page=1&limit=20
//
// A plain member sees only their own; Treasurer/Chairperson/Auditor see
// every dispute in the chama.
//
// ========================================

export const listDisputesController = async (req, res, next) => {
  try {
    const { chamaId } = req.params;
    const { status, page, limit } = req.query;

    const result = await listDisputes({
      chamaId,
      viewerMembershipId: req.membership._id,
      viewerCanSeeAll: AUDIT_ACCESS_ROLES.includes(req.membership.role),
      status,
      page,
      limit,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE STATUS
// ========================================
//
// PATCH /api/v1/chamas/:chamaId/disputes/:disputeId
//
// Body: { status: 'investigating' | 'resolved' | 'dismissed',
//         resolutionNotes? }
//
// ========================================

export const updateDisputeStatusController = async (req, res, next) => {
  try {
    const { chamaId, disputeId } = req.params;
    const { status, resolutionNotes } = req.body;

    const dispute = await updateDisputeStatus({
      chamaId,
      disputeId,
      resolverMembershipId: req.membership._id,
      resolverUserId: req.user._id,
      status,
      resolutionNotes,
    });

    res.status(200).json({ success: true, data: { dispute } });
  } catch (error) {
    next(error);
  }
};