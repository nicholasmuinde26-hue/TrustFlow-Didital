import express from "express";

import {
  getComplianceObligationController,
  setComplianceObligationActiveController,
  addComplianceCycleController,
  recordComplianceCyclePaymentController,
  waiveComplianceCycleController,
} from "./assetCompliance.controller.js";

import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember, requireChamaTreasurerOrChairperson } from "../../middleware/chama.middleware.js";

import { requireModule } from '../../middleware/module.middleware.js';
// Mounted at /api/v1/chamas/:chamaId/compliance-obligations — the
// obligation has already been created (see chamaAsset.routes.js POST
// /:assetId/compliance) by this point, same split as
// assetLease.routes.js vs chamaAsset.routes.js POST /:assetId/leases.
const router = express.Router({ mergeParams: true });

router.get("/:obligationId", protect, requireChamaMember, requireModule('property_leases'), getComplianceObligationController);

// Turning an obligation on/off (asset disposed, permit discontinued) is
// routine and reversible — same tier as recording income/expense.
router.patch("/:obligationId", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, setComplianceObligationActiveController);

router.post("/:obligationId/cycles", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, addComplianceCycleController);

// Paying a cycle posts a real ledger expense — same tier as any other
// asset expense entry.
router.post("/:obligationId/cycles/:cycleId/pay", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, recordComplianceCyclePaymentController);
router.post("/:obligationId/cycles/:cycleId/waive", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, waiveComplianceCycleController);

export default router;
