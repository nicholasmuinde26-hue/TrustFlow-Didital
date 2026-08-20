/**
 * ============================================================================
 * FINANCE ACCOUNT SERVICE
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";
import { ENTRY_TYPES, ACCOUNT_NORMAL_BALANCE } from "./accounting/accounting.constants.js";
import { toDecimal } from "../../shared/decimal.js";

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// FIX: was missing :
const getOpts = (session) => canUseTransactions() && session? { session } : {};

// ----------------------------------------------------------------------------
// SELF-HEAL: legacy account_code -> display name
// ----------------------------------------------------------------------------
// `FinancialAccount.name` became a required field after some accounts had
// already been created (directly, or by an older version of
// bootstrapSystemAccounts) without it. Those legacy documents fail full
// validation on ANY .save(), even when only current_balance changed, which
// aborts payment posting with "Path `name` is required."
// This map lets applyEntries backfill a sane name in-place instead of
// crashing the whole payment pipeline on stale data.
const LEGACY_ACCOUNT_NAME_BY_CODE = Object.freeze({
  CASH: "Cash",
  BANK: "Bank",
  MPESA_CLEARING: "M-Pesa Clearing",
  MEMBER_CONTRIBUTIONS: "Member Contributions",
  MEMBER_SAVINGS: "Member Savings",
  PAYOUT_CLEARING: "Payout Clearing",
  LOAN_RECEIVABLE: "Loans Receivable",
  INTEREST_INCOME: "Loan Interest Income",
  PENALTY_INCOME: "Loan Penalty Income",
});

const backfillLegacyName = (account) => {
  if (account.name && account.name.trim().length >= 2) return;

  const fallback =
    LEGACY_ACCOUNT_NAME_BY_CODE[account.account_code] ||
    `${account.account_category || account.account_type || "Untitled"} account`.replace(/^./, (c) => c.toUpperCase());

  console.warn(
    `[FinanceAccountService] Account '${account._id}' (code: ${account.account_code || "n/a"}) ` +
    `is missing a required 'name'. Backfilling with '${fallback}'. ` +
    `Consider running the account-name backfill script to clean this up permanently.`
  );

  account.name = fallback;
};

class FinanceAccountService {

    async applyEntries(entries = [], session = null){
        const opts = getOpts(session);
        const updatedAccounts = [];

        for(const entry of entries){
            const accountId = entry.account_id || entry.account;

            const account = await FinancialAccount.findById(accountId, null, opts);

            if(!account){
                throw new Error(`Financial account '${accountId}' not found`);
            }

            this.applyEntry(account, entry);

            backfillLegacyName(account);

            await account.save(opts);

            updatedAccounts.push(account);
        }

        return updatedAccounts;
    }

    applyEntry(account, entry){
        const amount = toDecimal(entry.amount);
        const entryType = (entry.entryType || entry.entry_type || entry.type || "").toLowerCase(); 

        switch(account.normal_balance){
            case ACCOUNT_NORMAL_BALANCE.DEBIT:
                this.applyDebitNormalAccount(account, entryType, amount);
            break;
            case ACCOUNT_NORMAL_BALANCE.CREDIT:
                this.applyCreditNormalAccount(account, entryType, amount);
            break;
            default:
                throw new Error(`Unknown normal balance '${account.normal_balance}'`);
        }
        account.lastPostedAt = new Date();
    }

    applyDebitNormalAccount(account, entryType, amount){
        const currentBalance = toDecimal(account.current_balance);
        if(entryType === ENTRY_TYPES.DEBIT){
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.plus(amount).toFixed(2));
        } else {
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.minus(amount).toFixed(2));
        }
    }

    applyCreditNormalAccount(account, entryType, amount){
        const currentBalance = toDecimal(account.current_balance);
        if(entryType === ENTRY_TYPES.CREDIT){
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.plus(amount).toFixed(2));
        } else {
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.minus(amount).toFixed(2));
        }
    }

    async findById(id, session = null){
        const opts = getOpts(session);
        return FinancialAccount.findById(id, null, opts);
    }

    async findByCode(code, owner_type = null, owner_id = null, session = null){
        const opts = getOpts(session);
        const query = { account_code: code };
        if(owner_type) query.owner_type = owner_type;
        if(owner_id) query.owner_id = owner_id;
        return FinancialAccount.findOne(query, null, opts);
    }

    async getAccount({code, owner_type, owner_id, session = null}){
        const opts = getOpts(session);
        const account = await FinancialAccount.findOne({ account_code: code, owner_type, owner_id }, null, opts);

        if(!account){
            throw new Error(`Account ${code} not found for ${owner_type}:${owner_id}`);
        }
        return account;
    }
}

/**
 * ============================================================================
 * LEGACY ACCOUNT RESOLVERS
 * ============================================================================
 */

export const getContributionEquityAccount = async ({ owner_type, owner_id, session = null })=>{
    const opts = getOpts(session);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: "MEMBER_CONTRIBUTIONS" }, null, opts);
};

export const getSavingsLiabilityAccount = async ({ owner_type, owner_id, session = null })=>{ // NEW
    const opts = getOpts(session);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: "MEMBER_SAVINGS" }, null, opts);
};

export const getPayoutPayableAccount = async ({ owner_type, owner_id, session = null })=>{
    const opts = getOpts(session);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: "PAYOUT_CLEARING" }, null, opts);
};

export const getContributionPaymentAssetAccount = async ({ owner_type, owner_id, payment_method, session = null })=>{
    const opts = getOpts(session);
    const map = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" };
    const code = map[payment_method] || "CASH";
    let account = await FinancialAccount.findOne({ owner_type, owner_id, account_code: code }, null, opts);
    
    if(!account && payment_method === 'mpesa'){
        account = await FinancialAccount.findOne({ owner_type, owner_id, account_code: "BANK" }, null, opts);
    }
    return account;
};

export default new FinanceAccountService();