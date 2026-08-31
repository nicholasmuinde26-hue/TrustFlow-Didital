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
  setKitchenStatus,
  getSummary,
  listExpenses,
  listSales,
  listCustomers,
  createCustomer,
  listSuppliers,
  createSupplier,
  getBusinessAccounts,
  listInventory,
  addInventoryItem,
  editInventoryItem,
  removeInventoryItem,
  restockInventoryItem,
  posSale,
  getStorefront,
  putStorefront,
  getStorefrontOrders,
  patchStorefrontOrderStatus,
  listRentalListings,
  addRentalListing,
  editRentalListing,
  setRentalListingStatus,
  removeRentalListing,
  listRentalInquiries,
  setRentalInquiryStatus,
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

// Kitchen prep status (restaurant category) — separate from payment status above
router.patch("/:businessId/transactions/:transactionId/kitchen-status", protect, setKitchenStatus);

router.get("/:businessId/customers", protect, listCustomers);
router.post("/:businessId/customers", protect, createCustomer);

router.get("/:businessId/suppliers", protect, listSuppliers);
router.post("/:businessId/suppliers", protect, createSupplier);

router.get("/:businessId/accounts", protect, getBusinessAccounts);

// Inventory & Stock — same catalog the POS grid and storefront both read from
router.get("/:businessId/inventory", protect, listInventory);
router.post("/:businessId/inventory", protect, addInventoryItem);
router.put("/:businessId/inventory/:itemId", protect, editInventoryItem);
router.delete("/:businessId/inventory/:itemId", protect, removeInventoryItem);
router.post("/:businessId/inventory/:itemId/restock", protect, restockInventoryItem);

// Point of Sale — checkout that deducts live stock on completion
router.post("/:businessId/pos/sale", protect, posSale);

// Rental listings (rooms & plots) — for category: "rental" businesses
router.get("/:businessId/rental-listings", protect, listRentalListings);
router.post("/:businessId/rental-listings", protect, addRentalListing);
router.put("/:businessId/rental-listings/:listingId", protect, editRentalListing);
router.patch("/:businessId/rental-listings/:listingId/status", protect, setRentalListingStatus);
router.delete("/:businessId/rental-listings/:listingId", protect, removeRentalListing);

// Leads generated from the public storefront's "Inquire" form
router.get("/:businessId/rental-inquiries", protect, listRentalInquiries);
router.patch("/:businessId/rental-inquiries/:inquiryId/status", protect, setRentalInquiryStatus);

// Storefront configuration & order fulfillment (owner/staff side)
router.get("/:businessId/storefront", protect, getStorefront);
router.put("/:businessId/storefront", protect, putStorefront);
router.get("/:businessId/storefront-orders", protect, getStorefrontOrders);
router.patch("/:businessId/storefront-orders/:orderId/status", protect, patchStorefrontOrderStatus);

export default router;