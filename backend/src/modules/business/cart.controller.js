import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  applyDiscountCode,
  removeDiscountCode,
  setShippingAmount,
  mergeGuestCartToUserCart
} from "./cart.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

/**
 * GET /api/v1/cart
 * Get current cart
 */
export const getCartController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await getCart(userId, sessionId);
    response.json({ success: true, data: cart || { items: [], subtotal: 0, total: 0 } });
  } catch (error) { sendError(error, response, next); }
};

/**
 * POST /api/v1/cart/items
 * Add item to cart
 */
export const addToCartController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await addToCart(userId, sessionId, request.body);
    response.status(201).json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * PATCH /api/v1/cart/items/:itemId
 * Update cart item quantity
 */
export const updateCartItemController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await updateCartItem(userId, sessionId, request.params.itemId, request.body.quantity);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * DELETE /api/v1/cart/items/:itemId
 * Remove item from cart
 */
export const removeFromCartController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await removeFromCart(userId, sessionId, request.params.itemId);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * DELETE /api/v1/cart
 * Clear cart
 */
export const clearCartController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await clearCart(userId, sessionId);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * POST /api/v1/cart/discount
 * Apply discount code
 */
export const applyDiscountCodeController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await applyDiscountCode(userId, sessionId, request.body.code);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * DELETE /api/v1/cart/discount
 * Remove discount code
 */
export const removeDiscountCodeController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await removeDiscountCode(userId, sessionId);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * PATCH /api/v1/cart/shipping
 * Set shipping amount
 */
export const setShippingAmountController = async (request, response, next) => {
  try {
    const userId = request.user?._id || null;
    const sessionId = request.headers["x-session-id"] || null;
    
    const cart = await setShippingAmount(userId, sessionId, request.body.amount);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};

/**
 * POST /api/v1/cart/merge
 * Merge guest cart to user cart (after login)
 */
export const mergeCartController = async (request, response, next) => {
  try {
    const userId = request.user._id;
    const sessionId = request.body.session_id || request.headers["x-session-id"];
    
    const cart = await mergeGuestCartToUserCart(userId, sessionId);
    response.json({ success: true, data: cart });
  } catch (error) { sendError(error, response, next); }
};