import express from "express";

import { protect } from "../../middleware/auth.middleware.js";

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

router.get(
    "/:workspaceId/finance/summary",
    getFinanceSummary
);

router.post("/:workspaceId/finance/operations", createFinanceOperation);

router.get(
    "/:workspaceId/finance/accounts",
    getFinanceAccounts
);

router.get(
    "/:workspaceId/finance/transactions",
    getFinanceTransactions
);

router.get(
    "/:workspaceId/finance/ledger",
    getGeneralLedger
);

router.get(
    "/:workspaceId/finance/payments/recent",
    getRecentPayments
);

router.get(
    "/:workspaceId/finance/reports",
    getFinanceReport
);

export default router;