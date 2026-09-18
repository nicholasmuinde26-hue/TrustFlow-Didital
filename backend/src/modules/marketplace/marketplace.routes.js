import express from "express";
import {
  getCategories,
  getCategoryBySlug,
  searchListings,
  getListingDetail,
  getBusinessProfile,
  processCheckout,
  trackOrder,
} from "./marketplace.controller.js";
import User from "../../models/User.js";
import { verifyAccessToken, verifyToken } from "../../utils/jwt.js";

const router = express.Router();

// Optional auth helper for guest / logged-in checkout
const optionalAuth = async (req, res, next) => {
  try {
    let token = null;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const verifyFn = verifyAccessToken || verifyToken;
      const decoded = verifyFn(token);
      if (decoded && decoded.id && decoded.type !== "otp_pending") {
        const user = await User.findById(decoded.id).select("-password");
        if (user && user.status === "active") {
          req.user = user;
        }
      }
    }
  } catch {
    // Ignore auth failure for optional routes
  }
  next();
};

// ============================================================================
// PUBLIC MARKETPLACE ROUTES (No login required)
// ============================================================================

// Categories & Hubs
router.get("/categories", getCategories);
router.get("/categories/:slug", getCategoryBySlug);

// Product & Listing Search & Discovery
router.get("/listings", searchListings);
router.get("/listings/:slug", getListingDetail);
router.get("/:category/listings/:slug", getListingDetail);

// Branded Business / Merchant Public Storefront Profile
router.get("/businesses/:businessSlug", getBusinessProfile);

// Order Tracking
router.get("/orders/track/:orderNumber", trackOrder);

// Multi-Vendor & Single-Merchant Cart Checkout
router.post("/cart/checkout", optionalAuth, processCheckout);

export default router;
