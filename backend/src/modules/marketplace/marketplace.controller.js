import * as marketplaceService from "./marketplace.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

// GET /api/v1/marketplace/categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await marketplaceService.listMarketplaceCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/marketplace/categories/:slug
export const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await marketplaceService.getMarketplaceCategoryBySlug(req.params.slug);
    res.json({ success: true, data: category });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/marketplace/listings
export const searchListings = async (req, res, next) => {
  try {
    const result = await marketplaceService.searchPublicListings({
      categorySlug: req.query.category,
      subcategory: req.query.subcategory,
      search: req.query.search,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      inStock: req.query.inStock === "true",
      location: req.query.location,
      bedrooms: req.query.bedrooms,
      rentPeriod: req.query.rentPeriod,
      cuisine: req.query.cuisine,
      isVegetarian: req.query.isVegetarian === "true",
      sortBy: req.query.sortBy,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/marketplace/listings/:slug (or /:category/listings/:slug)
export const getListingDetail = async (req, res, next) => {
  try {
    const category = req.query.category || req.params.category;
    const result = await marketplaceService.getPublicListingBySlug(category, req.params.slug);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/marketplace/businesses/:businessSlug
export const getBusinessProfile = async (req, res, next) => {
  try {
    const result = await marketplaceService.getPublicBusinessProfile(req.params.businessSlug);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// POST /api/v1/marketplace/cart/checkout
export const processCheckout = async (req, res, next) => {
  try {
    const result = await marketplaceService.processMarketplaceCheckout(req.body, req.user);
    res.status(201).json({ success: true, message: "Order placed successfully", data: result });
  } catch (err) {
    sendError(err, res, next);
  }
};

// GET /api/v1/marketplace/orders/track/:orderNumber
export const trackOrder = async (req, res, next) => {
  try {
    const order = await marketplaceService.trackMarketplaceOrder(req.params.orderNumber, req.query.phone);
    res.json({ success: true, data: order });
  } catch (err) {
    sendError(err, res, next);
  }
};
