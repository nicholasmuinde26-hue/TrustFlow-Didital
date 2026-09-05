import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  getCartController,
  addToCartController,
  updateCartItemController,
  removeFromCartController,
  clearCartController,
  applyDiscountCodeController,
  removeDiscountCodeController,
  setShippingAmountController,
  mergeCartController
} from "./cart.controller.js";

const router = express.Router();

// ========================================
// SHOPPING CART ENDPOINTS
// ========================================
// These endpoints work for both authenticated and guest users
// Guest users should provide x-session-id header

// Get current cart
router.get(
  "/cart",
  getCartController
);

// Add item to cart
router.post(
  "/cart/items",
  addToCartController
);

// Update cart item quantity
router.patch(
  "/cart/items/:itemId",
  updateCartItemController
);

// Remove item from cart
router.delete(
  "/cart/items/:itemId",
  removeFromCartController
);

// Clear cart
router.delete(
  "/cart",
  clearCartController
);

// Apply discount code
router.post(
  "/cart/discount",
  applyDiscountCodeController
);

// Remove discount code
router.delete(
  "/cart/discount",
  removeDiscountCodeController
);

// Set shipping amount
router.patch(
  "/cart/shipping",
  setShippingAmountController
);

// Merge guest cart to user cart (requires authentication)
router.post(
  "/cart/merge",
  protect,
  mergeCartController
);

export default router;