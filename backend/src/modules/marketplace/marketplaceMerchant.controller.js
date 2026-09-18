import * as marketplaceService from "./marketplace.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

// GET /api/v1/businesses/:businessId/marketplace/status
export const getEnrollmentStatus = async (req, res, next) => {
  try {
    const enrollments = await marketplaceService.getBusinessEnrollments(req.params.businessId);
    res.json({ success: true, data: enrollments });
  } catch (err) {
    sendError(err, res, next);
  }
};

// POST /api/v1/businesses/:businessId/marketplace/enroll
export const enrollInHub = async (req, res, next) => {
  try {
    const enrollment = await marketplaceService.enrollBusinessInMarketplace(
      req.params.businessId,
      req.body.category_slug,
      req.body.merchant_profile || {},
      req.user._id
    );
    res.status(201).json({ success: true, message: "Enrollment submitted for review", data: enrollment });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/businesses/:businessId/marketplace/listings
export const getMerchantListings = async (req, res, next) => {
  try {
    const listings = await marketplaceService.listMerchantMarketplaceListings(req.params.businessId, {
      categorySlug: req.query.category,
      status: req.query.status,
    });
    res.json({ success: true, data: listings });
  } catch (err) {
    sendError(err, res, next);
  }
};

// POST /api/v1/businesses/:businessId/marketplace/listings
export const submitListing = async (req, res, next) => {
  try {
    const listing = await marketplaceService.submitListingToMarketplace(
      req.params.businessId,
      req.body,
      req.user._id
    );
    res.status(201).json({ success: true, message: "Listing submitted to marketplace moderation queue", data: listing });
  } catch (err) {
    sendError(err, res, next);
  }
};

// PUT /api/v1/businesses/:businessId/marketplace/listings/:listingId
export const updateListing = async (req, res, next) => {
  try {
    const listing = await marketplaceService.updateMerchantMarketplaceListing(
      req.params.businessId,
      req.params.listingId,
      req.body,
      req.user._id
    );
    res.json({ success: true, message: "Listing updated successfully", data: listing });
  } catch (err) {
    sendError(err, res, next);
  }
};

// DELETE /api/v1/businesses/:businessId/marketplace/listings/:listingId
export const deleteListing = async (req, res, next) => {
  try {
    const result = await marketplaceService.deleteMerchantMarketplaceListing(
      req.params.businessId,
      req.params.listingId,
      req.user._id
    );
    res.json(result);
  } catch (err) {
    sendError(err, res, next);
  }
};

// PATCH /api/v1/businesses/:businessId/marketplace/listings/:listingId/visibility
export const toggleVisibility = async (req, res, next) => {
  try {
    const listing = await marketplaceService.toggleListingVisibility(
      req.params.businessId,
      req.params.listingId,
      req.user._id,
      req.body.visibility
    );
    res.json({ success: true, message: `Listing visibility updated to ${listing.visibility}`, data: listing });
  } catch (err) {
    sendError(err, res, next);
  }
};

// PATCH /api/v1/businesses/:businessId/marketplace/listings/:listingId/occupancy
export const toggleOccupancy = async (req, res, next) => {
  try {
    const listing = await marketplaceService.toggleListingOccupancy(
      req.params.businessId,
      req.params.listingId,
      req.user._id,
      req.body.is_occupied
    );
    const isOcc = listing.rental_attributes?.is_occupied;
    res.json({
      success: true,
      message: isOcc ? "Property marked as Occupied / Sold" : "Property marked as Available",
      data: listing,
    });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/businesses/:businessId/marketplace/orders
export const getMerchantOrders = async (req, res, next) => {
  try {
    const result = await marketplaceService.listMerchantMarketplaceOrders(req.params.businessId, {
      fulfillmentStatus: req.query.status,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// PATCH /api/v1/businesses/:businessId/marketplace/orders/:orderId/fulfillment
export const updateFulfillment = async (req, res, next) => {
  try {
    const order = await marketplaceService.updateMerchantFulfillmentStatus(
      req.params.businessId,
      req.params.orderId,
      { fulfillmentStatus: req.body.fulfillment_status }
    );
    res.json({ success: true, message: "Order fulfillment status updated", data: order });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/businesses/:businessId/marketplace/settlements
export const getSettlements = async (req, res, next) => {
  try {
    const data = await marketplaceService.getMerchantSettlementsSummary(req.params.businessId);
    res.json({ success: true, data });
  } catch (err) {
    sendError(err, res, next);
  }
};
