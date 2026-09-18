import express from 'express';

import {
  raiseDisputeController,
  listDisputesController,
  updateDisputeStatusController,
} from './Dispute.controller.js';

import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireSecretaryOrManager } from '../../middleware/chama.middleware.js';

const router = express.Router();

// Any active member can raise a dispute, and can list (their own — see
// listDisputes' viewerCanSeeAll scoping) disputes.
router.post('/:chamaId/disputes', protect, requireChamaMember, raiseDisputeController);
router.get('/:chamaId/disputes', protect, requireChamaMember, listDisputesController);

// Moving a dispute along (investigate/resolve/dismiss) is an official
// action — chairperson, treasurer, or secretary — with self-resolution
// blocked inside the service regardless of which of the three it is.
router.patch(
  '/:chamaId/disputes/:disputeId',
  protect,
  requireChamaMember,
  requireSecretaryOrManager,
  updateDisputeStatusController
);

export default router;