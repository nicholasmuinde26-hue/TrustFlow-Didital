import {
  getChamaAuditLogs,
  getAuditLogById
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