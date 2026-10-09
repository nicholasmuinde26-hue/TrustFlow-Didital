// ============================================================================
// FINANCE REPORT CALC (pure - no database, no mongoose)
// ============================================================================
//
// Every figure on the trial balance, income statement, balance sheet and cash
// flow is derived here from posted ledger entries and nothing else. Money is
// BigInt at a fixed scale (the same helpers year-end uses), so a report for a
// financial year agrees with that year's snapshot to the cent. Nothing is
// invented: an empty book gives empty reports, not made-up lines.
//
// Inputs are plain data so this can be unit tested:
//   accounts   [{ _id, name, account_code, account_type, normal_balance,
//                 account_category, parent_account_id }]
//   totals     [{ account_id, entry_type, total }]            summed over a window
//   movements  [{ account_id, entry_type, tx_type, total }]   same, split by transaction type
// `total` is whatever Decimal128 / string / number the aggregation returned.
// ============================================================================

import { toScaled, fromScaled, signedEffect, classifyBucket } from '../yearEnd/yearEnd.calc.js';
import { PAYOUT_TX_TYPES } from '../yearEnd/yearEnd.constants.js';

export const num = (scaled) => Number(fromScaled(scaled));

const CASH_CATEGORIES = ['cash', 'bank', 'mpesa', 'mobile_money'];
const RECEIVABLE_CATEGORIES = ['receivable', 'loan'];

// Money that belongs to members rather than to the group's own surplus.
export const isMemberFund = (a) =>
  a.account_type === 'equity' || ['welfare', 'contribution', 'savings'].includes(a.account_category);

const idOf = (v) => String(v);

// Net balance of each account in its own normal-balance direction.
export const balancesFromTotals = (accounts, totals) => {
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  const balances = new Map();
  const debitCredit = new Map();
  for (const t of totals) {
    const a = byId.get(idOf(t.account_id));
    if (!a) continue; // entry on an account that is not in the list: surfaced by the caller's ledger cross-check
    const k = idOf(a._id);
    balances.set(k, (balances.get(k) ?? 0n) + signedEffect(a.normal_balance, t.entry_type, toScaled(t.total)));
    const dc = debitCredit.get(k) ?? { debit: 0n, credit: 0n };
    if (t.entry_type === 'debit') dc.debit += toScaled(t.total); else dc.credit += toScaled(t.total);
    debitCredit.set(k, dc);
  }
  return { balances, debitCredit };
};

// ---------------------------------------------------------------------------
// TRIAL BALANCE
// ---------------------------------------------------------------------------
export const buildTrialBalance = (accounts, totals) => {
  const { balances } = balancesFromTotals(accounts, totals);
  const codeById = new Map(accounts.map((a) => [idOf(a._id), a.account_code]));
  const items = [];
  let totalDebit = 0n;
  let totalCredit = 0n;

  for (const a of accounts) {
    const net = balances.get(idOf(a._id)) ?? 0n;
    if (net === 0n && !balances.has(idOf(a._id))) continue; // never posted to
    let debit = 0n;
    let credit = 0n;
    if (a.normal_balance === 'debit') { if (net >= 0n) debit = net; else credit = -net; }
    else if (net >= 0n) credit = net; else debit = -net;
    if (debit === 0n && credit === 0n) continue; // posted to but nets to nothing
    items.push({
      account: a.name,
      account_code: a.account_code,
      parent_account_code: a.parent_account_id ? codeById.get(idOf(a.parent_account_id)) || null : null,
      debit: num(debit),
      credit: num(credit),
    });
    totalDebit += debit;
    totalCredit += credit;
  }
  const difference = totalDebit - totalCredit;
  return {
    items,
    totalDebit: num(totalDebit),
    totalCredit: num(totalCredit),
    difference: num(difference),
    balanced: difference === 0n,
    _scaled: { totalDebit, totalCredit },
  };
};

// ---------------------------------------------------------------------------
// BALANCE SHEET (position as at the cut-off)
// ---------------------------------------------------------------------------
// Assets = Liabilities + Member funds + Accumulated surplus. Income and expense
// accounts are never closed by journal entries (year-end "clears" them in the
// snapshot only), so their running net is shown as accumulated surplus. Without
// that line the sheet cannot balance whenever the group has earned interest.
export const buildBalanceSheet = (accounts, totals) => {
  const { balances } = balancesFromTotals(accounts, totals);
  const codeById = new Map(accounts.map((a) => [idOf(a._id), a.account_code]));

  let cashBank = 0n; let receivables = 0n; let otherAssets = 0n;
  let liabilities = 0n; let equity = 0n; let surplus = 0n;
  const memberFunds = [];
  const otherAssetLines = [];
  const liabilityLines = [];

  for (const a of accounts) {
    const bal = balances.get(idOf(a._id)) ?? 0n;
    if (bal === 0n) continue;
    const line = { account: a.name, account_code: a.account_code, balance: num(bal) };
    switch (a.account_type) {
      case 'asset':
        if (CASH_CATEGORIES.includes(a.account_category)) cashBank += bal;
        else if (RECEIVABLE_CATEGORIES.includes(a.account_category)) receivables += bal;
        else { otherAssets += bal; otherAssetLines.push(line); }
        break;
      case 'liability': liabilities += bal; liabilityLines.push(line); break;
      case 'equity':
        equity += bal;
        memberFunds.push({ ...line, parent_account_code: a.parent_account_id ? codeById.get(idOf(a.parent_account_id)) || null : null });
        break;
      case 'income': surplus += bal; break;
      case 'expense': surplus -= bal; break;
      default: break;
    }
  }

  const totalAssets = cashBank + receivables + otherAssets;
  const totalFunds = equity + surplus;
  const difference = totalAssets - (liabilities + totalFunds);
  return {
    cashBank: num(cashBank),
    receivables: num(receivables),
    otherAssets: num(otherAssets),
    otherAssetLines,
    totalAssets: num(totalAssets),
    totalLiabilities: num(liabilities),
    liabilityLines,
    memberFunds: num(equity),
    memberFundLines: memberFunds,
    accumulatedSurplus: num(surplus),
    totalFunds: num(totalFunds),
    totalLiabilitiesAndFunds: num(liabilities + totalFunds),
    difference: num(difference),
    balanced: difference === 0n,
  };
};

// ---------------------------------------------------------------------------
// INCOME STATEMENT (movements inside a window)
// ---------------------------------------------------------------------------
const MGR_PAYOUT_TYPES = PAYOUT_TX_TYPES.filter((t) => /^payout|^chama_contrib_payout/.test(t));
const WITHDRAWAL_TYPES = PAYOUT_TX_TYPES.filter((t) => /^withdrawal/.test(t));
const SHAREOUT_TYPES = PAYOUT_TX_TYPES.filter((t) => /^savings_shareout/.test(t));

/**
 * behaviorByAccountId: Map<accountId, plan behaviour> for accounts that are a
 * plan's own ledger account. Contributions into a 'fine' plan are fines, into a
 * 'fee' plan are fees; everything else (including the shared
 * MEMBER_CONTRIBUTIONS account) is contributions.
 */
export const buildIncomeStatement = (accounts, movements, { behaviorByAccountId = new Map() } = {}) => {
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  let contributions = 0n; let fines = 0n; let fees = 0n;
  let otherIncome = 0n; let adminCosts = 0n;
  let mgrPayouts = 0n; let withdrawals = 0n; let shareouts = 0n;
  const incomeLines = new Map();
  const expenseLines = new Map();
  const addLine = (map, a, v) => map.set(idOf(a._id), { account: a.name, account_code: a.account_code, amount: (map.get(idOf(a._id))?.amount ?? 0n) + v });

  for (const m of movements) {
    const a = byId.get(idOf(m.account_id));
    if (!a) continue;
    const effect = signedEffect(a.normal_balance, m.entry_type, toScaled(m.total));

    if (a.account_type === 'income') {
      // Loan penalties are fines; every other income account (loan interest, asset income) is other income.
      if (a.account_code === 'PENALTY_INCOME') fines += effect; else otherIncome += effect;
      addLine(incomeLines, a, effect);
      continue;
    }
    if (a.account_type === 'expense') {
      adminCosts += effect;
      addLine(expenseLines, a, effect);
      continue;
    }
    if (!isMemberFund(a)) continue; // cash, clearing accounts etc. only mirror what the member-fund side already shows

    const bucket = classifyBucket({ accountType: a.account_type, transactionType: m.tx_type });
    if (bucket === 'contributions') {
      const behavior = behaviorByAccountId.get(idOf(a._id));
      if (behavior === 'fine') fines += effect;
      else if (behavior === 'fee') fees += effect;
      else contributions += effect;
    } else if (bucket === 'payouts') {
      // A payout lowers member funds, so its effect on a credit-normal account is negative.
      if (MGR_PAYOUT_TYPES.includes(m.tx_type)) mgrPayouts -= effect;
      else if (WITHDRAWAL_TYPES.includes(m.tx_type)) withdrawals -= effect;
      else if (SHAREOUT_TYPES.includes(m.tx_type)) shareouts -= effect;
    }
  }

  const totalIncome = contributions + fines + fees + otherIncome;
  const totalExpenses = mgrPayouts + adminCosts;
  const surplus = totalIncome - totalExpenses;
  const lines = (map) => [...map.values()].filter((l) => l.amount !== 0n).map((l) => ({ ...l, amount: num(l.amount) }));
  return {
    contributions: num(contributions),
    fines: num(fines),
    fees: num(fees),
    otherIncome: num(otherIncome),
    totalIncome: num(totalIncome),
    mgrPayouts: num(mgrPayouts),
    adminCosts: num(adminCosts),
    totalExpenses: num(totalExpenses),
    surplus: num(surplus),
    // Movements in members' own money. Real cash going out, but not a cost to the group,
    // so they are shown beside the statement rather than deducted from the surplus.
    memberFundMovements: { withdrawals: num(withdrawals), shareOuts: num(shareouts) },
    incomeLines: lines(incomeLines),
    expenseLines: lines(expenseLines),
  };
};

// Business view of the same ledger: revenue and operating expense by account.
export const buildBusinessIncome = (accounts, movements) => {
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  let revenue = 0n; let opex = 0n;
  const expenseLines = new Map();
  for (const m of movements) {
    const a = byId.get(idOf(m.account_id));
    if (!a) continue;
    const effect = signedEffect(a.normal_balance, m.entry_type, toScaled(m.total));
    if (a.account_type === 'income') revenue += effect;
    else if (a.account_type === 'expense') {
      opex += effect;
      const k = idOf(a._id);
      expenseLines.set(k, { account: a.name, account_code: a.account_code, amount: (expenseLines.get(k)?.amount ?? 0n) + effect });
    }
  }
  const cogs = 0n; // the chart of accounts has no cost-of-sales category yet, so nothing is split out
  return {
    revenue: num(revenue),
    cogs: num(cogs),
    grossProfit: num(revenue - cogs),
    totalOpex: num(opex),
    netProfit: num(revenue - cogs - opex),
    expenseLines: [...expenseLines.values()].filter((l) => l.amount !== 0n).map((l) => ({ ...l, amount: num(l.amount) })),
  };
};

// ---------------------------------------------------------------------------
// BUSINESS & PROPERTY FUND — income statement
// ---------------------------------------------------------------------------
// Statement for money earned by chama-owned businesses and properties, kept apart
// from member money (see finance/accounting/businessFunds.constants.js). Callers
// pass only business-fund accounts, and movements over those accounts.
//
//   revenue      credits to an asset income account by an income posting
//   expenses     debits to an asset expense account
//   netProfit    revenue - expenses
//   distributed  profit paid or credited to members (debits to the income account by
//                a profit-distribution posting). NOT a cost: shown below the profit
//                line, the same way member-fund movements sit beside the chama statement.
//   retained     netProfit - distributed: profit the business still holds
//
// byAsset is keyed by the asset suffix in the account code (ASI_<suffix> / ASE_<suffix>),
// so the service can attach asset names without this file knowing about assets.
const BIZ_INCOME_TX = ['chama_asset_income'];
const BIZ_DISTRIBUTION_TX = ['chama_profit_distribution', 'chama_profit_wallet_credit'];

export const buildBusinessFundStatement = (accounts, movements) => {
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  const suffix = (code) => String(code || '').replace(/^AS[IE]_/, '');
  const assets = new Map(); // suffix -> { revenue, expenses, distributed } (BigInt)
  const row = (key) => {
    if (!assets.has(key)) assets.set(key, { revenue: 0n, expenses: 0n, distributed: 0n });
    return assets.get(key);
  };
  let revenue = 0n; let expenses = 0n; let distributed = 0n; let otherIncome = 0n;

  for (const m of movements) {
    const a = byId.get(idOf(m.account_id));
    if (!a) continue;
    const effect = signedEffect(a.normal_balance, m.entry_type, toScaled(m.total));
    if (a.account_type === 'income') {
      const r = row(suffix(a.account_code));
      if (BIZ_INCOME_TX.includes(m.tx_type)) { revenue += effect; r.revenue += effect; }
      else if (BIZ_DISTRIBUTION_TX.includes(m.tx_type)) { distributed -= effect; r.distributed -= effect; }
      else { otherIncome += effect; r.revenue += effect; revenue += effect; } // e.g. an adjustment: still income
    } else if (a.account_type === 'expense') {
      expenses += effect; row(suffix(a.account_code)).expenses += effect;
    }
  }

  const netProfit = revenue - expenses;
  const byAsset = [...assets.entries()]
    .map(([key, v]) => ({
      assetKey: key,
      revenue: num(v.revenue),
      expenses: num(v.expenses),
      netProfit: num(v.revenue - v.expenses),
      distributed: num(v.distributed),
      retained: num(v.revenue - v.expenses - v.distributed),
    }))
    .filter((r) => r.revenue !== 0 || r.expenses !== 0 || r.distributed !== 0);

  return {
    revenue: num(revenue),
    totalExpenses: num(expenses),
    netProfit: num(netProfit),
    distributed: num(distributed),
    retained: num(netProfit - distributed),
    byAsset,
  };
};

// ---------------------------------------------------------------------------
// CASH FLOW (direct method, over cash / bank / M-Pesa accounts)
// ---------------------------------------------------------------------------
// opening + net movement = closing, always: opening is the ledger balance of the
// cash accounts before the window, movements are the window's entries on those
// accounts. Movements are grouped by transaction type and each group's net is a
// receipt (positive) or a payment (negative). A transfer between two cash
// accounts (cash banked) nets to nothing inside its own group.
export const buildCashFlow = (accounts, beforeTotals, movements) => {
  const cashIds = new Set(accounts.filter((a) => a.account_type === 'asset' && CASH_CATEGORIES.includes(a.account_category)).map((a) => idOf(a._id)));
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  const opening = [...balancesFromTotals(accounts.filter((a) => cashIds.has(idOf(a._id))), beforeTotals).balances.values()].reduce((s, v) => s + v, 0n);

  const groups = new Map();
  for (const m of movements) {
    if (!cashIds.has(idOf(m.account_id))) continue;
    const a = byId.get(idOf(m.account_id));
    const type = m.tx_type || 'other';
    groups.set(type, (groups.get(type) ?? 0n) + signedEffect(a.normal_balance, m.entry_type, toScaled(m.total)));
  }
  let cashIn = 0n; let cashOut = 0n;
  const lines = [];
  for (const [type, net] of groups) {
    if (net === 0n) continue;
    if (net > 0n) cashIn += net; else cashOut += -net;
    lines.push({ type, amount: num(net) });
  }
  lines.sort((a, b) => b.amount - a.amount);
  const net = cashIn - cashOut;
  return {
    cashIn: num(cashIn),
    cashOut: num(cashOut),
    netCashMovement: num(net),
    openingBalance: num(opening),
    closingBalance: num(opening + net),
    lines,
  };
};

// ---------------------------------------------------------------------------
// RECEIPTS & PAYMENTS (cash basis)
// ---------------------------------------------------------------------------
// The statement most chama treasurers and AGMs actually read: cash at the start,
// every receipt and payment by purpose, cash at the end.
//
// It is built from whole transactions. For each transaction that moved cash, every
// NON-cash leg carries its share of that movement (credit minus debit: positive is
// money that came in, negative is money that went out), and the leg's account says
// what the money was for. Because a transaction's debits equal its credits, the
// shares add up to the cash movement exactly, so the statement cannot lose or invent
// a shilling: opening + receipts - payments = closing is checked against the ledger.
//
//   txs: [{ tx_type, legs: [{ account_id, entry_type, total }] }]  (one per transaction)

const PAYOUT_TYPE_GROUPS = [
  [/^withdrawal/, 'Member withdrawals'],
  [/^savings_shareout/, 'Savings share-outs'],
  [/^payout|^chama_contrib_payout/, 'Merry-go-round and fund payouts'],
];

const classifyLeg = (a, amount, txType, { behaviorByAccountId, planNameByAccountId }) => {
  const receipt = amount > 0n;
  const id = idOf(a._id);

  if (a.account_type === 'income') {
    return a.account_code === 'PENALTY_INCOME'
      ? { group: 'Fines and penalties', line: 'Loan penalties' }
      : { group: 'Interest and other income', line: a.name };
  }
  if (a.account_type === 'expense') return { group: 'Expenses', line: a.name };

  if (isMemberFund(a)) {
    const behavior = behaviorByAccountId.get(id);
    if (behavior === 'fine') return { group: 'Fines and penalties', line: planNameByAccountId.get(id) || a.name };
    if (behavior === 'fee') return { group: 'Fees', line: planNameByAccountId.get(id) || a.name };
    if (a.account_code === 'MEMBER_SAVINGS' || a.account_category === 'savings') {
      return { group: receipt ? 'Savings deposited' : 'Member withdrawals', line: a.name };
    }
    // Money paid OUT of a fund account (a harambee paid to its beneficiary, a welfare payout)
    // is a payout, not a refund of contributions.
    if (!receipt) {
      for (const [re, label] of PAYOUT_TYPE_GROUPS) {
        if (re.test(txType || '')) return { group: label, line: planNameByAccountId.get(id) || a.name };
      }
    }
    return { group: receipt ? 'Member contributions' : 'Refunds of contributions', line: planNameByAccountId.get(id) || a.name };
  }

  if (a.account_type === 'asset') {
    if (RECEIVABLE_CATEGORIES.includes(a.account_category)) {
      return receipt ? { group: 'Loans', line: 'Loan principal repaid' } : { group: 'Loans', line: 'Loans given out' };
    }
    return receipt
      ? { group: 'Investments and assets', line: `Sale of ${a.name}` }
      : { group: 'Investments and assets', line: `Purchase of ${a.name}` };
  }

  // Liability legs: clearing accounts stand for money owed to or collected for members.
  for (const [re, label] of PAYOUT_TYPE_GROUPS) {
    if (re.test(txType || '')) return { group: label, line: label };
  }
  if (txType === 'mgr_contribution') return { group: 'Merry-go-round contributions', line: 'Merry-go-round contributions' };
  return receipt ? { group: 'Other receipts', line: a.name } : { group: 'Other payments', line: a.name };
};

export const buildReceiptsPayments = (
  accounts,
  txs,
  { openingTotals = [], closingTotals = [], behaviorByAccountId = new Map(), planNameByAccountId = new Map() } = {}
) => {
  const byId = new Map(accounts.map((a) => [idOf(a._id), a]));
  const cashAccounts = accounts.filter((a) => a.account_type === 'asset' && CASH_CATEGORIES.includes(a.account_category));
  const cashIds = new Set(cashAccounts.map((a) => idOf(a._id)));
  const ctx = { behaviorByAccountId, planNameByAccountId };

  const receipts = new Map(); // group -> Map(line -> BigInt)
  const payments = new Map();
  const add = (side, group, line, v) => {
    if (!side.has(group)) side.set(group, new Map());
    side.get(group).set(line, (side.get(group).get(line) ?? 0n) + v);
  };

  for (const tx of txs) {
    // Legs on the same account are netted, so a refund posted as two entries doesn't show twice.
    const net = new Map();
    for (const leg of tx.legs) {
      const k = idOf(leg.account_id);
      const v = toScaled(leg.total);
      net.set(k, (net.get(k) ?? 0n) + (leg.entry_type === 'credit' ? v : -v)); // credit minus debit
    }
    for (const [accountId, amount] of net) {
      if (cashIds.has(accountId) || amount === 0n) continue;
      const a = byId.get(accountId);
      if (!a) continue;
      const { group, line } = classifyLeg(a, amount, tx.tx_type, ctx);
      if (amount > 0n) add(receipts, group, line, amount); else add(payments, group, line, -amount);
    }
  }

  const sumOf = (side) => [...side.values()].reduce((s, g) => s + [...g.values()].reduce((x, v) => x + v, 0n), 0n);
  const shape = (side) => [...side.entries()]
    .map(([group, lines]) => {
      const rows = [...lines.entries()].filter(([, v]) => v !== 0n).map(([label, v]) => ({ label, amount: num(v), _s: v })).sort((x, y) => (y._s > x._s ? 1 : -1));
      return { group, total: num(rows.reduce((s, r) => s + r._s, 0n)), lines: rows.map(({ _s, ...r }) => r), _t: rows.reduce((s, r) => s + r._s, 0n) };
    })
    .filter((g) => g.lines.length)
    .sort((x, y) => (y._t > x._t ? 1 : -1))
    .map(({ _t, ...g }) => g);

  const totalReceipts = sumOf(receipts);
  const totalPayments = sumOf(payments);

  // Cash held, by account, at the start and end of the window.
  const open = balancesFromTotals(cashAccounts, openingTotals).balances;
  const close = balancesFromTotals(cashAccounts, closingTotals).balances;
  let opening = 0n; let closing = 0n;
  const holdings = [];
  for (const a of cashAccounts) {
    const o = open.get(idOf(a._id)) ?? 0n;
    const c = close.get(idOf(a._id)) ?? 0n;
    opening += o; closing += c;
    if (o !== 0n || c !== 0n) holdings.push({ account: a.name, account_code: a.account_code, opening: num(o), closing: num(c) });
  }

  const computedClosing = opening + totalReceipts - totalPayments;
  const difference = closing - computedClosing;
  return {
    openingBalance: num(opening),
    receipts: shape(receipts),
    totalReceipts: num(totalReceipts),
    payments: shape(payments),
    totalPayments: num(totalPayments),
    netMovement: num(totalReceipts - totalPayments),
    closingBalance: num(closing),
    holdings,
    reconciles: difference === 0n,
    difference: num(difference),
  };
};
