import express from 'express';

import {
  getChamaAuditLogsController,
  getAuditLogController
} from './audit.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireAuditAccess
} from '../../middleware/chama.middleware.js';


const router =
  express.Router();


// ========================================
// GET CHAMA AUDIT LOGS
// ========================================
//
// GET
// /api/v1/chamas/:chamaId/audit-logs
//
// Treasurer
// Auditor
//
// ========================================

router.get(

  '/:chamaId/audit-logs',

  protect,

  requireAuditAccess,

  getChamaAuditLogsController

);


// ========================================
// GET SINGLE AUDIT LOG
// ========================================
//
// GET
// /api/v1/chamas/:chamaId/audit-logs/:auditLogId
//
// ========================================

router.get(

  '/:chamaId/audit-logs/:auditLogId',

  protect,

  requireAuditAccess,

  getAuditLogController

);


export default router;