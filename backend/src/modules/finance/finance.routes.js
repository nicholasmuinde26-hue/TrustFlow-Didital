import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import {
    requireChamaMember,
    requireChamaTreasurer,
    requireChamaTreasurerOrChairperson
} from "../../middleware/chama.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";
import {
    hubDashboard,
    hubMatrix,
    hubMyMonth,
    hubStatement
} from "../contributionPlan/contributionHub.controller.js";

import {
    getFinanceSummary,
    getMyFinanceSummary,
    getMyWalletController,
    depositToMemberWalletController,
    withdrawFromMemberWalletController,
    setMemberWalletPinController,
    changeMemberWalletPinController,
    withdrawProfitWalletController,
    getFinanceTrend,
    getFinanceAccounts,
    getFinanceTransactions,
    getGeneralLedger,
    getGlBalanceStatus,
    getRecentPayments,
    getContributionsRegisterHandler,
    getMyWorkspacePermissions,
    createFinanceOperation,
    getFinanceReport,
    getBusinessFundsHandler,
    previewBusinessFundSeparationHandler,
    applyBusinessFundSeparationHandler,
    getCashDepositStatusHandler,
    depositCashToBankHandler,
    listBankAccountsHandler,
    createBankAccountHandler,
    updateBankAccountHandler,
    deactivateBankAccountHandler,
    listAdjustmentsHandler,
    getAdjustmentHandler,
    requestAdjustmentHandler,
    decideAdjustmentHandler,
    cancelAdjustmentHandler,
    listReconciliationSessionsHandler,
    getReconciliationSessionHandler,
    createReconciliationSessionHandler,
    addReconciliationLinesHandler,
    autoMatchReconciliationHandler,
    matchReconciliationLineHandler,
    unmatchReconciliationLineHandler,
    ignoreReconciliationLineHandler,
    raiseAdjustmentForLineHandler,
    completeReconciliationSessionHandler
} from "./finance.controller.js";

const router = express.Router();

router.use(protect);

// requirePermission() below needs req.membership, which nothing else in
// this router sets - without this, every finance route 401s with
// MEMBERSHIP_CONTEXT_REQUIRED regardless of the user's actual role.
// Mirrors the pattern in loan.routes.js (router.use('/:chamaId/loans', requireChamaMember)).
router.use("/:workspaceId/finance", requireChamaMember);

// Financial viewing - basic permissions
router.get(
    "/:workspaceId/finance/summary",
    requirePermission('finance.summary.view'),
    getFinanceSummary
);
router.post(
    "/:workspaceId/finance/wallet/profit/withdraw",
    requirePermission('finance.summary.view'),
    withdrawProfitWalletController
);

// A plain member's own position — always their own figures, every role,
// so "Your Position" on the Overview page has something real to show
// even when finance.summary.view only grants them 'limited' scope above.
router.get(
    "/:workspaceId/finance/summary/me",
    requirePermission('finance.summary.view'),
    getMyFinanceSummary
);

// Weekly income vs expense trend for the Overview chart — chama-wide,
// so it's gated the same way as the chama-wide summary (officials only).
router.get(
    "/:workspaceId/finance/summary/trend",
    requirePermission('finance.summary.view'),
    getFinanceTrend
);

// My Wallet — one rollup of the caller's own contributions, savings,
// loan outstanding, pending payout and pending withdrawal position.
// Same permission as the other "my own figures" routes above: every
// role can see their own wallet.
router.get(
    "/:workspaceId/finance/wallet",
    requirePermission('finance.summary.view'),
    getMyWalletController
);
router.post("/:workspaceId/finance/wallet/deposit", requirePermission('finance.summary.view'), depositToMemberWalletController);
router.post("/:workspaceId/finance/wallet/withdraw", requirePermission('finance.summary.view'), withdrawFromMemberWalletController);
router.post("/:workspaceId/finance/wallet/pin", requirePermission('finance.summary.view'), setMemberWalletPinController);
router.patch("/:workspaceId/finance/wallet/pin", requirePermission('finance.summary.view'), changeMemberWalletPinController);

router.get(
    "/:workspaceId/finance/accounts",
    requirePermission('finance.accounts.view'),
    getFinanceAccounts
);

router.get(
    "/:workspaceId/finance/transactions",
    requirePermission('finance.transactions.view'),
    getFinanceTransactions
);

router.get(
    "/:workspaceId/finance/ledger",
    requirePermission('finance.transactions.view'),
    getGeneralLedger
);

// GL balance check — is total debits == total credits for this workspace's
// posted ledger entries. Read-only; safe to poll frequently from the
// frontend's GlBalanceGuard.
router.get(
    "/:workspaceId/finance/gl-balance",
    requirePermission('finance.transactions.view'),
    getGlBalanceStatus
);

router.get(
    "/:workspaceId/finance/payments/recent",
    requirePermission('finance.transactions.view'),
    getRecentPayments
);

// ============================================================
// CONTRIBUTIONS REGISTER
// ============================================================
// Everything the Contributions page shows - per-member and per-plan
// expected / collected / outstanding, plus the payment rows themselves -
// computed live off ContributionPayment + ContributionObligation.
// 'contributions.view' is 'all' for officials and 'own' for a plain
// member; the handler narrows the register accordingly.

router.get(
    "/:workspaceId/finance/contributions",
    requirePermission('contributions.view'),
    getContributionsRegisterHandler
);

// ============================================================
// CONTRIBUTIONS HUB
// ============================================================
// One dashboard for every contribution the chama runs (a new plan appears
// the moment it is active), a member-by-contribution matrix for the
// treasurer, the caller's own month view, and per-member statements.
// All take ?month=YYYY-MM. Everything is read-only.

router.get(
    "/:workspaceId/finance/contribution-dashboard",
    requireChamaTreasurerOrChairperson,
    hubDashboard
);
router.get(
    "/:workspaceId/finance/contribution-matrix",
    requireChamaMember,
    hubMatrix
);
router.get(
    "/:workspaceId/finance/contribution-me",
    hubMyMonth
);
// Members get their own; leadership may pass ?memberId= for anyone.
router.get(
    "/:workspaceId/finance/contribution-statement",
    hubStatement
);

// The caller's own effective permissions, so the UI can gate a button on
// the same decision the API will make. No requirePermission gate: this
// only ever describes the caller's own membership.

router.get(
    "/:workspaceId/finance/permissions",
    getMyWorkspacePermissions
);

router.get(
    "/:workspaceId/finance/reports",
    requirePermission('reports.view'),
    getFinanceReport
);

// Business & property fund: income, expenses, profit and balance of chama-owned
// businesses and properties, kept apart from member savings and contributions.
router.get(
    "/:workspaceId/finance/business-funds",
    requirePermission('reports.view'),
    getBusinessFundsHandler
);

// One-off: move business income that was posted into the pooled chama balance
// before the business fund existed. Officials only; the POST writes journal entries.
router.get(
    "/:workspaceId/finance/business-funds/separation",
    requireChamaTreasurerOrChairperson,
    previewBusinessFundSeparationHandler
);
router.post(
    "/:workspaceId/finance/business-funds/separation",
    requireChamaTreasurerOrChairperson,
    applyBusinessFundSeparationHandler
);

// Financial operations - critical security endpoints
router.post(
    "/:workspaceId/finance/operations",
    requirePermission('finance.transactions.create'),
    createFinanceOperation
);

// ============================================================
// CASH DEPOSIT ENFORCEMENT
// ============================================================
// "No money stays as cash" - a treasurer can see how much cash-in-hand is
// outstanding and how close it is to the deposit deadline, and deposit it
// into the bank. Same permission gates as the generic finance operations
// above: view is any role with finance.accounts.view (chairperson,
// treasurer, auditor); depositing is treasurer-only (finance.transactions.create).

router.get(
    "/:workspaceId/finance/cash/status",
    requirePermission('finance.accounts.view'),
    getCashDepositStatusHandler
);

router.post(
    "/:workspaceId/finance/cash/deposit",
    requirePermission('finance.transactions.create'),
    depositCashToBankHandler
);

// ============================================================
// BANK ACCOUNTS
// ============================================================
// Registered real-world bank account(s) the chama deposits cash into.

router.get(
    "/:workspaceId/finance/bank-accounts",
    requirePermission('finance.accounts.view'),
    listBankAccountsHandler
);

router.post(
    "/:workspaceId/finance/bank-accounts",
    requirePermission('finance.transactions.create'),
    createBankAccountHandler
);

router.patch(
    "/:workspaceId/finance/bank-accounts/:bankAccountId",
    requirePermission('finance.transactions.create'),
    updateBankAccountHandler
);

router.delete(
    "/:workspaceId/finance/bank-accounts/:bankAccountId",
    requirePermission('finance.transactions.create'),
    deactivateBankAccountHandler
);

// ============================================================
// LEDGER ADJUSTMENTS (adjustment-approval workflow)
// ============================================================
// A treasurer proposes a manual DR/CR correction; an independent
// chairperson/treasurer signs off before it posts. See adjustment.service.js.

router.get(
    "/:workspaceId/finance/adjustments",
    requirePermission('finance.transactions.view'),
    listAdjustmentsHandler
);

router.get(
    "/:workspaceId/finance/adjustments/:adjustmentId",
    requirePermission('finance.transactions.view'),
    getAdjustmentHandler
);

router.post(
    "/:workspaceId/finance/adjustments",
    requireChamaTreasurer,
    requestAdjustmentHandler
);

router.post(
    "/:workspaceId/finance/adjustments/:adjustmentId/decide",
    requireChamaTreasurerOrChairperson,
    decideAdjustmentHandler
);

// Cancellation is self-gated inside cancelAdjustment() - the initiator,
// chairperson, or treasurer may cancel a still-pending adjustment - so
// this route only needs the base chama-membership check already applied
// above via router.use(requireChamaMember).
router.post(
    "/:workspaceId/finance/adjustments/:adjustmentId/cancel",
    cancelAdjustmentHandler
);

// ============================================================
// BANK RECONCILIATION (generic bank reconciliation)
// ============================================================
// Statement-vs-ledger reconciliation sessions against a registered
// ChamaBankAccount. See bankReconciliation.service.js.

router.get(
    "/:workspaceId/finance/reconciliation/sessions",
    requirePermission('finance.transactions.view'),
    listReconciliationSessionsHandler
);

router.get(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId",
    requirePermission('finance.transactions.view'),
    getReconciliationSessionHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions",
    requireChamaTreasurer,
    createReconciliationSessionHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/lines",
    requireChamaTreasurer,
    addReconciliationLinesHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/auto-match",
    requireChamaTreasurer,
    autoMatchReconciliationHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/lines/:lineId/match",
    requireChamaTreasurer,
    matchReconciliationLineHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/lines/:lineId/unmatch",
    requireChamaTreasurer,
    unmatchReconciliationLineHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/lines/:lineId/ignore",
    requireChamaTreasurer,
    ignoreReconciliationLineHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/lines/:lineId/raise-adjustment",
    requireChamaTreasurer,
    raiseAdjustmentForLineHandler
);

router.post(
    "/:workspaceId/finance/reconciliation/sessions/:sessionId/complete",
    requireChamaTreasurer,
    completeReconciliationSessionHandler
);

export default router;
