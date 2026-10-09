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
  listChamaBusinessWorkspacesController,
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
  getPortfolioDashboardController,
} from "./chamaAsset.controller.js";
import { createLeaseController, listLeasesController } from "./assetLease.controller.js";
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
router.get("/", protect, requireChamaMember, requireModule('assets'), listChamaAssetsController);
router.get("/portfolio-dashboard", protect, requireChamaMember, requireModule('assets'), getPortfolioDashboardController);
router.get("/proposals", protect, requireChamaMember, requireModule('assets'), listInvestmentProposalsController);
router.get("/distributions", protect, requireChamaMember, requireModule('assets'), listProfitDistributionsController);
router.post("/distributions/:distributionId/respond", protect, requireChamaMember, requireModule('assets'), respondProfitDistributionController);
router.post("/proposals", protect, requireChamaMember, requireModule('assets'), createInvestmentProposalController);
router.get(
  "/business-workspace-requests",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipSession,
  listChamaBusinessWorkspaceRequestsController
);
router.get(
  "/business-workspaces",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipSession,
  listChamaBusinessWorkspacesController
);
router.post(
  "/business-workspace-requests",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.REGISTER_CHAMA_ASSET),
  requestChamaBusinessWorkspaceController
);
router.post("/proposals/:proposalId/decision", protect, requireChamaMember, requireModule('assets'), decideInvestmentProposalController);
router.post(
  "/proposals/:proposalId/acquire",
  protect,
  requireChamaMember, requireModule('assets'),
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
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.REGISTER_CHAMA_ASSET),
  requestChamaAssetController
);

router.post(
  "/:assetId/approve",
  protect,
  requireChamaMember, requireModule('assets'),
  approveChamaAssetController
);

router.post(
  "/:assetId/reject",
  protect,
  requireChamaMember, requireModule('assets'),
  rejectChamaAssetController
);

// Recording income is routine (not destructive), so it only needs the
// treasurer/chairperson role — no PIN step-up — same tier as marking an
// MGR obligation paid.
router.post(
  "/:assetId/income",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  recordChamaAssetIncomeController
);
router.post("/:assetId/expense", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, recordChamaAssetExpenseController);

// Progress dashboard — income vs. target, occupancy/lease status,
// outstanding balance, ROI, and the acquisition/valuation timeline.
// Deliberately open to ANY active member, unlike the money-movement
// routes around it: members are co-owners, and this transparency is
// what heads off "what happened to our land" disputes. See
// chamaAsset.service.js#getAssetProgress.
router.get("/:assetId/progress", protect, requireChamaMember, requireModule('assets'), getAssetProgressController);

// Recording a valuation update is routine and non-destructive (it never
// touches the ledger) — same tier as recording income/expense.
router.post("/:assetId/valuation", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, recordAssetValuationController);

// Leases — standing rent/lease-out arrangements against this asset (cash,
// in-kind, or both), with per-season/per-month expected-vs-received
// tracking. See assetLease.routes.js (mounted at /chamas/:chamaId/leases)
// for everything that operates on an existing lease.
router.post("/:assetId/leases", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, createLeaseController);
router.get("/:assetId/leases", protect, requireChamaMember, requireModule('assets'), listLeasesController);
router.post("/:assetId/funding", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, fundChamaBusinessController);
router.post("/:assetId/distributions", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, createProfitDistributionController);
router.get("/:assetId/transactions", protect, requireChamaMember, requireModule('assets'), listChamaAssetTransactionsController);
router.get("/:assetId/expenses/breakdown", protect, requireChamaMember, requireModule('assets'), getAssetExpenseBreakdownController);

// ============================================================
// MANAGER ACCOUNTABILITY LOOP
// ============================================================

// Periodic structured reports — open to every member (transparency),
// submission restricted inside the controller/service to the assigned
// manager or leadership-on-their-behalf, acknowledgement to leadership.
router.get("/:assetId/reports", protect, requireChamaMember, requireModule('assets'), listReportPeriodsController);
router.post("/:assetId/reports/:reportId/submit", protect, requireChamaMember, requireModule('assets'), submitManagerReportController);
router.post("/:assetId/reports/:reportId/acknowledge", protect, requireChamaMember, requireModule('assets'), requireSecretaryOrManager, acknowledgeManagerReportController);

// Turning reporting off for an asset, or switching monthly ↔ quarterly, is
// a leadership call (same tier as recording income/expense).
router.patch("/:assetId/reporting", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, setManagerReportingConfigController);

// Cross-asset manager performance history — any member can look this up
// ahead of a rotation decision.
router.get("/managers/:userId/performance", protect, requireChamaMember, requireModule('assets'), getManagerPerformanceController);

// Member-raised discrepancy flags on an income/expense entry — routed
// through the same multi-signatory ApprovalRequest engine as an asset
// registration or investment decision (see chamaAsset.service.js).
// Flagging itself is open to any member; approvalService enforces who
// may actually clear it, same as decideInvestmentProposalController.
router.post("/:assetId/transactions/:transactionId/flag", protect, requireChamaMember, requireModule('assets'), flagAssetTransactionDiscrepancyController);
router.post("/:assetId/transactions/:transactionId/flag/decision", protect, requireChamaMember, requireModule('assets'), decideAssetTransactionDiscrepancyController);
router.get("/discrepancies", protect, requireChamaMember, requireModule('assets'), listAssetTransactionDiscrepanciesController);

// Reconciliation queue — manager-reported M-Pesa income across all of
// this chama's assets that hasn't yet matched a real Safaricom
// confirmation. Leadership-only: this is a financial control surface,
// not a routine dashboard read.
router.get("/reconciliation/unverified", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, listUnverifiedAssetIncomeController);
router.post("/reconciliation/:transactionId/verify", protect, requireChamaMember, requireModule('assets'), requireChamaTreasurerOrChairperson, manuallyVerifyAssetIncomeController);

// Recomputing from contribution history is routine and reversible — no
// PIN step-up, same tier as recording income/expense.
router.post(
  "/:assetId/ownership/recalculate",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  recalculateAssetOwnershipController
);

// Manually overriding who owns what % of an asset is as sensitive as
// registering the asset itself — same PIN step-up tier.
router.post(
  "/:assetId/ownership/override",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.SET_ASSET_OWNERSHIP),
  setAssetOwnershipOverrideController
);

router.post(
  "/:assetId/ownership/unlock",
  protect,
  requireChamaMember, requireModule('assets'),
  requireChamaTreasurerOrChairperson,
  requireLeadershipStepUp(STEP_UP_ACTIONS.SET_ASSET_OWNERSHIP),
  unlockAssetOwnershipController
);

// Assigning a caretaker is reversible and routine — no step-up.
router.post(
  "/:assetId/manager",
  protect,
  requireChamaMember, requireModule('assets'),
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
  requireChamaMember, requireModule('assets'),
  setAssetOperationalStatusController
);

export default router;