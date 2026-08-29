import businessApi from "../api/business.api";

const extractArray = (res, key) => {
  if (!res) return [];
  const payload = res.data?.data ?? res.data ?? res;
  if (Array.isArray(payload)) return payload;
  if (key && Array.isArray(payload[key])) return payload[key];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.transactions)) return payload.transactions;
  return [];
};

export const businessService = {
  async createBusiness(payload) {
    const res = await businessApi.createBusiness(payload);
    return res.data?.data || res.data;
  },

  async getSummary(workspaceId) {
    const res = await businessApi.getSummary(workspaceId);
    return res.data?.data || res.data;
  },

  async getSales(workspaceId, params) {
    const res = await businessApi.getSales(workspaceId, params);
    return extractArray(res, "sales");
  },

  async createSale(workspaceId, payload) {
    const res = await businessApi.createSale(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getExpenses(workspaceId, params) {
    const res = await businessApi.getExpenses(workspaceId, params);
    return extractArray(res, "expenses");
  },

  async createExpense(workspaceId, payload) {
    const res = await businessApi.createExpense(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getInventory(workspaceId, params) {
    const res = await businessApi.getInventory(workspaceId, params);
    return extractArray(res, "inventory");
  },

  async addInventoryItem(workspaceId, payload) {
    const res = await businessApi.addInventoryItem(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async updateInventoryItem(workspaceId, itemId, payload) {
    const res = await businessApi.updateInventoryItem(workspaceId, itemId, payload);
    return res.data?.data || res.data;
  },

  async deleteInventoryItem(workspaceId, itemId) {
    const res = await businessApi.deleteInventoryItem(workspaceId, itemId);
    return res.data?.data || res.data;
  },

  async restockInventoryItem(workspaceId, itemId, payload) {
    const res = await businessApi.restockInventoryItem(workspaceId, itemId, payload);
    return res.data?.data || res.data;
  },

  async getRentalListings(workspaceId) {
    const res = await businessApi.getRentalListings(workspaceId);
    return extractArray(res, "listings");
  },

  async addRentalListing(workspaceId, payload) {
    const res = await businessApi.addRentalListing(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async updateRentalListing(workspaceId, listingId, payload) {
    const res = await businessApi.updateRentalListing(workspaceId, listingId, payload);
    return res.data?.data || res.data;
  },

  async setRentalListingStatus(workspaceId, listingId, status) {
    const res = await businessApi.setRentalListingStatus(workspaceId, listingId, status);
    return res.data?.data || res.data;
  },

  async deleteRentalListing(workspaceId, listingId) {
    const res = await businessApi.deleteRentalListing(workspaceId, listingId);
    return res.data?.data || res.data;
  },

  async getRentalInquiries(workspaceId) {
    const res = await businessApi.getRentalInquiries(workspaceId);
    return extractArray(res, "inquiries");
  },

  async setRentalInquiryStatus(workspaceId, inquiryId, status) {
    const res = await businessApi.setRentalInquiryStatus(workspaceId, inquiryId, status);
    return res.data?.data || res.data;
  },

  async createPosSale(workspaceId, payload) {
    const res = await businessApi.createPosSale(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getStorefront(workspaceId) {
    const res = await businessApi.getStorefront(workspaceId);
    return res.data?.data || res.data;
  },

  async updateStorefront(workspaceId, payload) {
    const res = await businessApi.updateStorefront(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getStorefrontOrders(workspaceId) {
    const res = await businessApi.getStorefrontOrders(workspaceId);
    return extractArray(res, "orders");
  },

  async updateStorefrontOrderStatus(workspaceId, orderId, status) {
    const res = await businessApi.updateStorefrontOrderStatus(workspaceId, orderId, status);
    return res.data?.data || res.data;
  },

  async getCustomers(workspaceId, params) {
    const res = await businessApi.getCustomers(workspaceId, params);
    return extractArray(res, "customers");
  },

  async createCustomer(workspaceId, payload) {
    const res = await businessApi.createCustomer(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getSuppliers(workspaceId, params) {
    const res = await businessApi.getSuppliers(workspaceId, params);
    return extractArray(res, "suppliers");
  },

  async createSupplier(workspaceId, payload) {
    const res = await businessApi.createSupplier(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async getAccounts(workspaceId) {
    const res = await businessApi.getAccounts(workspaceId);
    return extractArray(res, "accounts");
  },

  async getReports(workspaceId, type, params) {
    const res = await businessApi.getReports(workspaceId, type, params);
    return res.data?.data || res.data;
  },

  async getSettings(workspaceId) {
    const res = await businessApi.getSettings(workspaceId);
    return res.data?.data || res.data;
  },

  async updateSettings(workspaceId, payload) {
    const res = await businessApi.updateSettings(workspaceId, payload);
    return res.data?.data || res.data;
  },

  async initiateMpesaStkPush(workspaceId, payload) {
    const res = await businessApi.initiateMpesaStkPush(workspaceId, payload);
    return res.data;
  },

  async queryMpesaStkPushStatus(workspaceId, transactionId) {
    const res = await businessApi.queryMpesaStkPushStatus(workspaceId, transactionId);
    return res.data?.data || res.data;
  },
};

export default businessService;