import {
  getChamaAuditLogs,
  getContributionGroupAuditLogs,
  getAuditLogById,
  verifyAuditChain,
  AUDIT_SCOPE_TYPES
} from '../../services/audit.service.js';

import AppError
  from '../../utils/AppError.js';


// ========================================
// GET CHAMA AUDIT LOGS
// ========================================
//
// GET
//
// /api/v1/chamas/:chamaId/audit-logs
//
// Query:
//
// ?page=1
// &limit=20
// &action=MEMBER_ADDED
// &actorUserId=...
// &resourceType=ChamaMembership
// &resourceId=...
// &startDate=2026-01-01
// &endDate=2026-12-31
//
// ========================================

export const getChamaAuditLogsController = async (
  req,
  res,
  next
) => {

  try {

    const {
      chamaId
    } = req.params;


    const {

      page,

      limit,

      action,

      actorUserId,

      resourceType,

      resourceId,

      startDate,

      endDate

    } = req.query;


    const result =
      await getChamaAuditLogs({

        chamaId,

        page,

        limit,

        action,

        actorUserId,

        resourceType,

        resourceId,

        startDate,

        endDate

      });


    res.status(200).json({

      success:
        true,

      data: {

        logs:
          result.logs,

        pagination:
          result.pagination

      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// GET SINGLE AUDIT LOG
// ========================================
//
// GET
//
// /api/v1/chamas/:chamaId/audit-logs/:auditLogId
//
// ========================================

export const getAuditLogController = async (
  req,
  res,
  next
) => {

  try {

    const {

      chamaId,

      auditLogId

    } = req.params;


    const auditLog =
      await getAuditLogById({

        chamaId,

        auditLogId

      });


    res.status(200).json({

      success:
        true,

      data: {

        auditLog

      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// GET CONTRIBUTION GROUP AUDIT LOGS
// ========================================

export const getContributionGroupAuditLogsController = async (
  req,
  res,
  next
) => {
  try {
    const { groupId, workspaceId } = req.params;
    const targetGroupId = groupId || workspaceId;

    const {
      page,
      limit,
      action,
      actorUserId,
      resourceType,
      resourceId,
      startDate,
      endDate
    } = req.query;

    const result = await getContributionGroupAuditLogs({
      contributionGroupId: targetGroupId,
      page,
      limit,
      action,
      actorUserId,
      resourceType,
      resourceId,
      startDate,
      endDate
    });

    res.status(200).json({
      success: true,
      data: {
        logs: result.logs,
        pagination: result.pagination
      }
    });
  } catch (error) {
    next(error);
  }
};


// ========================================
// VERIFY CHAMA AUDIT CHAIN
// ========================================
//
// GET
//
// /api/v1/chamas/:chamaId/audit-logs/verify
//
// Recomputes this chama's entire audit hash chain and reports whether
// the stored trail is intact. Answers a question a plain audit log
// cannot: not "what does the log say happened", but "is the log still
// what it was when it was written".
//
// Always 200 on a successful check, including when the chain is BROKEN -
// a broken chain is a valid, successfully-computed answer, not a server
// error. Callers branch on `data.valid`. Returning 4xx/5xx here would
// make "verification failed to run" and "verification ran and found
// tampering" indistinguishable to the client, which is precisely the
// distinction that matters.
//
// ========================================

export const verifyChamaAuditChainController = async (
  req,
  res,
  next
) => {

  try {

    const {
      chamaId
    } = req.params;


    const verification = await verifyAuditChain({
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId
    });


    res.status(200).json({

      success:
        true,

      data:
        verification

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// VERIFY CONTRIBUTION GROUP AUDIT CHAIN
// ========================================
//
// GET
//
// /api/v1/contribution-groups/:groupId/group-audit-logs/verify
//
// ========================================

export const verifyContributionGroupAuditChainController = async (
  req,
  res,
  next
) => {

  try {

    const {
      groupId,
      workspaceId
    } = req.params;


    const verification = await verifyAuditChain({
      scopeType: AUDIT_SCOPE_TYPES.CONTRIBUTION_GROUP,
      contributionGroupId: groupId || workspaceId
    });


    res.status(200).json({

      success:
        true,

      data:
        verification

    });

  } catch (error) {

    next(error);

  }

};