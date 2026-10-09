import express from 'express';

import { protect } from '../../middleware/auth.middleware.js';
import {
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  requireChamaLeadershipOfficial,
} from '../../middleware/chama.middleware.js';
import {
  getWorkspaceModuleSettingsController,
  requestWorkspaceModuleChangeController,
  cancelWorkspaceModuleChangeController,
} from './workspaceModules.controller.js';

// Mounted at /api/v1/chamas. Deliberately NOT behind requireModule - these
// routes are how modules get switched on again.
//
// The request is routed to platform administration. No Chama member sign-off
// is accepted; the admin feature-change endpoints apply approved changes.
const router = express.Router();

router.get(
  '/:chamaId/workspace-modules',
  protect,
  requireChamaMember,
  requireChamaLeadershipOfficial,
  getWorkspaceModuleSettingsController
);

router.post(
  '/:chamaId/workspace-modules/requests',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  requestWorkspaceModuleChangeController
);

router.post(
  '/:chamaId/workspace-modules/requests/:requestId/cancel',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  cancelWorkspaceModuleChangeController
);

export default router;
