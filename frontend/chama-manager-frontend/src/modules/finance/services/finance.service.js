import financeApi from "../api/finance.api";

const safeData = (res) => res?.data?.data ?? res?.data ?? {};

// Human-readable label for each FinancialTransaction.transaction_type value,
// used to tag every ledger row with the product it actually belongs to
// (savings / MGR / contribution / chama-internal contribution / loan / ...)
// so payments never look like anonymous debits and credits.
export const CATEGORY_LABELS = {
  deposit: "Savings",
  withdrawal: "Savings Withdrawal",
  savings_shareout_obligation: "Savings Share-out",
  savings_shareout_settlement: "Savings Share-out",
  savings_shareout_cancellation: "Savings Share-out (Cancelled)",
  contribution: "Contribution",
  contribution_payment: "Contribution",
  contribution_reversal: "Contribution (Reversed)",
  mgr_contribution: "MGR Contribution",
  chama_contribution_payment: "Chama Contribution",
  payout: "Payout",
  payout_obligation: "Payout",
  payout_settlement: "Payout",
  payout_cancellation: "Payout (Cancelled)",
  loan_disbursement: "Loan Disbursement",
  loan_repayment: "Loan Repayment",
  transfer: "Transfer",
  fee: "Fee",
  penalty: "Penalty",
  adjustment: "Adjustment",
  sale: "Sale",
  expense: "Expense",
  customer_payout: "Customer Payout",
};

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
  depositMemberWallet(workspaceId, payload) { return financeApi.depositMemberWallet(workspaceId, payload); },
  withdrawMemberWallet(workspaceId, payload) { return financeApi.withdrawMemberWallet(workspaceId, payload); },
  setMemberWalletPin(workspaceId, pin) { return financeApi.setMemberWalletPin(workspaceId, pin); },
  changeMemberWalletPin(workspaceId, payload) { return financeApi.changeMemberWalletPin(workspaceId, payload); },
  async getSummary(workspaceId) {
    try {
      const res = await financeApi.summary(workspaceId);
      const data = safeData(res);
      
      const summary = {
        ...data,
        cash_balance: safeNumber(data.cash_balance),
        total_contributions: safeNumber(data.total_contributions),
        business_balance: safeNumber(data.business_balance),
        business_owed_to_members: safeNumber(data.business_owed_to_members),
        business_separation_pending: safeNumber(data.business_separation_pending),
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

  // A member's own figures - always their own, regardless of role. Backed
  // by GET /finance/summary/me (see finance.controller.js#getMyFinanceSummary).
  async getMySummary(workspaceId) {
    try {
      const res = await financeApi.summaryMe(workspaceId);
      const data = safeData(res);
      return {
        my_total_contributions: safeNumber(data.my_total_contributions),
        my_payment_count: safeNumber(data.my_payment_count),
        my_recent_activity: Array.isArray(data.my_recent_activity)
          ? data.my_recent_activity.map((p) => ({ ...p, amount: safeNumber(p.amount) }))
          : [],
      };
    } catch (err) {
      console.error("getMySummary failed:", err);
      return { my_total_contributions: 0, my_payment_count: 0, my_recent_activity: [] };
    }
  },

  // My Wallet — one rollup of the caller's own position. Backed by
  // GET /finance/wallet (see finance.controller.js#getMyWalletController).
  // `scope` is 'full' for a Chama workspace (savings/loan/payout/
  // withdrawals all populated) or 'contributions_only' for a Contribution
  // Group / Business workspace, where those concepts don't exist.
  async getMyWallet(workspaceId) {
    try {
      const res = await financeApi.wallet(workspaceId);
      const data = safeData(res);

      const contributions = {
        total: safeNumber(data.contributions?.my_total_contributions),
        payment_count: safeNumber(data.contributions?.my_payment_count),
        recent_activity: Array.isArray(data.contributions?.my_recent_activity)
          ? data.contributions.my_recent_activity.map((p) => ({
              ...p,
              amount: safeNumber(p.amount),
            }))
          : [],
      };
      const memberWallet = {
        ...(data.member_wallet || {}),
        balance: safeNumber(data.member_wallet?.balance),
        available_balance: safeNumber(data.member_wallet?.available_balance),
        reserved_balance: safeNumber(data.member_wallet?.reserved_balance),
        pin_set: Boolean(data.member_wallet?.pin_set),
        pin_locked_until: data.member_wallet?.pin_locked_until || null,
        entries: Array.isArray(data.member_wallet?.entries) ? data.member_wallet.entries.map((entry) => ({ ...entry, amount: safeNumber(entry.amount) })) : [],
      };

      if (data.scope !== "full") {
        return {
          scope: data.scope || "contributions_only",
          contributions,
          savings: null,
          loan: null,
          pending_payout: null,
          withdrawals: null,
          member_wallet: memberWallet,
        };
      }

      const savingsPlans = Array.isArray(data.savings?.plans)
        ? data.savings.plans.map((p) => ({
            ...p,
            balance: safeNumber(p.balance),
            pending_withdrawal: safeNumber(p.pending_withdrawal),
            available_to_withdraw: safeNumber(p.available_to_withdraw),
          }))
        : [];

      return {
        scope: "full",
        contributions,
        savings: {
          total_balance: safeNumber(data.savings?.total_balance),
          total_available_to_withdraw: safeNumber(
            data.savings?.total_available_to_withdraw
          ),
          plans: savingsPlans,
        },
        loan: {
          outstanding_total: safeNumber(data.loan?.outstanding_total),
          active_loan: data.loan?.active_loan
            ? {
                ...data.loan.active_loan,
                amount: safeNumber(data.loan.active_loan.amount),
                outstanding: safeNumber(data.loan.active_loan.outstanding),
              }
            : null,
        },
        pending_payout: data.pending_payout
          ? { ...data.pending_payout, amount: safeNumber(data.pending_payout.amount) }
          : null,
        withdrawals: {
          total_pending: safeNumber(data.withdrawals?.total_pending),
          items: Array.isArray(data.withdrawals?.items)
            ? data.withdrawals.items.map((w) => ({ ...w, amount: safeNumber(w.amount) }))
            : [],
        },
        member_wallet: memberWallet,
      };
    } catch (err) {
      console.error("getMyWallet failed:", err);
      return {
        scope: "contributions_only",
        contributions: { total: 0, payment_count: 0, recent_activity: [] },
        savings: null,
        loan: null,
        pending_payout: null,
        withdrawals: null,
        member_wallet: { balance: 0, available_balance: 0, reserved_balance: 0, entries: [] },
      };
    }
  },

  // Real week-by-week income vs expense totals for the Overview chart.
  // Officials-only (mirrors finance/summary scope) - a plain member gets
  // back an empty weeks array, same shape, nothing to special-case.
  async getTrend(workspaceId) {
    try {
      const res = await financeApi.summaryTrend(workspaceId);
      const data = safeData(res);
      const weeks = Array.isArray(data.weeks) ? data.weeks : [];
      return {
        scope: data.scope || "own",
        weeks: weeks.map((w) => ({
          ...w,
          income: safeNumber(w.income),
          expense: safeNumber(w.expense),
        })),
      };
    } catch (err) {
      console.error("getTrend failed:", err);
      return { scope: "own", weeks: [] };
    }
  },

  // `params.scope`: omit for the chama's pooled accounts (default), or pass
  // 'business' / 'all' to include the business & income fund.
  async getAccounts(workspaceId, params = {}) {
    const res = await financeApi.accounts(workspaceId, params);
    const data = safeData(res);
    // Same bare-array trap as getTransactions/getLedger: backend returns
    // the accounts list directly, not wrapped in { accounts: [...] }.
    const accounts = Array.isArray(data)
      ? data
      : Array.isArray(data.accounts)
        ? data.accounts
        : [];
    // Add formatted balance to each account
    return accounts.map(acc => ({
      ...acc,
      balance: safeNumber(acc.balance ?? acc.current_balance),
      formatted_balance: formatCurrency(acc.balance ?? acc.current_balance)
    }));
  },

  async getTransactions(workspaceId, params = {}) {
    const res = await financeApi.transactions(workspaceId, params);
    const data = safeData(res);
    // Backend currently returns transactions as a bare array (not wrapped
    // in { items: [...] }). Same trap as getLedger: a plain array's
    // `.items`/`.transactions` are just undefined, so this used to always
    // fall through to []. Accept either shape defensively.
    const rawItems = Array.isArray(data)
      ? data
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.transactions)
          ? data.transactions
          : [];
    const items = rawItems.map(tx => ({
      ...tx,
      amount: safeNumber(tx.amount),
      formatted_amount: formatCurrency(tx.amount)
    }));
    const meta = res?.data?.meta || {};
    return {
      items,
      total: safeNumber(Array.isArray(data) ? items.length : data.total),
      page: safeNumber(Array.isArray(data) ? 1 : data.page || 1),
      // Which book the server returned ("mine" | "chama") and whether the caller may switch.
      view: meta.view || null,
      defaultView: meta.default_view || null,
      canToggle: Boolean(meta.can_toggle),
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
    const entries = rawEntries.map(e => {
      // Backend LedgerEntry rows are single-sided: one `entry_type`
      // ('debit'|'credit') + one `amount`, not separate debit/credit
      // fields. Split that into the flat shape LedgerTable/LedgerPage
      // expect. `account_id` also arrives populated as the full
      // FinancialAccount object (via .populate("account_id")), not a
      // pre-flattened `account_name` string.
      const entryType = String(e.entry_type || e.type || "").toLowerCase();
      const amount = safeNumber(e.amount);
      const debit = entryType === "debit" ? amount : 0;
      const credit = entryType === "credit" ? amount : 0;

      const account =
        e.account_id && typeof e.account_id === "object"
          ? e.account_id
          : null;

      const accountName =
        account?.name ||
        account?.account_code ||
        e.account_name ||
        e.account ||
        "Unknown Account";

      // `transaction_id` arrives populated with the parent
      // FinancialTransaction (see finance.service.js#getLedger on the
      // backend), which carries transaction_type - the one field that
      // says WHAT this money movement actually was (a savings deposit,
      // an MGR contribution, a chama-internal contribution, a loan
      // repayment...). This is what lets the UI show every entry
      // tagged with its correct category instead of a bare debit/credit.
      const transaction =
        e.transaction_id && typeof e.transaction_id === "object"
          ? e.transaction_id
          : null;

      const category = String(transaction?.transaction_type || "").toLowerCase();

      // `transaction_id` now arrives as a populated object (see above), so
      // anything that used to read it as a plain id string (e.g. the
      // Reference column's fallback) would otherwise print "[object
      // Object]". Surface the transaction's own reference explicitly and
      // keep transaction_id as a clean id string for backward compatibility.
      const transactionRef = transaction?.reference || e.reference || null;
      const transactionId = transaction?._id || (transaction ? null : e.transaction_id) || null;

      return {
        ...e,
        account_name: accountName,
        debit,
        credit,
        formatted_debit: formatCurrency(debit),
        formatted_credit: formatCurrency(credit),
        category,
        category_label: CATEGORY_LABELS[category] || (category ? category.replace(/_/g, " ") : "Other"),
        reference: transactionRef,
        transaction_id: transactionId,
      };
    });
    return {
      entries,
      total: safeNumber(Array.isArray(data) ? entries.length : data.total),
    };
  },

  async createOperation(workspaceId, payload) {
    const res = await financeApi.createOperation(workspaceId, payload);
    return safeData(res);
  },

  // ========================================
  // CASH DEPOSIT ENFORCEMENT
  // ========================================

  async getCashDepositStatus(workspaceId) {
    try {
      const res = await financeApi.cashDepositStatus(workspaceId);
      const data = safeData(res);
      return {
        cash_balance: safeNumber(data.cash_balance),
        held_since: data.held_since || null,
        due_at: data.due_at || null,
        is_overdue: Boolean(data.is_overdue),
        inflow_locked: Boolean(data.inflow_locked),
        hours_remaining: data.hours_remaining ?? null,
        hours_overdue: data.hours_overdue ?? null,
        deposit_window_hours: safeNumber(data.deposit_window_hours) || 48,
        formatted_cash_balance: formatCurrency(data.cash_balance),
      };
    } catch (err) {
      console.error("getCashDepositStatus failed:", err);
      return {
        cash_balance: 0,
        held_since: null,
        due_at: null,
        is_overdue: false,
        inflow_locked: false,
        hours_remaining: null,
        hours_overdue: null,
        deposit_window_hours: 48,
        formatted_cash_balance: formatCurrency(0),
        checkFailed: true,
      };
    }
  },

  async depositCashToBank(workspaceId, payload) {
    const res = await financeApi.depositCash(workspaceId, payload);
    return safeData(res);
  },

  // ========================================
  // BANK ACCOUNTS
  // ========================================

  async getBankAccounts(workspaceId, params = {}) {
    const res = await financeApi.bankAccounts(workspaceId, params);
    const data = safeData(res);
    return Array.isArray(data) ? data : data.accounts || [];
  },

  async createBankAccount(workspaceId, payload) {
    const res = await financeApi.createBankAccount(workspaceId, payload);
    return safeData(res);
  },

  async updateBankAccount(workspaceId, bankAccountId, payload) {
    const res = await financeApi.updateBankAccount(workspaceId, bankAccountId, payload);
    return safeData(res);
  },

  async deactivateBankAccount(workspaceId, bankAccountId) {
    const res = await financeApi.deactivateBankAccount(workspaceId, bankAccountId);
    return safeData(res);
  },

  // { ownerType, ownerId, totalDebits, totalCredits, difference, balanced, checkedAt }
  async getGlBalance(workspaceId) {
    try {
      const res = await financeApi.glBalance(workspaceId);
      const data = safeData(res);
      return {
        ...data,
        totalDebits: safeNumber(data.totalDebits),
        totalCredits: safeNumber(data.totalCredits),
        difference: safeNumber(data.difference),
        balanced: data.balanced !== false,
        checkFailed: false,
      };
    } catch (err) {
      console.error("getGlBalance failed:", err);
      // Fail OPEN, not closed: a network hiccup or a 403 must never trigger
      // the blocking "books don't balance" modal. Only a confirmed
      // balanced:false from the backend should ever do that.
      return { balanced: true, checkFailed: true };
    }
  },

  async getRecentPayments(workspaceId) {
    const res = await financeApi.recentPayments(workspaceId);
    const data = safeData(res);
    const items = Array.isArray(data) ? data : data.items || [];
    return items.map((p) => ({
      ...p,
      amount: safeNumber(p.amount),
    }));
  },

  // ========================================
  // CONTRIBUTIONS REGISTER
  // ========================================
  //
  // Backed by GET /finance/contributions. Always returns the full shape
  // (plans / payments / members / totals) even on failure, so no caller
  // has to guard every field it reads.
  async getContributionsRegister(workspaceId, params = {}) {
    const empty = {
      scope: "own",
      plans: [],
      payments: [],
      members: [],
      totals: {
        expected: 0, collected: 0, outstanding: 0, in_flight: 0,
        failed_count: 0, payment_count: 0, contributor_count: 0,
        member_count: 0, collection_rate: 0, collected_this_month: 0,
        overdue_amount: 0, overdue_member_count: 0,
      },
    };

    try {
      const res = await financeApi.contributions(workspaceId, params);
      const data = safeData(res);

      return {
        ...empty,
        ...data,
        plans: Array.isArray(data.plans) ? data.plans : [],
        payments: Array.isArray(data.payments) ? data.payments : [],
        members: Array.isArray(data.members) ? data.members : [],
        totals: { ...empty.totals, ...(data.totals || {}) },
      };
    } catch (err) {
      console.error("getContributionsRegister failed:", err);
      return empty;
    }
  },

  // { role, permissions: { 'contributions.record': 'all' | 'own', ... } }
  async getPermissions(workspaceId) {
    try {
      const res = await financeApi.permissions(workspaceId);
      const data = safeData(res);
      return {
        role: data.role || null,
        permissions: data.permissions || {},
        membership_id: data.membership_id || null,
      };
    } catch (err) {
      console.error("getPermissions failed:", err);
      return { role: null, permissions: {}, membership_id: null };
    }
  },

  async recordContribution(payload) {
    const res = await financeApi.recordContribution(payload);
    return safeData(res);
  },

  async getContributionPlans(workspaceId, ownerType) {
    const res = await financeApi.contributionPlans(workspaceId, ownerType);
    return safeData(res).plans || [];
  },

  async getContributionObligations(planId, workspaceId, ownerType, participantId, status) {
    const res = await financeApi.contributionObligations(planId, workspaceId, ownerType, participantId, status);
    return safeData(res).obligations || [];
  },

  // `period` is either a single as-at date string (balance sheet, trial balance)
  // or { from, to } (income statement over a window, e.g. one financial year).
  // `scope`: "chama" (default, member money only) or "business" (income from
  // chama-owned businesses and properties, kept apart from member money).
  async getReport(workspaceId, reportType, mode = "CHAMA", period, scope = "chama") {
    try {
      const range = period && typeof period === "object" ? { from: period.from, to: period.to } : { asAtDate: period };
      const res = await financeApi.reports(workspaceId, { reportType, mode, scope, ...range });
      return safeData(res);
    } catch (err) {
      console.error("getReport failed:", err);
      return {};
    }
  },

  // Business & property fund overview: balance, income, expenses, profit and
  // what each business or property holds. Never includes member money.
  async getBusinessFunds(workspaceId, period) {
    const res = await financeApi.businessFunds(workspaceId, period && typeof period === "object" ? { from: period.from, to: period.to } : {});
    return safeData(res);
  },

  // ========================================
  // LEDGER ADJUSTMENTS
  // ========================================

  async getAdjustments(workspaceId, params = {}) {
    try {
      const res = await financeApi.adjustments(workspaceId, params);
      const data = safeData(res);
      const items = Array.isArray(data) ? data : data.adjustments || [];
      return items.map((a) => ({ ...a, amount: safeNumber(a.amount) }));
    } catch (err) {
      console.error("getAdjustments failed:", err);
      return [];
    }
  },

  async getAdjustment(workspaceId, adjustmentId) {
    const res = await financeApi.adjustment(workspaceId, adjustmentId);
    const data = safeData(res);
    return { ...data, amount: safeNumber(data.amount) };
  },

  async requestAdjustment(workspaceId, payload) {
    const res = await financeApi.requestAdjustment(workspaceId, payload);
    return safeData(res);
  },

  async decideAdjustment(workspaceId, adjustmentId, payload) {
    const res = await financeApi.decideAdjustment(workspaceId, adjustmentId, payload);
    return safeData(res);
  },

  async cancelAdjustment(workspaceId, adjustmentId, reason) {
    const res = await financeApi.cancelAdjustment(workspaceId, adjustmentId, { reason });
    return safeData(res);
  },

  // ========================================
  // BANK RECONCILIATION
  // ========================================

  async getReconciliationSessions(workspaceId, params = {}) {
    try {
      const res = await financeApi.reconciliationSessions(workspaceId, params);
      const data = safeData(res);
      return Array.isArray(data) ? data : data.sessions || [];
    } catch (err) {
      console.error("getReconciliationSessions failed:", err);
      return [];
    }
  },

  // Returns { session, summary } - summary carries the matched/unmatched/
  // ignored line counts the backend already computed, so the UI never has
  // to re-derive it from session.lines itself.
  async getReconciliationSession(workspaceId, sessionId) {
    const res = await financeApi.reconciliationSession(workspaceId, sessionId);
    return {
      session: safeData(res),
      summary: res?.data?.summary || null,
    };
  },

  async createReconciliationSession(workspaceId, payload) {
    const res = await financeApi.createReconciliationSession(workspaceId, payload);
    return safeData(res);
  },

  async addReconciliationLines(workspaceId, sessionId, lines) {
    const res = await financeApi.addReconciliationLines(workspaceId, sessionId, lines);
    return safeData(res);
  },

  async autoMatchReconciliation(workspaceId, sessionId) {
    const res = await financeApi.autoMatchReconciliation(workspaceId, sessionId);
    return safeData(res);
  },

  async matchReconciliationLine(workspaceId, sessionId, lineId, ledgerEntryId) {
    const res = await financeApi.matchReconciliationLine(workspaceId, sessionId, lineId, ledgerEntryId);
    return safeData(res);
  },

  async unmatchReconciliationLine(workspaceId, sessionId, lineId) {
    const res = await financeApi.unmatchReconciliationLine(workspaceId, sessionId, lineId);
    return safeData(res);
  },

  async ignoreReconciliationLine(workspaceId, sessionId, lineId, reason) {
    const res = await financeApi.ignoreReconciliationLine(workspaceId, sessionId, lineId, reason);
    return safeData(res);
  },

  async raiseAdjustmentForLine(workspaceId, sessionId, lineId, payload) {
    const res = await financeApi.raiseAdjustmentForLine(workspaceId, sessionId, lineId, payload);
    return safeData(res);
  },

  async completeReconciliationSession(workspaceId, sessionId, force = false) {
    const res = await financeApi.completeReconciliationSession(workspaceId, sessionId, force);
    return safeData(res);
  },

  // Export helpers in case you need them in components
  safeNumber,
  formatCurrency,
};

export default financeService;
