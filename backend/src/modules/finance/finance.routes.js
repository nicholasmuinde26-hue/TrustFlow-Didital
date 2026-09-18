import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember } from "../../middleware/chama.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";

import {
    getFinanceSummary,
    getMyFinanceSummary,
    getFinanceTrend,
    getFinanceAccounts,
    getFinanceTransactions,
    getGeneralLedger,
    getGlBalanceStatus,
    getRecentPayments,
    createFinanceOperation,
    getFinanceReport,
    getCashDepositStatusHandler,
    depositCashToBankHandler,
    listBankAccountsHandler,
    createBankAccountHandler,
    updateBankAccountHandler,
    deactivateBankAccountHandler
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

router.get(
    "/:workspaceId/finance/reports",
    requirePermission('reports.view'),
    getFinanceReport
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

export default router;