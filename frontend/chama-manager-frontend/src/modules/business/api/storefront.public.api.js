import api from "../../../app/services/api";

// Buyer-facing calls. These hit routes that require no authentication —
// a stale token sitting in localStorage from a previous session is
// harmless here since the backend never checks it on this router.
export const storefrontPublicApi = {
  getStorefront: (slug) => api.get(`/storefront/${slug}`),

  placeOrder: (slug, payload) => api.post(`/storefront/${slug}/orders`, payload),

  submitInquiry: (slug, listingId, payload) =>
    api.post(`/storefront/${slug}/listings/${listingId}/inquiries`, payload),

  trackOrder: (orderCode, phone) =>
    api.get(`/storefront/track/${orderCode}`, { params: phone ? { phone } : {} }),
};

export default storefrontPublicApi;