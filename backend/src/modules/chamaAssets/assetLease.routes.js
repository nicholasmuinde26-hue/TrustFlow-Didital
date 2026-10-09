import express from "express";

import {
  listChamaAssetsController,
  requestChamaAssetController,
  approveChamaAssetController,
  rejectChamaAssetController,
  recordChamaAssetIncomeController,
  recordChamaAssetExpenseController,
  listChamaAssetTransactionsController,
  createInvestmentProposalController,
  decideInvestmentProposalController,
  completeInvestmentAcquisitionController,
  listInvestmentProposalsController,
  requestChamaBusinessWorkspaceController,
  listChamaBusinessWorkspaceRequestsController,
  fundChamaBusinessController,
  listProfitDistributionsController,
  createProfitDistributionController,
  respondProfitDistributionController,
  recalculateAssetOwnershipController,
  setAssetOwnershipOverrideController,
  unlockAssetOwnershipController,
  assignAssetManagerController,
  setAssetOperationalStatusController,
  getAssetExpenseBreakdownController,
  listUnverifiedAssetIncomeController,
  manuallyVerifyAssetIncomeController,
  getAssetProgressController,
  recordAssetValuationController,
  flagAssetTransactionDiscrepancyController,
  decideAssetTransactionDiscrepancyController,
  listAssetTransactionDiscrepanciesController,
} from "./chamaAsset.controller.js";
import { createLeaseController, listLeasesController } from "./assetLease.controller.js";
import { createComplianceObligationController, listComplianceObligationsController } from "./assetCompliance.controller.js";
import {
  listReportPeriodsController,
  submitManagerReportController,
  acknowledgeManagerReportController,
  getManagerPerformanceController,
  setManagerReportingConfigController,
} from "./assetManagerReport.controller.js";

import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember, requireChamaTreasurerOrChairperson, requireSecretaryOrManager } from "../../middleware/chama.middleware.js";
import {
  requireLeadershipSession,
  requireLeadershipStepUp,
  STEP_UP_ACTIONS,
} from "../../middleware/leadershipSession.middleware.js";

import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router({ mergeParams: true });

// Any member can see what the chama owns — the dashboard depends on this
// to decide whether the Assets & Income panel renders at all.
router.get("/", protect, requireChamaMember, requireModule('property_leases'), listChamaAssetsController);
router.get("/proposals", protect, requireChamaMember, requireModule('property_leases'), listInvestmentProposalsController);
router.get("/distributions", protect, requireChamaMember, requireModule('property_leases'), listProfitDistributionsController);
router.post("/distributions/:distributionId/respond", protect, requireChamaMember, requireModule('property_leases'), respondProfitDistributionController);
router.post("/proposals", protect, requireChamaMember, requireModule('property_leases'), createInvestmentProposalController);
router.get(
  "/business-workspace-requests",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipSession,
  listChamaBusinessWorkspaceRequestsController
);
router.post(
  "/business-workspace-requests",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.REGISTER_CHAMA_ASSET),
  requestChamaBusinessWorkspaceController
);
router.post("/proposals/:proposalId/decision", protect, requireChamaMember, requireModule('property_leases'), decideInvestmentProposalController);
router.post(
  "/proposals/:proposalId/acquire",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.REGISTER_CHAMA_ASSET),
  completeInvestmentAcquisitionController
);

// Registering a new asset after the chama already exists is a sensitive,
// deliberate act — same PIN step-up as deleting a chama or disbursing
// funds, not something reachable by just holding a valid access token.
router.post(
  "/request",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.REGISTER_CHAMA_ASSET),
  requestChamaAssetController
);

router.post(
  "/:assetId/approve",
  protect,
  requireChamaMember, requireModule('property_leases'),
  approveChamaAssetController
);

router.post(
  "/:assetId/reject",
  protect,
  requireChamaMember, requireModule('property_leases'),
  rejectChamaAssetController
);

// Recording income is routine (not destructive), so it only needs the
// treasurer/chairperson role — no PIN step-up — same tier as marking an
// MGR obligation paid.
router.post(
  "/:assetId/income",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  recordChamaAssetIncomeController
);
router.post("/:assetId/expense", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, recordChamaAssetExpenseController);

// Progress dashboard — income vs. target, occupancy/lease status,
// outstanding balance, ROI, and the acquisition/valuation timeline.
// Deliberately open to ANY active member, unlike the money-movement
// routes around it: members are co-owners, and this transparency is
// what heads off "what happened to our land" disputes. See
// chamaAsset.service.js#getAssetProgress.
router.get("/:assetId/progress", protect, requireChamaMember, requireModule('property_leases'), getAssetProgressController);

// Recording a valuation update is routine and non-destructive (it never
// touches the ledger) — same tier as recording income/expense.
router.post("/:assetId/valuation", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, recordAssetValuationController);

// Leases — standing rent/lease-out arrangements against this asset (cash,
// in-kind, or both), with per-season/per-month expected-vs-received
// tracking. See assetLease.routes.js (mounted at /chamas/:chamaId/leases)
// for everything that operates on an existing lease.
router.post("/:assetId/leases", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, createLeaseController);
router.get("/:assetId/leases", protect, requireChamaMember, requireModule('property_leases'), listLeasesController);

// Compliance obligations — recurring dues owed to an outside authority
// because the chama owns this asset (land rates, a business permit).
// See assetCompliance.routes.js (mounted at /chamas/:chamaId/compliance-obligations)
// for everything that operates on an existing obligation/cycle.
router.post("/:assetId/compliance", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, createComplianceObligationController);
router.get("/:assetId/compliance", protect, requireChamaMember, requireModule('property_leases'), listComplianceObligationsController);
router.post("/:assetId/funding", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, fundChamaBusinessController);
router.post("/:assetId/distributions", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, createProfitDistributionController);
router.get("/:assetId/transactions", protect, requireChamaMember, requireModule('property_leases'), listChamaAssetTransactionsController);
router.get("/:assetId/expenses/breakdown", protect, requireChamaMember, requireModule('property_leases'), getAssetExpenseBreakdownController);

// ============================================================
// MANAGER ACCOUNTABILITY LOOP
// ============================================================

// Periodic structured reports — open to every member (transparency),
// submission restricted inside the controller/service to the assigned
// manager or leadership-on-their-behalf, acknowledgement to leadership.
router.get("/:assetId/reports", protect, requireChamaMember, requireModule('property_leases'), listReportPeriodsController);
router.post("/:assetId/reports/:reportId/submit", protect, requireChamaMember, requireModule('property_leases'), submitManagerReportController);
router.post("/:assetId/reports/:reportId/acknowledge", protect, requireChamaMember, requireModule('property_leases'), requireSecretaryOrManager, acknowledgeManagerReportController);

// Turning reporting off for an asset, or switching monthly ↔ quarterly, is
// a leadership call (same tier as recording income/expense).
router.patch("/:assetId/reporting", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, setManagerReportingConfigController);

// Cross-asset manager performance history — any member can look this up
// ahead of a rotation decision.
router.get("/managers/:userId/performance", protect, requireChamaMember, requireModule('property_leases'), getManagerPerformanceController);

// Member-raised discrepancy flags on an income/expense entry — routed
// through the same multi-signatory ApprovalRequest engine as an asset
// registration or investment decision (see chamaAsset.service.js).
// Flagging itself is open to any member; approvalService enforces who
// may actually clear it, same as decideInvestmentProposalController.
router.post("/:assetId/transactions/:transactionId/flag", protect, requireChamaMember, requireModule('property_leases'), flagAssetTransactionDiscrepancyController);
router.post("/:assetId/transactions/:transactionId/flag/decision", protect, requireChamaMember, requireModule('property_leases'), decideAssetTransactionDiscrepancyController);
router.get("/discrepancies", protect, requireChamaMember, requireModule('property_leases'), listAssetTransactionDiscrepanciesController);

// Reconciliation queue — manager-reported M-Pesa income across all of
// this chama's assets that hasn't yet matched a real Safaricom
// confirmation. Leadership-only: this is a financial control surface,
// not a routine dashboard read.
router.get("/reconciliation/unverified", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, listUnverifiedAssetIncomeController);
router.post("/reconciliation/:transactionId/verify", protect, requireChamaMember, requireModule('property_leases'), requireChamaTreasurerOrChairperson, manuallyVerifyAssetIncomeController);

// Recomputing from contribution history is routine and reversible — no
// PIN step-up, same tier as recording income/expense.
router.post(
  "/:assetId/ownership/recalculate",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  recalculateAssetOwnershipController
);

// Manually overriding who owns what % of an asset is as sensitive as
// registering the asset itself — same PIN step-up tier.
router.post(
  "/:assetId/ownership/override",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.SET_ASSET_OWNERSHIP),
  setAssetOwnershipOverrideController
);

router.post(
  "/:assetId/ownership/unlock",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.SET_ASSET_OWNERSHIP),
  unlockAssetOwnershipController
);

// Assigning a caretaker is reversible and routine — no step-up.
router.post(
  "/:assetId/manager",
  protect,
  requireChamaMember, requireModule('property_leases'),
  requireChamaTreasurerOrChairperson,
  assignAssetManagerController
);

// Deliberately NOT gated by requireChamaTreasurerOrChairperson — the
// controller itself allows either a leader or this specific asset's
// assigned manager through, since a rotating non-officer project lead
// still needs to update ground-truth status.
router.patch(
  "/:assetId/operational-status",
  protect,
  requireChamaMember, requireModule('property_leases'),
  setAssetOperationalStatusController
);

export default router;