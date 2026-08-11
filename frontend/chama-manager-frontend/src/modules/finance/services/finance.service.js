import financeApi from "../api/finance.api";

const safeData = (res) => res?.data?.data ?? res?.data ?? {};

// Coerce to a finite number. Handles Decimal128, strings, null, undefined
const safeNumber = (value) => {
  if (value && typeof value === 'object' && '$numberDecimal' in value) {
    value = value.$numberDecimal; // handle MongoDB Decimal128
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// Format as Ksh 1,234.50
const formatCurrency = (value, currency = 'Ksh') => {
  const n = safeNumber(value);
  return `${currency} ${n.toLocaleString('en-KE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

const financeService = {
  async getSummary(workspaceId) {
    try {
      const res = await financeApi.summary(workspaceId);
      const data = safeData(res);
      
      const summary = {
        ...data,
        cash_balance: safeNumber(data.cash_balance),
        total_contributions: safeNumber(data.total_contributions),
        outstanding_loans: safeNumber(data.outstanding_loans),
        pending_payouts: safeNumber(data.pending_payouts),
        cash_in: safeNumber(data.cash_in),
        cash_out: safeNumber(data.cash_out),
        assets: safeNumber(data.assets),
        liabilities: safeNumber(data.liabilities),
        equity: safeNumber(data.equity),
        accounts: safeNumber(data.accounts),
        transactions: safeNumber(data.transactions),
        ledger_entries: safeNumber(data.ledger_entries),
        pending_transactions: safeNumber(data.pending_transactions),
        total_transactions: safeNumber(data.total_transactions),
        recent_transactions: data.recent_transactions ?? [],
      };

      // Add formatted versions for UI
      return {
        ...summary,
        formatted: {
          cash_balance: formatCurrency(summary.cash_balance),
          total_contributions: formatCurrency(summary.total_contributions),
          outstanding_loans: formatCurrency(summary.outstanding_loans),
          pending_payouts: formatCurrency(summary.pending_payouts),
          cash_in: formatCurrency(summary.cash_in),
          cash_out: formatCurrency(summary.cash_out),
          assets: formatCurrency(summary.assets),
          liabilities: formatCurrency(summary.liabilities),
          equity: formatCurrency(summary.equity),
        }
      };
    } catch (err) {
      console.error("getSummary failed:", err);
      const zeros = {
        cash_balance: 0, total_contributions: 0, outstanding_loans: 0,
        pending_payouts: 0, cash_in: 0, cash_out: 0, assets: 0, liabilities: 0,
        equity: 0, accounts: 0, transactions: 0, ledger_entries: 0,
        pending_transactions: 0, total_transactions: 0, recent_transactions: []
      };
      return {
        ...zeros,
        formatted: Object.fromEntries(
          Object.keys(zeros).map(k => [k, formatCurrency(0)])
        )
      };
    }
  },

  async getAccounts(workspaceId) {
    const res = await financeApi.accounts(workspaceId);
    const accounts = safeData(res).accounts || [];
    // Add formatted balance to each account
    return accounts.map(acc => ({
      ...acc,
      balance: safeNumber(acc.balance),
      formatted_balance: formatCurrency(acc.balance)
    }));
  },

  async getTransactions(workspaceId, params = {}) {
    const res = await financeApi.transactions(workspaceId, params);
    const data = safeData(res);
    const items = (data.items || data.transactions || []).map(tx => ({
      ...tx,
      amount: safeNumber(tx.amount),
      formatted_amount: formatCurrency(tx.amount)
    }));
    return {
      items,
      total: safeNumber(data.total),
      page: safeNumber(data.page || 1),
    };
  },

  async getLedger(workspaceId, params) {
    const res = await financeApi.ledger(workspaceId, params);
    const data = safeData(res);
    // Backend currently returns the ledger as a bare array (not wrapped in
    // { entries: [...] }). Note: a plain array's `.entries` property is the
    // built-in Array.prototype.entries iterator method — always truthy —
    // so `data.entries || []` never falls back and `.map` blows up on a
    // function. Accept either shape defensively.
    const rawEntries = Array.isArray(data)
      ? data
      : Array.isArray(data.entries)
        ? data.entries
        : [];
    const entries = rawEntries.map(e => ({
      ...e,
      debit: safeNumber(e.debit),
      credit: safeNumber(e.credit),
      formatted_debit: formatCurrency(e.debit),
      formatted_credit: formatCurrency(e.credit),
    }));
    return {
      entries,
      total: safeNumber(Array.isArray(data) ? entries.length : data.total),
    };
  },

  async createOperation(workspaceId, payload) {
    const res = await financeApi.createOperation(workspaceId, payload);
    return safeData(res);
  },

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

  // Export helpers in case you need them in components
  safeNumber,
  formatCurrency,
};

export default financeService;