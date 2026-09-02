import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember } from '../../middleware/chama.middleware.js';
import {
  getChamaApprovals,
  getApprovalById,
  submitSignoff,
} from './approval.controller.js';

const router = express.Router();

router.use(protect);

router.get('/chama/:chamaId', requireChamaMember, getChamaApprovals);
router.get('/:requestId', getApprovalById);
router.post('/:requestId/signoff', submitSignoff);

export default router;
