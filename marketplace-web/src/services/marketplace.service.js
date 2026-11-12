import api from "@/lib/api";

export const marketplaceService = {
  // ==========================================================================
  // PUBLIC MARKETPLACE (admin + merchant calls stay in ChamaManager, where login lives)
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

  async getRetailStores() {
    const { data } = await api.get("/retail/sellers");
    return data.data || [];
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
};

export default marketplaceService;
