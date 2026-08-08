import businessApi from "../api/business.api";

export const businessService = {
  async getSummary(workspaceId) {
    const { data } = await businessApi.getSummary(workspaceId);
    return data.data || data;
  },

  async getSales(workspaceId, params) {
    const { data } = await businessApi.getSales(workspaceId, params);
    return data.data?.sales || data.sales || data;
  },

  async createSale(workspaceId, payload) {
    const { data } = await businessApi.createSale(workspaceId, payload);
    return data.data || data;
  },

  async getExpenses(workspaceId, params) {
    const { data } = await businessApi.getExpenses(workspaceId, params);
    return data.data?.expenses || data.expenses || data;
  },

  async createExpense(workspaceId, payload) {
    const { data } = await businessApi.createExpense(workspaceId, payload);
    return data.data || data;
  },

  async getInventory(workspaceId, params) {
    const { data } = await businessApi.getInventory(workspaceId, params);
    return data.data?.inventory || data.inventory || data;
  },

  async addInventoryItem(workspaceId, payload) {
    const { data } = await businessApi.addInventoryItem(workspaceId, payload);
    return data.data || data;
  },

  async getCustomers(workspaceId, params) {
    const { data } = await businessApi.getCustomers(workspaceId, params);
    return data.data?.customers || data.customers || data;
  },

  async createCustomer(workspaceId, payload) {
    const { data } = await businessApi.createCustomer(workspaceId, payload);
    return data.data || data;
  },

  async getSuppliers(workspaceId, params) {
    const { data } = await businessApi.getSuppliers(workspaceId, params);
    return data.data?.suppliers || data.suppliers || data;
  },

  async createSupplier(workspaceId, payload) {
    const { data } = await businessApi.createSupplier(workspaceId, payload);
    return data.data || data;
  },

  async getAccounts(workspaceId) {
    const { data } = await businessApi.getAccounts(workspaceId);
    return data.data?.accounts || data.accounts || data;
  },

  async getReports(workspaceId, type, params) {
    const { data } = await businessApi.getReports(workspaceId, type, params);
    return data.data || data;
  },

  async getSettings(workspaceId) {
    const { data } = await businessApi.getSettings(workspaceId);
    return data.data || data;
  },

  async updateSettings(workspaceId, payload) {
    const { data } = await businessApi.updateSettings(workspaceId, payload);
    return data.data || data;
  },

  async initiateMpesaStkPush(workspaceId, payload) {
    const { data } = await businessApi.initiateMpesaStkPush(workspaceId, payload);
    return data;
  },
};

export default businessService;