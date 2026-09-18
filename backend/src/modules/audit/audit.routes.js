import express from 'express';

import {
  getChamaAuditLogsController,
  getContributionGroupAuditLogsController,
  getAuditLogController,
  verifyChamaAuditChainController,
  verifyContributionGroupAuditChainController
} from './audit.controller.js';

import {
  getChamaTrustTimelineController
} from './trustTimeline.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireAuditAccess,
  requireGroupAuditAccess,
  requireChamaMember
} from '../../middleware/chama.middleware.js';


const router = express.Router();

router.get(
  '/:chamaId/audit-logs',
  protect,
  requireAuditAccess,
  getChamaAuditLogsController
);

// Member-facing trust timeline — deliberately uses requireChamaMember,
// NOT requireAuditAccess. Any active member (not just treasurer/
// chairperson/auditor) can see the curated trust events for their own
// chama. See trustTimeline.service.js for what's included and why.
router.get(
  '/:chamaId/trust-timeline',
  protect,
  requireChamaMember,
  getChamaTrustTimelineController
);

router.get(
  '/:groupId/group-audit-logs',
  protect,
  requireGroupAuditAccess,
  getContributionGroupAuditLogsController
);

// Integrity verification, mounted under trust-timeline rather than
// audit-logs and guarded by requireChamaMember for the same reason the
// timeline itself is: "any member can check the record hasn't been
// altered" is a materially different promise from "the treasurer can
// check". A chain only officials can verify asks members to trust
// exactly the people the audit log exists to hold accountable.
//
// What it returns is counts and hashes, never entry content - a member
// learns whether the trail is intact and how long it is, not what is in
// entries they aren't cleared to read.
//
// Keeping it off the /audit-logs prefix has a practical benefit too:
// every route under that prefix keeps one consistent guard, so a later
// copy-paste can't quietly inherit the looser one - and there is no
// ordering hazard with '/:chamaId/audit-logs/:auditLogId' below, which
// would otherwise bind auditLogId='verify' if it were registered first.
router.get(
  '/:chamaId/trust-timeline/verify',
  protect,
  requireChamaMember,
  verifyChamaAuditChainController
);

router.get(
  '/:groupId/group-audit-logs/verify',
  protect,
  requireGroupAuditAccess,
  verifyContributionGroupAuditChainController
);

router.get(
  '/:chamaId/audit-logs/:auditLogId',
  protect,
  requireAuditAccess,
  getAuditLogController
);

export default router;