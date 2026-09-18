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

const router = express.Router();

// Any active member can view the current score and its history — this
// is the same "members see the same record officials do" principle as
// the Trust Timeline.
router.get('/:chamaId/trust-score', protect, requireChamaMember, getLatestTrustScoreController);
router.get(
  '/:chamaId/trust-score/history',
  protect,
  requireChamaMember,
  listTrustScoreHistoryController
);

// Generating a new snapshot and sharing it externally are treasurer/
// chairperson actions — the people who'd actually hand this report to
// a bank or SACCO federation.
router.post(
  '/:chamaId/trust-score/generate',
  protect,
  requireChamaTreasurerOrChairperson,
  generateTrustScoreController
);
router.post(
  '/:chamaId/trust-score/:trustScoreId/share',
  protect,
  requireChamaTreasurerOrChairperson,
  createShareLinkController
);
router.post(
  '/:chamaId/trust-score/:trustScoreId/revoke',
  protect,
  requireChamaTreasurerOrChairperson,
  revokeShareLinkController
);

export default router;