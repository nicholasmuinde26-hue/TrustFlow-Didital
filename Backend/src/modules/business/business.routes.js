import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  createBusiness,
  createExpense,
  createSale,
  customerPayout,
  initiateStkPush,
  queryStkStatus,
  forceCompleteTransaction,
  getSummary,
  listExpenses,
  listSales,
  listCustomers,
  createCustomer,
  listSuppliers,
  createSupplier,
  getBusinessAccounts,
} from "./business.controller.js";

const router = express.Router();

router.post("/", protect, createBusiness);
router.get("/:businessId/summary", protect, getSummary);
router.get("/:businessId/sales", protect, listSales);
router.post("/:businessId/sales", protect, createSale);
router.get("/:businessId/expenses", protect, listExpenses);
router.post("/:businessId/expenses", protect, createExpense);
router.post("/:businessId/customer-payouts", protect, customerPayout);
router.post("/:businessId/mpesa/stkpush", protect, initiateStkPush);
router.get("/:businessId/mpesa/stkpush/query/:transactionId", protect, queryStkStatus);
router.post("/:businessId/transactions/:transactionId/complete", protect, forceCompleteTransaction);

router.get("/:businessId/customers", protect, listCustomers);
router.post("/:businessId/customers", protect, createCustomer);

router.get("/:businessId/suppliers", protect, listSuppliers);
router.post("/:businessId/suppliers", protect, createSupplier);

router.get("/:businessId/accounts", protect, getBusinessAccounts);

export default router;


