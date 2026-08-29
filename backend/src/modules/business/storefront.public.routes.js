import express from "express";
import {
  getPublicStorefront,
  placeStorefrontOrder,
  trackOrder,
  submitRentalInquiry,
} from "./storefront.public.controller.js";

// NOTE: intentionally no `protect` middleware anywhere in this file.
// This router is the buyer-facing surface — a seller shares just the
// storefront URL, and the person on the other end never touches the
// authenticated business-management app at all.
const router = express.Router();

router.get("/track/:orderCode", trackOrder);
router.get("/:slug", getPublicStorefront);
router.post("/:slug/orders", placeStorefrontOrder);
router.post("/:slug/listings/:listingId/inquiries", submitRentalInquiry);

export default router;