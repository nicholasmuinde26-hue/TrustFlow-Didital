import financeApi from "../api/finance.api";

const safeData = (res) => res?.data?.data ?? res?.data ?? {};

const financeService = {
  async getSummary(workspaceId) {
    try {
      const res = await financeApi.summary(workspaceId);
      const data = safeData(res);
      
      // ensure all numbers exist so UI doesn't crash
      return {
        cash_balance: Number(data.cash_balance ?? 0),
        total_contributions: Number(data.total_contributions ?? 0),
        outstanding_loans: Number(data.outstanding_loans ?? 0),
        pending_payouts: Number(data.pending_payouts ?? 0),
        cash_in: Number(data.cash_in ?? 0),
        cash_out: Number(data.cash_out ?? 0),
        assets: Number(data.assets ?? 0),
        liabilities: Number(data.liabilities ?? 0),
        equity: Number(data.equity ?? 0),
        accounts: Number(data.accounts ?? 0),
        transactions: Number(data.transactions ?? 0),
        ledger_entries: Number(data.ledger_entries ?? 0),
        pending_transactions: Number(data.pending_transactions ?? 0),
        total_transactions: Number(data.total_transactions ?? 0),
        recent_transactions: data.recent_transactions ?? [],
        ...data
      };
    } catch (err) {
      console.error("getSummary failed:", err);
      throw err;
    }
  },

  async getAccounts(workspaceId) {
    const res = await financeApi.accounts(workspaceId);
    return safeData(res).accounts || [];
  },

 async getTransactions(workspaceId, params = {}) {
  const res = await financeApi.transactions(workspaceId, params);
  const data = safeData(res);
  return {
    items: data.items || data.transactions || [],
    total: Number(data.total ?? 0),
    page: Number(data.page ?? 1),
  };
},

  async getLedger(workspaceId, params) {
    const res = await financeApi.ledger(workspaceId, params);
    const data = safeData(res);
    return {
      entries: data.entries || [],
      total: Number(data.total ?? 0),
    };
  },

  async createOperation(workspaceId, payload) {
    const res = await financeApi.createOperation(workspaceId, payload);
    return safeData(res);
  },

  // ========================================

  async recordContribution(payload) {
    const res = await financeApi.recordContribution(payload);
    return safeData(res);
  },

  async getContributionPlans(workspaceId, ownerType) {
    const res = await financeApi.contributionPlans(workspaceId, ownerType);
    return safeData(res).plans || [];
  },

  async getContributionObligations(planId, workspaceId, ownerType) {
    const res = await financeApi.contributionObligations(planId, workspaceId, ownerType);
    return safeData(res).obligations || [];
  },

  async initiateMpesaStkPush(payload) {
    const res = await financeApi.initiateMpesaStkPush(payload);
    return safeData(res);
  },
};

export default financeService;