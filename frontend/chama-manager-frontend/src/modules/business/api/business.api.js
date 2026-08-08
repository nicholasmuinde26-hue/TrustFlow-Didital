import api from "../../../app/services/api";

export const businessApi = {
  // Dashboard Summary
  getSummary: (workspaceId) =>
    api.get(`/business/${workspaceId}/summary`),

  // Sales
  getSales: (workspaceId, params) =>
    api.get(`/business/${workspaceId}/sales`, { params }),

  createSale: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/sales`, payload),

  // Expenses
  getExpenses: (workspaceId, params) =>
    api.get(`/business/${workspaceId}/expenses`, { params }),

  createExpense: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/expenses`, payload),

  // Inventory
  getInventory: (workspaceId, params) =>
    api.get(`/business/${workspaceId}/inventory`, { params }),

  addInventoryItem: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/inventory`, payload),

  updateInventoryItem: (workspaceId, itemId, payload) =>
    api.put(`/business/${workspaceId}/inventory/${itemId}`, payload),

  // Customers
  getCustomers: (workspaceId, params) =>
    api.get(`/business/${workspaceId}/customers`, { params }),

  createCustomer: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/customers`, payload),

  // Suppliers
  getSuppliers: (workspaceId, params) =>
    api.get(`/business/${workspaceId}/suppliers`, { params }),

  createSupplier: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/suppliers`, payload),

  // Accounts
  getAccounts: (workspaceId) =>
    api.get(`/business/${workspaceId}/accounts`),

  createAccount: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/accounts`, payload),

  // Reports
  getReports: (workspaceId, type, params) =>
    api.get(`/business/${workspaceId}/reports/${type}`, { params }),

  // Business Settings
  getSettings: (workspaceId) =>
    api.get(`/business/${workspaceId}/settings`),

  updateSettings: (workspaceId, payload) =>
    api.put(`/business/${workspaceId}/settings`, payload),

  // M-Pesa Payment STK Push
  initiateMpesaStkPush: (workspaceId, payload) =>
    api.post(`/business/${workspaceId}/mpesa/stkpush`, payload),
};

export default businessApi;