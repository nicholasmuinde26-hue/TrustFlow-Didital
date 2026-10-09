import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import {
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  requireChamaLeadershipOfficial,
} from '../../middleware/chama.middleware.js';
import {
  status, snapshot, start, finalize, cancel, verify, openings, seedOpenings,
} from './yearEnd.controller.js';

const router = express.Router({ mergeParams: true });

// Any member can see whether their year is open / closing / closed.
router.get('/:yearId', protect, requireChamaMember, status);

// Per-account figures and integrity checks are leadership-only.
router.get('/:yearId/snapshot', protect, requireChamaMember, requireChamaLeadershipOfficial, snapshot);
router.get('/:yearId/verify', protect, requireChamaMember, requireChamaLeadershipOfficial, verify);
router.get('/:yearId/openings', protect, requireChamaMember, requireChamaLeadershipOfficial, openings);

// Starting, finalizing, cancelling: Treasurer / Chairperson. Finalizing still
// needs the ApprovalRequest to be approved (via POST /api/v1/approvals/:id/signoff).
router.post('/:yearId/start', protect, requireChamaMember, requireChamaTreasurerOrChairperson, start);
router.post('/:yearId/finalize', protect, requireChamaMember, requireChamaTreasurerOrChairperson, finalize);
router.post('/:yearId/cancel', protect, requireChamaMember, requireChamaTreasurerOrChairperson, cancel);
router.post('/:yearId/openings/seed', protect, requireChamaMember, requireChamaTreasurerOrChairperson, seedOpenings);

export default router;
