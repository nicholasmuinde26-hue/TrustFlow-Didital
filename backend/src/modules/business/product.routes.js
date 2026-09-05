import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember } from "../../middleware/chama.middleware.js";
import {
  createProductController,
  getProductsController,
  searchProductsController,
  getProductController,
  getProductBySlugController,
  updateProductController,
  deleteProductController,
  getProductCategoriesController,
  getProductReviewsController,
  createProductReviewController
} from "./product.controller.js";

const router = express.Router();

// ========================================
// PRODUCT MANAGEMENT (Authenticated)
// ========================================

router.post(
  "/:businessId/products",
  protect,
  requireChamaMember,
  createProductController
);

router.get(
  "/:businessId/products",
  protect,
  requireChamaMember,
  getProductsController
);

router.get(
  "/:businessId/products/:productId",
  protect,
  requireChamaMember,
  getProductController
);

router.patch(
  "/:businessId/products/:productId",
  protect,
  requireChamaMember,
  updateProductController
);

router.delete(
  "/:businessId/products/:productId",
  protect,
  requireChamaMember,
  deleteProductController
);

// ========================================
// PUBLIC PRODUCT CATALOG
// ========================================

// Search products across all businesses (public)
router.get(
  "/products/search",
  searchProductsController
);

// Get product by slug (public storefront)
router.get(
  "/products/:slug",
  getProductBySlugController
);

// Get product categories (public)
router.get(
  "/products/categories",
  getProductCategoriesController
);

// Get product reviews (public)
router.get(
  "/products/:productId/reviews",
  getProductReviewsController
);

// Create product review (public)
router.post(
  "/products/:productId/reviews",
  createProductReviewController
);

export default router;