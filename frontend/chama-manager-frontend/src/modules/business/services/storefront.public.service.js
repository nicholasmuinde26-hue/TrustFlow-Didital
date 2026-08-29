import storefrontPublicApi from "../api/storefront.public.api";

export const storefrontPublicService = {
  async getStorefront(slug) {
    const res = await storefrontPublicApi.getStorefront(slug);
    return res.data?.data || res.data;
  },

  async placeOrder(slug, payload) {
    const res = await storefrontPublicApi.placeOrder(slug, payload);
    return res.data?.data || res.data;
  },

  async submitInquiry(slug, listingId, payload) {
    const res = await storefrontPublicApi.submitInquiry(slug, listingId, payload);
    return res.data?.data || res.data;
  },

  async trackOrder(orderCode, phone) {
    const res = await storefrontPublicApi.trackOrder(orderCode, phone);
    return res.data?.data || res.data;
  },
};

export default storefrontPublicService;