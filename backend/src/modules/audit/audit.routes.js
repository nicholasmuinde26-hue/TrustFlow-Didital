import express from 'express';

import {
  getChamaAuditLogsController,
  getContributionGroupAuditLogsController,
  getAuditLogController
} from './audit.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireAuditAccess,
  requireGroupAuditAccess
} from '../../middleware/chama.middleware.js';


const router = express.Router();

router.get(
  '/:chamaId/audit-logs',
  protect,
  requireAuditAccess,
  getChamaAuditLogsController
);

router.get(
  '/:groupId/group-audit-logs',
  protect,
  requireGroupAuditAccess,
  getContributionGroupAuditLogsController
);

router.get(
  '/:chamaId/audit-logs/:auditLogId',
  protect,
  requireAuditAccess,
  getAuditLogController
);

export default router;