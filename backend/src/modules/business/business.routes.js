import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { trackBusinessActivity } from "./businessActivity.middleware.js";
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
  getChamaDashboard,
  getSettings,
  updateSettings,
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
  publishInventoryItem,
  unpublishInventoryItem,
  publishInventoryBulk,
  posSale,
  getPosReceipt,
  listRentalListings,
  addRentalListing,
  editRentalListing,
  setRentalListingStatus,
  removeRentalListing,
  listRentalInquiries,
  setRentalInquiryStatus,
  listBusinessStaff,
  appointBusinessStaff,
  revokeBusinessStaff,
  getBusinessActivity,
} from "./business.controller.js";

const router = express.Router();

// Any signed-in user can register a personal business. Chama-owned businesses
// are never created here: they go through a workspace request that platform
// admins approve (see workspaceRequest.controller.js / approveWorkspaceRequest).
router.post("/", protect, createBusiness);
router.get("/:businessId/summary", protect, getSummary);
router.get("/:businessId/chama-dashboard", protect, getChamaDashboard);
router.get("/:businessId/settings", protect, getSettings);
router.put("/:businessId/settings", protect, trackBusinessActivity("settings.updated"), updateSettings);
router.get("/:businessId/staff", protect, listBusinessStaff);
router.post("/:businessId/staff", protect, trackBusinessActivity("staff.appointed"), appointBusinessStaff);
router.delete("/:businessId/staff/:staffId", protect, trackBusinessActivity("staff.access_revoked"), revokeBusinessStaff);
router.get("/:businessId/activity", protect, getBusinessActivity);
router.get("/:businessId/sales", protect, listSales);
router.post("/:businessId/sales", protect, trackBusinessActivity("sales.recorded"), createSale);
router.get("/:businessId/expenses", protect, listExpenses);
router.post("/:businessId/expenses", protect, trackBusinessActivity("expenses.recorded"), createExpense);
router.post("/:businessId/customer-payouts", protect, trackBusinessActivity("customer_payout.initiated"), customerPayout);
router.post("/:businessId/mpesa/stkpush", protect, trackBusinessActivity("mpesa_payment.initiated"), initiateStkPush);
router.get("/:businessId/mpesa/stkpush/query/:transactionId", protect, queryStkStatus);
router.post("/:businessId/transactions/:transactionId/complete", protect, trackBusinessActivity("transaction.completed_manually"), forceCompleteTransaction);

// Kitchen prep status (restaurant category) — separate from payment status above
router.patch("/:businessId/transactions/:transactionId/kitchen-status", protect, trackBusinessActivity("kitchen.order_updated"), setKitchenStatus);

router.get("/:businessId/customers", protect, listCustomers);
router.post("/:businessId/customers", protect, trackBusinessActivity("customers.created"), createCustomer);

router.get("/:businessId/suppliers", protect, listSuppliers);
router.post("/:businessId/suppliers", protect, trackBusinessActivity("suppliers.created"), createSupplier);

router.get("/:businessId/accounts", protect, getBusinessAccounts);

// Inventory & Stock — same catalog the POS grid and marketplace both read from
router.get("/:businessId/inventory", protect, listInventory);
router.post("/:businessId/inventory", protect, trackBusinessActivity("inventory.item_added"), addInventoryItem);
router.put("/:businessId/inventory/:itemId", protect, trackBusinessActivity("inventory.item_updated"), editInventoryItem);
router.delete("/:businessId/inventory/:itemId", protect, trackBusinessActivity("inventory.item_removed"), removeInventoryItem);
router.post("/:businessId/inventory/:itemId/restock", protect, trackBusinessActivity("inventory.restocked_or_counted"), restockInventoryItem);
router.post("/:businessId/inventory/publish-bulk", protect, trackBusinessActivity("inventory.published_bulk"), publishInventoryBulk);
router.post("/:businessId/inventory/:itemId/publish", protect, trackBusinessActivity("inventory.published"), publishInventoryItem);
router.post("/:businessId/inventory/:itemId/unpublish", protect, trackBusinessActivity("inventory.unpublished"), unpublishInventoryItem);

// Point of Sale — checkout that deducts live stock on completion
router.post("/:businessId/pos/sale", protect, trackBusinessActivity("pos.sale_recorded"), posSale);
router.get("/:businessId/pos/receipts/:transactionId", protect, getPosReceipt);

// Rental listings (rooms & plots) — for category: "rental" businesses
router.get("/:businessId/rental-listings", protect, listRentalListings);
router.post("/:businessId/rental-listings", protect, trackBusinessActivity("rental.listing_created"), addRentalListing);
router.put("/:businessId/rental-listings/:listingId", protect, trackBusinessActivity("rental.listing_updated"), editRentalListing);
router.patch("/:businessId/rental-listings/:listingId/status", protect, trackBusinessActivity("rental.status_updated"), setRentalListingStatus);
router.delete("/:businessId/rental-listings/:listingId", protect, trackBusinessActivity("rental.listing_removed"), removeRentalListing);

// Rental enquiries (leads) for this business
router.get("/:businessId/rental-inquiries", protect, listRentalInquiries);
router.patch("/:businessId/rental-inquiries/:inquiryId/status", protect, trackBusinessActivity("rental.inquiry_updated"), setRentalInquiryStatus);

export default router;
