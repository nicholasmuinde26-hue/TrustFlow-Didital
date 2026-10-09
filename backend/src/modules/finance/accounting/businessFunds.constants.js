/**
 * ============================================================================
 * BUSINESS & PROPERTY FUNDS — shared constants and classifier
 * ============================================================================
 *
 * Money earned by chama-owned businesses and properties (POS sales, rent,
 * lease income, M-Pesa C2B asset income) is NOT member money. It must never
 * show up in the pooled chama balance (CASH / BANK / MPESA_CLEARING), in
 * member savings, or in member contributions.
 *
 * It is kept in its own fund, inside the same Chama ledger:
 *
 *   BIZ_CASH / BIZ_BANK / BIZ_MPESA   asset accounts holding the money
 *   ASI_<asset>                       per-asset income account
 *   ASE_<asset>                       per-asset expense account
 *   PROFIT_WALLET_PAYABLE             profit owed to members, not yet paid out
 *
 * Every report, summary and statement that is about the chama's own pooled
 * money filters these accounts OUT (isBusinessFundAccount). The business
 * statements filter everything else out. Postings stay self-balanced inside
 * each side, so neither partition is ever out of balance.
 * ============================================================================
 */

// Collection method (what recordIncome / recordExpense receive) -> the business
// fund account that holds that money.
export const BUSINESS_FUND_ACCOUNT_BY_METHOD = Object.freeze({
  cash: "BIZ_CASH",
  bank: "BIZ_BANK",
  mpesa: "BIZ_MPESA",
});

// The pooled chama account each business fund account mirrors. Used by the
// one-off migration that moves historic balances out of the pooled accounts.
export const POOLED_ACCOUNT_BY_BUSINESS_FUND = Object.freeze({
  BIZ_CASH: "CASH",
  BIZ_BANK: "BANK",
  BIZ_MPESA: "MPESA_CLEARING",
});

export const BUSINESS_FUND_ACCOUNT_CODES = Object.freeze(Object.keys(POOLED_ACCOUNT_BY_BUSINESS_FUND));

export const BUSINESS_FUND_ACCOUNT_DEFS = Object.freeze({
  BIZ_CASH: { name: "Business Cash", system_key: "biz_cash", account_category: "cash", description: "Cash held from chama business and property income. Not member money." },
  BIZ_BANK: { name: "Business Bank", system_key: "biz_bank", account_category: "bank", description: "Bank balance from chama business and property income. Not member money." },
  BIZ_MPESA: { name: "Business M-Pesa", system_key: "biz_mpesa", account_category: "mpesa", description: "M-Pesa balance from chama business and property income. Not member money." },
});

export const PROFIT_WALLET_PAYABLE_CODE = "PROFIT_WALLET_PAYABLE";

// Transaction types that belong to the business fund. The pooled chama feeds leave
// them out. (Buying an asset and funding a business use members' money, so they stay.)
export const BUSINESS_TRANSACTION_TYPES = Object.freeze([
  "chama_asset_income",
  "chama_asset_expense",
  "chama_profit_distribution",
  "chama_profit_wallet_credit",
  "chama_profit_wallet_withdrawal",
  "business_funds_reclass",
]);

export const FUND_SCOPES = Object.freeze({ CHAMA: "chama", BUSINESS: "business" });

const ASSET_INCOME_RE = /^ASI_/;
const ASSET_EXPENSE_RE = /^ASE_/;

/**
 * True when the account belongs to the business & property fund.
 * Reads the explicit `fund_scope` marker first; falls back to the account code
 * so accounts created before the marker existed are still classified correctly
 * without needing the migration to have run first.
 */
export const isBusinessFundAccount = (account) => {
  if (!account) return false;
  if (account.fund_scope === FUND_SCOPES.BUSINESS) return true;
  if (account.fund_scope === FUND_SCOPES.CHAMA) return false;
  const code = String(account.account_code || "");
  return (
    BUSINESS_FUND_ACCOUNT_CODES.includes(code) ||
    code === PROFIT_WALLET_PAYABLE_CODE ||
    ASSET_INCOME_RE.test(code) ||
    ASSET_EXPENSE_RE.test(code)
  );
};

export const isAssetIncomeAccount = (account) => ASSET_INCOME_RE.test(String(account?.account_code || ""));
export const isAssetExpenseAccount = (account) => ASSET_EXPENSE_RE.test(String(account?.account_code || ""));

export const assetIdSuffixFromCode = (code) => String(code || "").replace(/^AS[IE]_/, "");

/** Split a list of accounts by scope. */
export const partitionAccounts = (accounts) => {
  const chama = [];
  const business = [];
  for (const a of accounts) (isBusinessFundAccount(a) ? business : chama).push(a);
  return { chama, business };
};

/**
 * Find-or-create one account in the business fund, marked as such.
 * `opts` is a mongoose options object (session) or {}.
 */
export async function ensureBusinessFundAccount(FinancialAccount, { owner_type = "Chama", owner_id, code, createdBy = null }, opts = {}) {
  let account = await FinancialAccount.findOne({ owner_type, owner_id, account_code: code }, null, opts);
  if (account) {
    if (account.fund_scope !== FUND_SCOPES.BUSINESS) {
      await FinancialAccount.updateOne({ _id: account._id }, { $set: { fund_scope: FUND_SCOPES.BUSINESS } }, opts);
      account.fund_scope = FUND_SCOPES.BUSINESS;
    }
    return account;
  }
  const def = BUSINESS_FUND_ACCOUNT_DEFS[code];
  if (!def) throw new Error(`Unknown business fund account ${code}`);
  const created = await FinancialAccount.create(
    [{
      owner_type,
      owner_id,
      name: def.name,
      account_code: code,
      system_key: def.system_key,
      account_type: "asset",
      normal_balance: "debit",
      account_category: def.account_category,
      is_system_account: true,
      fund_scope: FUND_SCOPES.BUSINESS,
      description: def.description,
      created_by: createdBy,
    }],
    opts
  );
  return Array.isArray(created) ? created[0] : created;
}
