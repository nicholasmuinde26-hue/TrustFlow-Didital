import {
  createProduct,
  getProducts,
  getProductById,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  getProductCategories,
  getProductReviews,
  createProductReview,
  searchProducts
} from "./product.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

/**
 * POST /api/v1/businesses/:businessId/products
 * Create a new product
 */
export const createProductController = async (request, response, next) => {
  try {
    const product = await createProduct(
      request.params.businessId,
      request.body,
      request.user._id
    );
    response.status(201).json({ success: true, data: product });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/businesses/:businessId/products
 * Get products with pagination
 */
export const getProductsController = async (request, response, next) => {
  try {
    const filters = {
      business_id: request.params.businessId,
      category: request.query.category,
      subcategory: request.query.subcategory,
      status: request.query.status,
      visibility: request.query.visibility,
      search: request.query.search,
      min_price: request.query.min_price ? Number(request.query.min_price) : undefined,
      max_price: request.query.max_price ? Number(request.query.max_price) : undefined,
      in_stock: request.query.in_stock === "true",
      is_featured: request.query.is_featured === "true",
      sort_by: request.query.sort_by,
      sort_order: request.query.sort_order
    };

    const pagination = {
      page: request.query.page ? Number(request.query.page) : 1,
      limit: request.query.limit ? Number(request.query.limit) : 20
    };

    const result = await getProducts(filters, pagination);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/products/search
 * Search products across all businesses
 */
export const searchProductsController = async (request, response, next) => {
  try {
    const filters = {
      category: request.query.category,
      min_price: request.query.min_price ? Number(request.query.min_price) : undefined,
      max_price: request.query.max_price ? Number(request.query.max_price) : undefined,
      in_stock: request.query.in_stock === "true"
    };

    const pagination = {
      page: request.query.page ? Number(request.query.page) : 1,
      limit: request.query.limit ? Number(request.query.limit) : 20
    };

    const result = await searchProducts(request.query.q, filters, pagination);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/businesses/:businessId/products/:productId
 * Get product by ID
 */
export const getProductController = async (request, response, next) => {
  try {
    const product = await getProductById(request.params.productId);
    response.json({ success: true, data: product });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/products/:slug
 * Get product by slug (public)
 */
export const getProductBySlugController = async (request, response, next) => {
  try {
    const product = await getProductBySlug(request.params.slug);
    response.json({ success: true, data: product });
  } catch (error) { sendError(error, response, next); }
};

/**
 * PATCH /api/v1/businesses/:businessId/products/:productId
 * Update product
 */
export const updateProductController = async (request, response, next) => {
  try {
    const product = await updateProduct(
      request.params.productId,
      request.body,
      request.user._id
    );
    response.json({ success: true, data: product });
  } catch (error) { sendError(error, response, next); }
};

/**
 * DELETE /api/v1/businesses/:businessId/products/:productId
 * Delete product (archive)
 */
export const deleteProductController = async (request, response, next) => {
  try {
    const product = await deleteProduct(request.params.productId);
    response.json({ success: true, data: product });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/products/categories
 * Get product categories
 */
export const getProductCategoriesController = async (request, response, next) => {
  try {
    const categories = getProductCategories();
    response.json({ success: true, data: categories });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/products/:productId/reviews
 * Get product reviews
 */
export const getProductReviewsController = async (request, response, next) => {
  try {
    const pagination = {
      page: request.query.page ? Number(request.query.page) : 1,
      limit: request.query.limit ? Number(request.query.limit) : 10
    };

    const result = await getProductReviews(request.params.productId, pagination);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};

/**
 * POST /api/v1/products/:productId/reviews
 * Create product review
 */
export const createProductReviewController = async (request, response, next) => {
  try {
    const review = await createProductReview(request.params.productId, request.body);
    response.status(201).json({ success: true, data: review });
  } catch (error) { sendError(error, response, next); }
};