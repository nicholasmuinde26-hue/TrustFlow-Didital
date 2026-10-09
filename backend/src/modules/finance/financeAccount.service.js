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
// CASH-IN-HAND DEPOSIT CLOCK
// ----------------------------------------------------------------------------
// No cash may sit un-banked for longer than this window (48h by default).
// Kept here (rather than only in cashDeposit.service.js) so the clock is
// maintained at the exact same choke point every ledger entry already
// passes through - applyEntries() below - and can never fall out of sync
// with the balance it's tracking.
export const CASH_DEPOSIT_WINDOW_MS =
  Number(process.env.CASH_DEPOSIT_WINDOW_MS) || 48 * 60 * 60 * 1000; // 48h

// Called after an account's current_balance has just been updated, with
// the balance it had immediately before this entry. Only CASH system
// accounts carry a deposit clock.
const updateCashDepositClock = (account, previousBalance) => {
  if (account.account_code !== "CASH") return;

  const before = toDecimal(previousBalance);
  const after = toDecimal(account.current_balance);
  const tracking = account.cash_deposit_tracking || {};

  if (before.lte(0) && after.gt(0)) {
    // Cash just started accumulating from empty - start the clock. If it
    // was already running (shouldn't happen once cleared below, but keep
    // it defensive), leave the original held_since alone.
    if (!tracking.held_since) {
      const now = new Date();
      tracking.held_since = now;
      tracking.due_at = new Date(now.getTime() + CASH_DEPOSIT_WINDOW_MS);
      tracking.is_overdue = false;
      tracking.overdue_since = null;
      tracking.last_reminder_sent_at = null;
      tracking.reminder_count = 0;
      tracking.last_broadcast_sent_at = null;
      tracking.inflow_locked = false;
    }
  } else if (after.lte(0)) {
    // Fully deposited/withdrawn - clock resets, cash may accumulate again.
    tracking.held_since = null;
    tracking.due_at = null;
    tracking.is_overdue = false;
    tracking.overdue_since = null;
    tracking.last_reminder_sent_at = null;
    tracking.reminder_count = 0;
    tracking.last_broadcast_sent_at = null;
    tracking.inflow_locked = false;
  }
  // Otherwise (still >0 before and after): a partial deposit or additional
  // cash came in while some was already outstanding - the clock keeps
  // running from the OLDEST cash still un-banked, so held_since is
  // deliberately left untouched here.

  account.cash_deposit_tracking = tracking;
};

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
  WITHDRAWAL_CLEARING: "Withdrawal Clearing",
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

            const balanceBefore = account.current_balance;

            this.applyEntry(account, entry);

            updateCashDepositClock(account, balanceBefore);

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

    // ========================================================================
    // RESERVE / RELEASE FUNDS ("reserved money" — see FinancialAccount.js)
    // ========================================================================
    //
    // Used when an obligation is APPROVED but not yet SETTLED (e.g. an
    // approved-but-not-yet-paid member withdrawal) to stop the same cash
    // being committed twice. This does NOT touch current_balance or post
    // any ledger entries — it only shrinks the account's available_balance
    // until the reservation is released (by settlement or cancellation).
    //
    // Both operations use an atomic conditional findOneAndUpdate so two
    // concurrent approvals can never both succeed against the same cash.
    //
    async reserveFunds({ accountId, amount, session = null }){
        const opts = getOpts(session);
        const value = toDecimal(amount);
        if(!value.gt(0)) throw new Error("Reservation amount must be greater than zero");

        // Only reserve if doing so would not exceed the account's current
        // balance — i.e. reserved_balance + amount <= current_balance.
        // Expressed with $expr so it's evaluated atomically against the
        // account's live fields, not a value read moments earlier.
        const updated = await FinancialAccount.findOneAndUpdate(
            {
                _id: accountId,
                $expr: {
                    $lte: [
                        { $add: [{ $toDecimal: "$reserved_balance" }, value.toNumber()] },
                        { $toDecimal: "$current_balance" }
                    ]
                }
            },
            { $inc: { reserved_balance: mongoose.Types.Decimal128.fromString(value.toFixed(2)) } },
            { returnDocument: 'after', ...opts }
        );

        if(!updated){
            const account = await FinancialAccount.findById(accountId, null, opts);
            if(!account) throw new Error(`Financial account '${accountId}' not found`);
            throw new Error(
                `Insufficient available funds in '${account.name}' to reserve KES ${value.toFixed(2)}`
            );
        }

        return updated;
    }

    async releaseFunds({ accountId, amount, session = null }){
        const opts = getOpts(session);
        const value = toDecimal(amount);
        if(!value.gt(0)) throw new Error("Release amount must be greater than zero");

        const account = await FinancialAccount.findById(accountId, null, opts);
        if(!account) throw new Error(`Financial account '${accountId}' not found`);

        const currentReserved = toDecimal(account.reserved_balance);
        const rawNext = currentReserved.minus(value);
        // Never go negative — a double-release (e.g. settle called after a
        // race with cancel) just clamps to zero instead of corrupting the
        // figure other reservations depend on.
        const nextReserved = rawNext.lt(0) ? toDecimal(0) : rawNext;

        account.reserved_balance = mongoose.Types.Decimal128.fromString(nextReserved.toFixed(2));
        await account.save(opts);
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

export const getWithdrawalClearingAccount = async ({ owner_type, owner_id, session = null })=>{
    const opts = getOpts(session);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: "WITHDRAWAL_CLEARING" }, null, opts);
};

// Maps a member's chosen disbursement channel to the real asset account
// that will be credited (mirrors PayoutRule.resolveDisbursementAccount,
// exposed here too since withdrawal.service.js needs the account
// document itself — not just its code — to reserve/release funds on it).
export const getDisbursementAssetAccount = async ({ owner_type, owner_id, method, session = null })=>{
    const opts = getOpts(session);
    const map = { cash: "CASH", bank: "BANK", mpesa: "MPESA_CLEARING" };
    const code = map[method];
    if(!code) throw new Error(`Unsupported disbursement method '${method}'`);
    return FinancialAccount.findOne({ owner_type, owner_id, account_code: code }, null, opts);
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