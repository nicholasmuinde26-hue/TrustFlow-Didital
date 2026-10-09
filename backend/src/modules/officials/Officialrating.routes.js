import express from 'express';

import {
  listRateableOfficialsController,
  submitOfficialRatingController,
  getOfficialRatingDetailController,
} from './Officialrating.controller.js';

import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireAuditAccess } from '../../middleware/chama.middleware.js';

import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();

router.get('/:chamaId/officials', protect, requireChamaMember, requireModule('officials'), listRateableOfficialsController);

router.post(
  '/:chamaId/officials/:membershipId/ratings',
  protect,
  requireChamaMember, requireModule('officials'),
  submitOfficialRatingController
);

// Raw per-rater breakdown (with comments) — restricted the same way the
// full audit log is (Treasurer/Auditor), deliberately narrower than
// "any manager", so the Chairperson (who could themselves be the
// subject of a rating) doesn't automatically get to see who said what.
router.get(
  '/:chamaId/officials/:membershipId/ratings',
  protect,
  requireAuditAccess,
  getOfficialRatingDetailController
);

export default router;