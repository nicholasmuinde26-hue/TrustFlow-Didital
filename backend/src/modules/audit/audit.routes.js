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
  requireAuditAccess
} from '../../middleware/chama.middleware.js';


const router = express.Router();

router.get(
  '/:chamaId/audit-logs',
  protect,
  getChamaAuditLogsController
);

router.get(
  '/:groupId/group-audit-logs',
  protect,
  getContributionGroupAuditLogsController
);

router.get(
  '/:chamaId/audit-logs/:auditLogId',
  protect,
  getAuditLogController
);

export default router;