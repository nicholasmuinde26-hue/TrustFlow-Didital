import * as marketplaceService from "./marketplace.service.js";
import { getMyAdminProfile } from "../admin/admin.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

// Helper to resolve admin profile and scopes
const resolveAdminContext = async (req) => {
  const profile = await getMyAdminProfile(req.user);
  if (!profile) {
    const err = new Error("Platform administrator permissions required");
    err.statusCode = 403;
    throw err;
  }
  return {
    ...req.user.toObject ? req.user.toObject() : req.user,
    systemRole: req.user.systemRole,
    adminRole: profile.adminRole,
    permissions: profile.permissions,
    marketplaceScopes: profile.marketplaceScopes || [],
  };
};

// GET /api/v1/admin/marketplace/queue
export const getModerationQueue = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const result = await marketplaceService.getAdminModerationQueue(admin, {
      categorySlug: req.query.category,
      status: req.query.status || "pending",
      page: req.query.page || 1,
      limit: req.query.limit || 20,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// POST /api/v1/admin/marketplace/listings/:id/review
export const reviewListing = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const listing = await marketplaceService.reviewMarketplaceListing(
      req.params.id,
      {
        decision: req.body.decision,
        notes: req.body.notes,
        isFeatured: req.body.isFeatured,
        featuredRank: req.body.featuredRank,
      },
      admin
    );
    res.json({ success: true, message: `Listing marked as ${listing.moderation_status}`, data: listing });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/admin/marketplace/enrollments
export const getEnrollments = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const enrollments = await marketplaceService.listAdminEnrollments(admin, {
      status: req.query.status,
    });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    sendError(err, res, next);
  }
};

// POST /api/v1/admin/marketplace/enrollments/:id/review
export const reviewEnrollment = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const enrollment = await marketplaceService.reviewBusinessEnrollment(
      req.params.id,
      {
        decision: req.body.decision,
        reviewNotes: req.body.reviewNotes,
        customCommissionRate: req.body.customCommissionRate,
      },
      admin
    );
    res.json({ success: true, message: `Enrollment marked as ${enrollment.status}`, data: enrollment });
  } catch (err) {
    sendError(err, res, next);
  }
};

// PUT /api/v1/admin/marketplace/categories/:slug/design
export const updateCategoryDesign = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const category = await marketplaceService.updateMarketplaceCategoryDesign(
      req.params.slug,
      req.body,
      admin
    );
    res.json({ success: true, message: "Category hub design updated", data: category });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/admin/marketplace/analytics
export const getAnalytics = async (req, res, next) => {
  try {
    const admin = await resolveAdminContext(req);
    const data = await marketplaceService.getMarketplaceAdminAnalytics(admin);
    res.json({ success: true, data });
  } catch (err) {
    sendError(err, res, next);
  }
};
