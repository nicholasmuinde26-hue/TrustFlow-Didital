import api from "@/app/services/api";

export const marketplaceService = {
  // ==========================================================================
  // PUBLIC MARKETPLACE
  // ==========================================================================
  async getCategories() {
    const { data } = await api.get("/marketplace/categories");
    return data.data || [];
  },

  async getCategory(slug) {
    const { data } = await api.get(`/marketplace/categories/${slug}`);
    return data.data || null;
  },

  async searchListings(params = {}) {
    const { data } = await api.get("/marketplace/listings", { params });
    return data || { listings: [], pagination: {} };
  },

  async getListing(slug, category = null) {
    const url = category
      ? `/marketplace/${category}/listings/${slug}`
      : `/marketplace/listings/${slug}`;
    const { data } = await api.get(url);
    return data.data || null;
  },

  async getBusinessProfile(businessSlug) {
    const { data } = await api.get(`/marketplace/businesses/${businessSlug}`);
    return data.data || null;
  },

  async checkout(orderPayload) {
    const { data } = await api.post("/marketplace/cart/checkout", orderPayload);
    return data.data || null;
  },

  async trackOrder(orderNumber, phone = null) {
    const { data } = await api.get(`/marketplace/orders/track/${orderNumber}`, {
      params: phone ? { phone } : {},
    });
    return data.data || null;
  },

  // ==========================================================================
  // MARKETPLACE BUSINESS ADMIN CONSOLE
  // ==========================================================================
  async getModerationQueue(params = {}) {
    const { data } = await api.get("/admin/marketplace/queue", { params });
    return data || { listings: [], pagination: {} };
  },

  async reviewListing(listingId, payload) {
    const { data } = await api.post(`/admin/marketplace/listings/${listingId}/review`, payload);
    return data.data || null;
  },

  async getEnrollments(params = {}) {
    const { data } = await api.get("/admin/marketplace/enrollments", { params });
    return data.data || [];
  },

  async reviewEnrollment(enrollmentId, payload) {
    const { data } = await api.post(`/admin/marketplace/enrollments/${enrollmentId}/review`, payload);
    return data.data || null;
  },

  async updateCategoryDesign(slug, payload) {
    const { data } = await api.put(`/admin/marketplace/categories/${slug}/design`, payload);
    return data.data || null;
  },

  async getAnalytics() {
    const { data } = await api.get("/admin/marketplace/analytics");
    return data.data || {};
  },

  // ==========================================================================
  // MERCHANT PORTAL (IN BUSINESS DASHBOARD)
  // ==========================================================================
  async getMerchantStatus(businessId) {
    const { data } = await api.get(`/businesses/${businessId}/marketplace/status`);
    return data.data || [];
  },

  async enrollInHub(businessId, payload) {
    const { data } = await api.post(`/businesses/${businessId}/marketplace/enroll`, payload);
    return data.data || null;
  },

  async getMerchantListings(businessId, params = {}) {
    const { data } = await api.get(`/businesses/${businessId}/marketplace/listings`, { params });
    return data.data || [];
  },

  async submitListing(businessId, payload) {
    const { data } = await api.post(`/businesses/${businessId}/marketplace/listings`, payload);
    return data.data || null;
  },

  async updateMerchantListing(businessId, listingId, payload) {
    const { data } = await api.put(`/businesses/${businessId}/marketplace/listings/${listingId}`, payload);
    return data.data || null;
  },

  async deleteMerchantListing(businessId, listingId) {
    const { data } = await api.delete(`/businesses/${businessId}/marketplace/listings/${listingId}`);
    return data;
  },

  async toggleListingVisibility(businessId, listingId, visibility = null) {
    const { data } = await api.patch(`/businesses/${businessId}/marketplace/listings/${listingId}/visibility`, {
      visibility,
    });
    return data.data || null;
  },

  async toggleListingOccupancy(businessId, listingId, isOccupied = null) {
    const { data } = await api.patch(`/businesses/${businessId}/marketplace/listings/${listingId}/occupancy`, {
      is_occupied: isOccupied,
    });
    return data.data || null;
  },

  async getMerchantOrders(businessId, params = {}) {
    const { data } = await api.get(`/businesses/${businessId}/marketplace/orders`, { params });
    return data || { orders: [], pagination: {} };
  },

  async updateFulfillment(businessId, orderId, fulfillmentStatus) {
    const { data } = await api.patch(
      `/businesses/${businessId}/marketplace/orders/${orderId}/fulfillment`,
      { fulfillment_status: fulfillmentStatus }
    );
    return data.data || null;
  },

  async getSettlements(businessId) {
    const { data } = await api.get(`/businesses/${businessId}/marketplace/settlements`);
    return data.data || { summary: {}, settlements: [] };
  },
};

export default marketplaceService;
