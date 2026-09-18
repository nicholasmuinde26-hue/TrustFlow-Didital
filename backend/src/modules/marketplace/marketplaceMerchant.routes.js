import express from "express";
import {
  getEnrollmentStatus,
  enrollInHub,
  getMerchantListings,
  submitListing,
  updateListing,
  deleteListing,
  toggleVisibility,
  toggleOccupancy,
  getMerchantOrders,
  updateFulfillment,
  getSettlements,
} from "./marketplaceMerchant.controller.js";
import { protect } from "../../middleware/auth.middleware.js";

const router = express.Router({ mergeParams: true });

// All merchant portal routes require authentication
router.use(protect);

// Category Enrollments
router.get("/status", getEnrollmentStatus);
router.post("/enroll", enrollInHub);

// Listings Management & Submission
router.get("/listings", getMerchantListings);
router.post("/listings", submitListing);
router.put("/listings/:listingId", updateListing);
router.delete("/listings/:listingId", deleteListing);
router.patch("/listings/:listingId/visibility", toggleVisibility);
router.patch("/listings/:listingId/occupancy", toggleOccupancy);

// Marketplace Orders & Fulfillment
router.get("/orders", getMerchantOrders);
router.patch("/orders/:orderId/fulfillment", updateFulfillment);

// Net Settlements & Balances
router.get("/settlements", getSettlements);

export default router;
