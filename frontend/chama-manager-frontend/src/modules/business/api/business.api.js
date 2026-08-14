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