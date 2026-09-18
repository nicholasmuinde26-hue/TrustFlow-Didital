import express from "express";
import {
  getModerationQueue,
  reviewListing,
  getEnrollments,
  reviewEnrollment,
  updateCategoryDesign,
  getAnalytics,
} from "./marketplaceAdmin.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { requireAdmin } from "../../middleware/admin.middleware.js";

const router = express.Router();

// All marketplace admin routes require authentication and admin privileges
router.use(protect, requireAdmin);

// Moderation Queue & Listing Review
router.get("/queue", getModerationQueue);
router.post("/listings/:id/review", reviewListing);

// Merchant Category Enrollments
router.get("/enrollments", getEnrollments);
router.post("/enrollments/:id/review", reviewEnrollment);

// Hub Design & Banners
router.put("/categories/:slug/design", updateCategoryDesign);

// Marketplace Overview & Performance Analytics
router.get("/analytics", getAnalytics);

export default router;
