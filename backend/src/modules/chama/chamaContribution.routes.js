import express from "express";

import {
  createController,
  listController,
  getController,
  approveController,
  rejectController,
  contributeController,
  recordCashController,
  closeCollectionController,
  proposePayoutController,
  disburseController,
  cancelController,
} from "./chamaContribution.controller.js";

import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember, requireSecretaryOrManager } from "../../middleware/chama.middleware.js";

const router = express.Router();

router.use(protect);

// ========================================
// CREATE / LIST / GET
// ========================================
// Any active member can propose a new internal contribution and can see
// the ones already running.

router.post("/:id/chama-contributions", requireChamaMember, createController);
router.get("/:id/chama-contributions", requireChamaMember, listController);
router.get("/:id/chama-contributions/:contributionId", requireChamaMember, getController);

// ========================================
// APPROVE / REJECT
// ========================================
// Chairperson, Treasurer, or Secretary only - a member-proposed
// contribution can't start collecting money until an official opens it.

router.patch("/:id/chama-contributions/:contributionId/approve", requireChamaMember, requireSecretaryOrManager, approveController);
router.patch("/:id/chama-contributions/:contributionId/reject", requireChamaMember, requireSecretaryOrManager, rejectController);

// ========================================
// CHIP IN
// ========================================
// Any active member, free-form amount, via M-Pesa STK push.

router.post("/:id/chama-contributions/:contributionId/contribute", requireChamaMember, contributeController);

// An official recording an already-settled cash chip-in on a member's behalf.
router.post(
  "/:id/chama-contributions/:contributionId/record-cash",
  requireChamaMember,
  requireSecretaryOrManager,
  recordCashController
);

// ========================================
// CLOSE / PAYOUT / CANCEL
// ========================================

router.patch(
  "/:id/chama-contributions/:contributionId/close",
  requireChamaMember,
  requireSecretaryOrManager,
  closeCollectionController
);

router.post(
  "/:id/chama-contributions/:contributionId/propose-payout",
  requireChamaMember,
  requireSecretaryOrManager,
  proposePayoutController
);

router.post(
  "/:id/chama-contributions/:contributionId/disburse",
  requireChamaMember,
  requireSecretaryOrManager,
  disburseController
);

router.patch("/:id/chama-contributions/:contributionId/cancel", requireChamaMember, requireSecretaryOrManager, cancelController);

export default router;
