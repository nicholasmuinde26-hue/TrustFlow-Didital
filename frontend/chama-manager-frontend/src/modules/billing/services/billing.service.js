import api from "@/app/services/api";

// Chama-side billing: what the group pays the platform for the software.
// Everything is scoped to one chama; the API decides who may do what.
const billingService = {
  async getSummary(chamaId) {
    const { data } = await api.get(`/chamas/${chamaId}/billing`);
    return data.data;
  },

  async getPlans(chamaId) {
    const { data } = await api.get(`/chamas/${chamaId}/billing/plans`);
    return data.data || [];
  },

  async listInvoices(chamaId) {
    const { data } = await api.get(`/chamas/${chamaId}/billing/invoices`);
    return data.data || [];
  },

  async createInvoice(chamaId, { planCode, months }) {
    const { data } = await api.post(`/chamas/${chamaId}/billing/invoices`, {
      plan_code: planCode,
      months,
    });
    return data.data;
  },

  // Sends the M-Pesa prompt to the treasurer's phone.
  async payInvoice(chamaId, invoiceId, phoneNumber) {
    const { data } = await api.post(`/chamas/${chamaId}/billing/invoices/${invoiceId}/pay`, {
      phone_number: phoneNumber,
    });
    return data;
  },

  // Polling this also makes the server ask Safaricom if the callback is late.
  async getInvoice(chamaId, invoiceId) {
    const { data } = await api.get(`/chamas/${chamaId}/billing/invoices/${invoiceId}`);
    return { invoice: data.data, summary: data.summary };
  },

  async switchToFree(chamaId) {
    const { data } = await api.post(`/chamas/${chamaId}/billing/switch-to-free`);
    return data.data;
  },
};

// Platform owner only (Super Admin).
export const billingAdminService = {
  async getMetrics(months = 6) {
    const { data } = await api.get("/admin/billing/metrics", { params: { months } });
    return data.data;
  },
  async listSubscriptions(params = {}) {
    const { data } = await api.get("/admin/billing/subscriptions", { params });
    return data.data;
  },
  // Give one group its own monthly price for a plan; price null clears it.
  async setGroupPrice(chamaId, planCode, price) {
    const { data } = await api.patch(`/admin/billing/subscriptions/${chamaId}/price`, {
      plan_code: planCode,
      price_monthly: price,
    });
    return data.data;
  },
  async listInvoices(params = {}) {
    const { data } = await api.get("/admin/billing/invoices", { params });
    return data.data;
  },
  async listPlans() {
    const { data } = await api.get("/admin/billing/plans");
    return data.data || [];
  },
  async updatePlan(code, patch) {
    const { data } = await api.patch(`/admin/billing/plans/${code}`, patch);
    return data.data;
  },
};

export default billingService;