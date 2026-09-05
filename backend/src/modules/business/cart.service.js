import ShoppingCart from "../../models/ShoppingCart.js";
import Product from "../../models/Product.js";

/**
 * SHOPPING CART SERVICE
 * Handles cart operations for both authenticated and guest users
 */

/**
 * Get or create cart for user
 */
export async function getOrCreateCart(userId, sessionId = null) {
  let cart;
  
  if (userId) {
    // Try to find existing cart for authenticated user
    cart = await ShoppingCart.findOne({
      user_id: userId,
      status: "active"
    });
    
    // If cart exists, merge any session cart
    if (cart && sessionId) {
      const sessionCart = await ShoppingCart.findOne({
        session_id: sessionId,
        status: "active"
      });
      
      if (sessionCart && sessionCart.items.length > 0) {
        // Merge session cart items into user cart
        await mergeCarts(cart, sessionCart);
        await sessionCart.deleteOne();
      }
    }
  }
  
  // If no cart found and session ID provided, try session cart
  if (!cart && sessionId) {
    cart = await ShoppingCart.findOne({
      session_id: sessionId,
      status: "active",
      $or: [
        { expires_at: null },
        { expires_at: { $gt: new Date() } }
      ]
    });
  }
  
  // Create new cart if none exists
  if (!cart) {
    cart = await ShoppingCart.create({
      user_id: userId || null,
      session_id: sessionId || null,
      status: "active",
      last_activity_at: new Date()
    });
  }
  
  return cart;
}

/**
 * Merge two carts (session cart into user cart)
 */
async function mergeCarts(targetCart, sourceCart) {
  for (const sourceItem of sourceCart.items) {
    const existingItem = targetCart.items.find(
      item => item.product_id.toString() === sourceItem.product_id.toString() &&
             item.variant_sku === sourceItem.variant_sku
    );
    
    if (existingItem) {
      existingItem.quantity += sourceItem.quantity;
    } else {
      targetCart.items.push(sourceItem);
    }
  }
  
  await calculateCartTotals(targetCart);
  await targetCart.save();
}

/**
 * Add item to cart
 */
export async function addToCart(userId, sessionId, itemData) {
  const cart = await getOrCreateCart(userId, sessionId);
  
  // Verify product exists and is available
  const product = await Product.findById(itemData.product_id);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }
  
  if (product.status !== "active" || product.visibility !== "public") {
    const error = new Error("Product is not available");
    error.statusCode = 400;
    throw error;
  }
  
  // Check stock
  const requestedQuantity = itemData.quantity || 1;
  if (product.has_variants) {
    const variant = product.variants.find(v => v.sku === itemData.variant_sku);
    if (!variant) {
      const error = new Error("Product variant not found");
      error.statusCode = 404;
      throw error;
    }
    if (variant.stock < requestedQuantity) {
      const error = new Error("Insufficient stock for this variant");
      error.statusCode = 400;
      throw error;
    }
  } else {
    if (product.stock < requestedQuantity) {
      const error = new Error("Insufficient stock");
      error.statusCode = 400;
      throw error;
    }
  }
  
  // Determine price
  let price = product.base_price;
  let variantAttributes = {};
  
  if (product.has_variants && itemData.variant_sku) {
    const variant = product.variants.find(v => v.sku === itemData.variant_sku);
    if (variant) {
      price = variant.price;
      variantAttributes = variant.attributes;
    }
  }
  
  // Check if item already exists in cart
  const existingItem = cart.items.find(
    item => item.product_id.toString() === itemData.product_id.toString() &&
           item.variant_sku === itemData.variant_sku
  );
  
  if (existingItem) {
    existingItem.quantity += requestedQuantity;
  } else {
    cart.items.push({
      product_id: itemData.product_id,
      variant_sku: itemData.variant_sku || null,
      quantity: requestedQuantity,
      price,
      name: product.title,
      thumbnail: product.thumbnail,
      attributes: variantAttributes
    });
  }
  
  cart.currency = product.currency;
  cart.last_activity_at = new Date();
  
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Update cart item quantity
 */
export async function updateCartItem(userId, sessionId, itemId, quantity) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  const item = cart.items.id(itemId);
  if (!item) {
    const error = new Error("Cart item not found");
    error.statusCode = 404;
    throw error;
  }
  
  if (quantity <= 0) {
    item.remove();
  } else {
    // Verify stock availability
    const product = await Product.findById(item.product_id);
    if (product) {
      if (product.has_variants && item.variant_sku) {
        const variant = product.variants.find(v => v.sku === item.variant_sku);
        if (variant && variant.stock < quantity) {
          const error = new Error("Insufficient stock");
          error.statusCode = 400;
          throw error;
        }
      } else if (product.stock < quantity) {
        const error = new Error("Insufficient stock");
        error.statusCode = 400;
        throw error;
      }
    }
    
    item.quantity = quantity;
  }
  
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Remove item from cart
 */
export async function removeFromCart(userId, sessionId, itemId) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  const item = cart.items.id(itemId);
  if (!item) {
    const error = new Error("Cart item not found");
    error.statusCode = 404;
    throw error;
  }
  
  item.remove();
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Clear cart
 */
export async function clearCart(userId, sessionId) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  cart.items = [];
  cart.discount_code = null;
  cart.discount_percentage = 0;
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Get cart
 */
export async function getCart(userId, sessionId = null) {
  if (userId) {
    return await ShoppingCart.findOne({
      user_id: userId,
      status: "active"
    });
  }
  
  if (sessionId) {
    return await ShoppingCart.findOne({
      session_id: sessionId,
      status: "active",
      $or: [
        { expires_at: null },
        { expires_at: { $gt: new Date() } }
      ]
    });
  }
  
  return null;
}

/**
 * Calculate cart totals
 */
async function calculateCartTotals(cart) {
  cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Apply discount
  if (cart.discount_percentage > 0) {
    cart.discount_amount = cart.subtotal * (cart.discount_percentage / 100);
  } else {
    cart.discount_amount = 0;
  }
  
  // Calculate tax (16% VAT in Kenya)
  const taxableAmount = cart.subtotal - cart.discount_amount;
  cart.tax_amount = taxableAmount * 0.16;
  
  // Calculate total
  cart.total = taxableAmount + cart.tax_amount + cart.shipping_amount;
}

/**
 * Apply discount code
 */
export async function applyDiscountCode(userId, sessionId, code) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  // TODO: Implement discount code validation
  // For now, we'll accept any code with 10% discount as placeholder
  const validCodes = ["SAVE10", "WELCOME10", "FIRST10"];
  
  if (validCodes.includes(code.toUpperCase())) {
    cart.discount_code = code.toUpperCase();
    cart.discount_percentage = 10;
  } else {
    const error = new Error("Invalid discount code");
    error.statusCode = 400;
    throw error;
  }
  
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Remove discount code
 */
export async function removeDiscountCode(userId, sessionId) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  cart.discount_code = null;
  cart.discount_percentage = 0;
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Set shipping amount
 */
export async function setShippingAmount(userId, sessionId, amount) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  cart.shipping_amount = amount;
  cart.last_activity_at = new Date();
  await calculateCartTotals(cart);
  await cart.save();
  
  return cart;
}

/**
 * Convert cart to order (mark as converted)
 */
export async function convertCartToOrder(userId, sessionId) {
  const cart = await getCart(userId, sessionId);
  if (!cart) {
    const error = new Error("Cart not found");
    error.statusCode = 404;
    throw error;
  }
  
  cart.status = "converted";
  await cart.save();
  
  return cart;
}

/**
 * Merge guest cart to user cart after login
 */
export async function mergeGuestCartToUserCart(userId, sessionId) {
  if (!sessionId) return null;
  
  const guestCart = await ShoppingCart.findOne({
    session_id: sessionId,
    status: "active"
  });
  
  if (!guestCart) return null;
  
  const userCart = await getOrCreateCart(userId);
  await mergeCarts(userCart, guestCart);
  await guestCart.deleteOne();
  
  return userCart;
}

/**
 * Clean up expired guest carts (scheduled job)
 */
export async function cleanupExpiredCarts() {
  const result = await ShoppingCart.deleteMany({
    session_id: { $exists: true },
    user_id: { $exists: false },
    status: "active",
    expires_at: { $lt: new Date() }
  });
  
  return { deletedCount: result.deletedCount };
}