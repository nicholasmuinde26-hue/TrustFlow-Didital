import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5001/api/v1";

/**
 * Product API
 */
export const productApi = {
  // Get products with pagination
  getProducts: async (filters = {}, pagination = {}) => {
    const params = new URLSearchParams();
    
    if (filters.business_id) params.append("business_id", filters.business_id);
    if (filters.category) params.append("category", filters.category);
    if (filters.subcategory) params.append("subcategory", filters.subcategory);
    if (filters.search) params.append("search", filters.search);
    if (filters.min_price) params.append("min_price", filters.min_price);
    if (filters.max_price) params.append("max_price", filters.max_price);
    if (filters.in_stock) params.append("in_stock", "true");
    if (filters.is_featured) params.append("is_featured", "true");
    if (filters.sort_by) params.append("sort_by", filters.sort_by);
    if (filters.sort_order) params.append("sort_order", filters.sort_order);
    
    params.append("page", pagination.page || 1);
    params.append("limit", pagination.limit || 20);
    
    const response = await axios.get(`${API_BASE}/businesses/${filters.business_id}/products`, { params });
    return response.data;
  },

  // Search products across all businesses
  searchProducts: async (searchTerm, filters = {}, pagination = {}) => {
    const params = new URLSearchParams();
    params.append("q", searchTerm);
    
    if (filters.category) params.append("category", filters.category);
    if (filters.min_price) params.append("min_price", filters.min_price);
    if (filters.max_price) params.append("max_price", filters.max_price);
    if (filters.in_stock) params.append("in_stock", "true");
    
    params.append("page", pagination.page || 1);
    params.append("limit", pagination.limit || 20);
    
    const response = await axios.get(`${API_BASE}/products/search`, { params });
    return response.data;
  },

  // Get product by slug (public)
  getProductBySlug: async (slug) => {
    const response = await axios.get(`${API_BASE}/products/${slug}`);
    return response.data;
  },

  // Get product by ID (authenticated)
  getProductById: async (businessId, productId) => {
    const response = await axios.get(`${API_BASE}/businesses/${businessId}/products/${productId}`);
    return response.data;
  },

  // Get product categories
  getCategories: async () => {
    const response = await axios.get(`${API_BASE}/products/categories`);
    return response.data;
  },

  // Get product reviews
  getProductReviews: async (productId, pagination = {}) => {
    const params = new URLSearchParams();
    params.append("page", pagination.page || 1);
    params.append("limit", pagination.limit || 10);
    
    const response = await axios.get(`${API_BASE}/products/${productId}/reviews`, { params });
    return response.data;
  },

  // Create product review
  createReview: async (productId, reviewData) => {
    const response = await axios.post(`${API_BASE}/products/${productId}/reviews`, reviewData);
    return response.data;
  }
};

/**
 * Shopping Cart API
 */
export const cartApi = {
  // Get cart
  getCart: async (sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.get(`${API_BASE}/cart`, { headers });
    return response.data;
  },

  // Add item to cart
  addToCart: async (itemData, sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.post(`${API_BASE}/cart/items`, itemData, { headers });
    return response.data;
  },

  // Update cart item quantity
  updateCartItem: async (itemId, quantity, sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.patch(`${API_BASE}/cart/items/${itemId}`, { quantity }, { headers });
    return response.data;
  },

  // Remove item from cart
  removeFromCart: async (itemId, sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.delete(`${API_BASE}/cart/items/${itemId}`, { headers });
    return response.data;
  },

  // Clear cart
  clearCart: async (sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.delete(`${API_BASE}/cart`, { headers });
    return response.data;
  },

  // Apply discount code
  applyDiscount: async (code, sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.post(`${API_BASE}/cart/discount`, { code }, { headers });
    return response.data;
  },

  // Remove discount code
  removeDiscount: async (sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.delete(`${API_BASE}/cart/discount`, { headers });
    return response.data;
  },

  // Set shipping amount
  setShipping: async (amount, sessionId = null) => {
    const headers = sessionId ? { "x-session-id": sessionId } : {};
    const response = await axios.patch(`${API_BASE}/cart/shipping`, { amount }, { headers });
    return response.data;
  },

  // Merge guest cart to user cart
  mergeCart: async (sessionId) => {
    const response = await axios.post(`${API_BASE}/cart/merge`, { session_id: sessionId });
    return response.data;
  }
};