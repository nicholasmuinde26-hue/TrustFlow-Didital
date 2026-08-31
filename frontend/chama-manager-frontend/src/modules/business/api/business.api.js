import api from "../../../app/services/api";

export const businessApi = {
  // Create
  createBusiness: (payload) =>
    api.post(`/businesses`, payload),

  // Dashboard Summary
  getSummary: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/summary`),

  // Sales
  getSales: (workspaceId, params) =>
    api.get(`/businesses/${workspaceId}/sales`, { params }),

  createSale: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/sales`, payload),

  // Force-complete a pending payment (manual STK follow-up / admin override)
  completeTransaction: (workspaceId, transactionId) =>
    api.post(`/businesses/${workspaceId}/transactions/${transactionId}/complete`),

  // Kitchen prep status — independent of payment status, see backend model comment
  setKitchenStatus: (workspaceId, transactionId, kitchenStatus) =>
    api.patch(`/businesses/${workspaceId}/transactions/${transactionId}/kitchen-status`, { kitchen_status: kitchenStatus }),

  // Expenses
  getExpenses: (workspaceId, params) =>
    api.get(`/businesses/${workspaceId}/expenses`, { params }),

  createExpense: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/expenses`, payload),

  // Inventory
  getInventory: (workspaceId, params) =>
    api.get(`/businesses/${workspaceId}/inventory`, { params }),

  addInventoryItem: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/inventory`, payload),

  updateInventoryItem: (workspaceId, itemId, payload) =>
    api.put(`/businesses/${workspaceId}/inventory/${itemId}`, payload),

  deleteInventoryItem: (workspaceId, itemId) =>
    api.delete(`/businesses/${workspaceId}/inventory/${itemId}`),

  restockInventoryItem: (workspaceId, itemId, payload) =>
    api.post(`/businesses/${workspaceId}/inventory/${itemId}/restock`, payload),

  // Rental Listings (rooms & plots)
  getRentalListings: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/rental-listings`),

  addRentalListing: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/rental-listings`, payload),

  updateRentalListing: (workspaceId, listingId, payload) =>
    api.put(`/businesses/${workspaceId}/rental-listings/${listingId}`, payload),

  setRentalListingStatus: (workspaceId, listingId, status) =>
    api.patch(`/businesses/${workspaceId}/rental-listings/${listingId}/status`, { status }),

  deleteRentalListing: (workspaceId, listingId) =>
    api.delete(`/businesses/${workspaceId}/rental-listings/${listingId}`),

  // Rental Inquiries (leads from the public storefront)
  getRentalInquiries: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/rental-inquiries`),

  setRentalInquiryStatus: (workspaceId, inquiryId, status) =>
    api.patch(`/businesses/${workspaceId}/rental-inquiries/${inquiryId}/status`, { status }),

  // Point of Sale
  createPosSale: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/pos/sale`, payload),

  // Storefront (admin/owner side)
  getStorefront: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/storefront`),

  updateStorefront: (workspaceId, payload) =>
    api.put(`/businesses/${workspaceId}/storefront`, payload),

  getStorefrontOrders: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/storefront-orders`),

  updateStorefrontOrderStatus: (workspaceId, orderId, status) =>
    api.patch(`/businesses/${workspaceId}/storefront-orders/${orderId}/status`, { status }),

  // Customers
  getCustomers: (workspaceId, params) =>
    api.get(`/businesses/${workspaceId}/customers`, { params }),

  createCustomer: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/customers`, payload),

  // Suppliers
  getSuppliers: (workspaceId, params) =>
    api.get(`/businesses/${workspaceId}/suppliers`, { params }),

  createSupplier: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/suppliers`, payload),

  // Accounts
  getAccounts: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/accounts`),

  createAccount: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/accounts`, payload),

  // Reports
  getReports: (workspaceId, type, params) =>
    api.get(`/businesses/${workspaceId}/reports/${type}`, { params }),

  // Business Settings
  getSettings: (workspaceId) =>
    api.get(`/businesses/${workspaceId}/settings`),

  updateSettings: (workspaceId, payload) =>
    api.put(`/businesses/${workspaceId}/settings`, payload),

  // Customer payout (M-Pesa B2C) - matches business.routes.js's
  // POST /:businessId/customer-payouts
  customerPayout: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/customer-payouts`, payload),

  // M-Pesa Payment STK Push
  initiateMpesaStkPush: (workspaceId, payload) =>
    api.post(`/businesses/${workspaceId}/mpesa/stkpush`, payload),

  queryMpesaStkPushStatus: (workspaceId, transactionId) =>
    api.get(`/businesses/${workspaceId}/mpesa/stkpush/query/${transactionId}`),
};

export default businessApi;