import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  createBusiness,
  createExpense,
  createSale,
  customerPayout,
  getSummary,
  listExpenses,
  listSales,
} from "./business.controller.js";

const router = express.Router();

router.post("/", protect, createBusiness);
router.get("/:businessId/summary", protect, getSummary);
router.get("/:businessId/sales", protect, listSales);
router.post("/:businessId/sales", protect, createSale);
router.get("/:businessId/expenses", protect, listExpenses);
router.post("/:businessId/expenses", protect, createExpense);
router.post("/:businessId/customer-payouts", protect, customerPayout);

export default router;
