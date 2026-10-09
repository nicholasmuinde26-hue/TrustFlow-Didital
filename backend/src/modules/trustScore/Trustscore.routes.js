import express from 'express';

import {
  generateTrustScoreController,
  getLatestTrustScoreController,
  listTrustScoreHistoryController,
  createShareLinkController,
  revokeShareLinkController,
} from './Trustscore.controller.js';

import { protect } from '../../middleware/auth.middleware.js';
import {
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
} from '../../middleware/chama.middleware.js';

import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();

// Any active member can view the current score and its history — this
// is the same "members see the same record officials do" principle as
// the Trust Timeline.
router.get('/:chamaId/trust-score', protect, requireChamaMember, requireModule('trust'), getLatestTrustScoreController);
router.get(
  '/:chamaId/trust-score/history',
  protect,
  requireChamaMember, requireModule('trust'),
  listTrustScoreHistoryController
);

// Generating a new snapshot and sharing it externally are treasurer/
// chairperson actions — the people who'd actually hand this report to
// a bank or SACCO federation.
router.post(
  '/:chamaId/trust-score/generate',
  protect,
  requireChamaMember, requireModule('trust'),
  requireChamaTreasurerOrChairperson,
  generateTrustScoreController
);
router.post(
  '/:chamaId/trust-score/:trustScoreId/share',
  protect,
  requireChamaMember, requireModule('trust'),
  requireChamaTreasurerOrChairperson,
  createShareLinkController
);
router.post(
  '/:chamaId/trust-score/:trustScoreId/revoke',
  protect,
  requireChamaMember, requireModule('trust'),
  requireChamaTreasurerOrChairperson,
  revokeShareLinkController
);

export default router;