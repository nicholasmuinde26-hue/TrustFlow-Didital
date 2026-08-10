/**
 * ============================================================================
 * FINANCE ACCOUNT SERVICE
 * ============================================================================
 */

import mongoose from "mongoose";
import FinancialAccount from "../../models/FinancialAccount.js";
import { ENTRY_TYPES, ACCOUNT_NORMAL_BALANCE } from "./accounting/accounting.constants.js";
import { toDecimal } from "../../shared/decimal.js";

// Helper: detect if mongo supports transactions
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === "ReplicaSetWithPrimary" || topology?.description?.type === "Sharded";
};

// Helper: only add session to opts if transactions are supported
const getOpts = (session) => canUseTransactions() && session? { session } : {};

class FinanceAccountService {

    async applyEntries(entries = [], session = null){
        const opts = getOpts(session);
        const updatedAccounts = [];

        for(const entry of entries){
            const accountId = entry.account_id || entry.account;

            const account = await FinancialAccount.findById(accountId, null, opts); // FIX: use opts

            if(!account){
                throw new Error(`Financial account '${accountId}' not found`);
            }

            this.applyEntry(account, entry);

            await account.save(opts); // FIX: use opts

            updatedAccounts.push(account);
        }

        return updatedAccounts;
    }

    applyEntry(account, entry){
        const amount = toDecimal(entry.amount);
        const entryType = (entry.entry_type || entry.type).toLowerCase();

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
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.plus(amount).toFixed());
        } else {
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.minus(amount).toFixed());
        }
    }

    applyCreditNormalAccount(account, entryType, amount){
        const currentBalance = toDecimal(account.current_balance);
        if(entryType === ENTRY_TYPES.CREDIT){
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.plus(amount).toFixed());
        } else {
            account.current_balance = mongoose.Types.Decimal128.fromString(currentBalance.minus(amount).toFixed());
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

export const getPayoutPayableAccount = async ({ owner_type, owner_id, session = null })=>{
    const opts = getOpts(session);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: "PAYOUT_CLEARING" }, null, opts);
};

export const getContributionPaymentAssetAccount = async ({ owner_type, owner_id, payment_method, session = null })=>{
    const opts = getOpts(session);
    const map = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" };
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: map[payment_method] }, null, opts);
};

export default new FinanceAccountService();