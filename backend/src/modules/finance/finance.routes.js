import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { requirePermission } from "../../middleware/permission.middleware.js";

import {
    getFinanceSummary,
    getFinanceAccounts,
    getFinanceTransactions,
    getGeneralLedger,
    getRecentPayments,
    createFinanceOperation,
    getFinanceReport
} from "./finance.controller.js";

const router = express.Router();

router.use(protect);

// Financial viewing - basic permissions
router.get(
    "/:workspaceId/finance/summary",
    requirePermission('finance.summary.view'),
    getFinanceSummary
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

export default router;
