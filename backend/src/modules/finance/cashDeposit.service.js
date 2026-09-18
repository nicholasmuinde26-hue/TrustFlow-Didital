/**
 * ============================================================================
 * CASH DEPOSIT SERVICE
 * ============================================================================
 *
 * Chama policy: a treasurer may receive contributions/payments in cash, but
 * that cash must never be KEPT as cash - it has to be banked. This service
 * is the home for that policy:
 *
 *  - getCashDepositStatus()   read-only view of the CASH account's clock
 *  - assertCashInflowAllowed()  the "force" mechanism - called from
 *    CashProvider.initiate() before ANY new cash payment is accepted, so a
 *    treasurer who has let cash go overdue cannot keep collecting more cash
 *    until the outstanding amount is deposited.
 *  - depositCashToBank()     treasurer's action to clear the clock, backed
 *    by the existing double-entry finance operation (CASH -> BANK transfer)
 *
 * The clock itself (held_since / due_at / is_overdue) is maintained in
 * financeAccount.service.js#applyEntries, the single choke point every
 * ledger posting already passes through.
 * ============================================================================
 */

import FinancialAccount from "../../models/FinancialAccount.js";
import ChamaBankAccount from "../../models/ChamaBankAccount.js";
import AppError from "../../utils/AppError.js";
import { toDecimal } from "../../shared/decimal.js";
import { CASH_DEPOSIT_WINDOW_MS } from "./financeAccount.service.js";
import { postFinanceOperation } from "./financeOperation.service.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../constants/audit.constants.js";

const toNumber = (value) => Number(toDecimal(value).toFixed(2));

async function getCashAccount(ownerType, ownerId, session = null) {
  return FinancialAccount.findOne(
    { owner_type: ownerType, owner_id: ownerId, account_code: "CASH" },
    null,
    session ? { session } : {}
  );
}

/**
 * Read-only snapshot of the un-banked cash position, for the treasurer
 * dashboard and the enforcement job.
 */
export async function getCashDepositStatus(ownerType, ownerId) {
  const account = await getCashAccount(ownerType, ownerId);
  if (!account) {
    return {
      cash_balance: 0,
      held_since: null,
      due_at: null,
      is_overdue: false,
      hours_remaining: null,
      hours_overdue: null,
      inflow_locked: false
    };
  }

  const tracking = account.cash_deposit_tracking || {};
  const balance = toNumber(account.current_balance);
  const now = Date.now();

  let hoursRemaining = null;
  let hoursOverdue = null;
  if (tracking.due_at) {
    const diffMs = new Date(tracking.due_at).getTime() - now;
    if (diffMs >= 0) hoursRemaining = Math.round((diffMs / 3_600_000) * 10) / 10;
    else hoursOverdue = Math.round((-diffMs / 3_600_000) * 10) / 10;
  }

  return {
    financial_account_id: account._id,
    cash_balance: balance,
    held_since: tracking.held_since || null,
    due_at: tracking.due_at || null,
    is_overdue: Boolean(tracking.is_overdue),
    hours_remaining: hoursRemaining,
    hours_overdue: hoursOverdue,
    inflow_locked: Boolean(tracking.inflow_locked),
    deposit_window_hours: CASH_DEPOSIT_WINDOW_MS / 3_600_000
  };
}

/**
 * The enforcement hook. Throws a 423 (Locked) AppError if this workspace's
 * cash-in-hand has been sitting past the deposit deadline AND the
 * enforcement job has already flipped the lock (see
 * cashDepositEnforcement.job.js - the lock only engages once actually
 * overdue, never pre-emptively on a still-ticking clock).
 */
export async function assertCashInflowAllowed(ownerType, ownerId) {
  const account = await getCashAccount(ownerType, ownerId);
  if (!account) return;

  const tracking = account.cash_deposit_tracking || {};
  if (tracking.inflow_locked) {
    throw new AppError(
      "New cash payments are on hold: cash-in-hand is overdue for deposit into the bank. " +
        "Deposit the outstanding cash to the chama's bank account before recording any more cash payments.",
      423
    );
  }
}

/**
 * Treasurer deposits some/all of the cash-in-hand into a bank account.
 * Reuses the existing generic double-entry finance operation (CASH -> BANK
 * transfer) so the GL, journal, and ledger entries are posted exactly the
 * same way every other finance movement is - this function only adds the
 * bank-account bookkeeping and clears the deposit clock as a side effect
 * of the balance returning toward zero (handled automatically by
 * financeAccountService#applyEntries).
 */
export async function depositCashToBank({
  ownerType,
  ownerId,
  userId,
  bankAccountId = null,
  amount,
  reference = "",
  notes = ""
}) {
  const cashAccount = await getCashAccount(ownerType, ownerId);
  if (!cashAccount) {
    throw new AppError("Cash account not configured for this workspace", 400);
  }

  const bankFinancialAccount = await FinancialAccount.findOne({
    owner_type: ownerType,
    owner_id: ownerId,
    account_code: "BANK"
  });
  if (!bankFinancialAccount) {
    throw new AppError("Bank account not configured for this workspace", 400);
  }

  let bankAccount = null;
  if (bankAccountId) {
    bankAccount = await ChamaBankAccount.findOne({
      _id: bankAccountId,
      owner_type: ownerType,
      owner_id: ownerId,
      status: "active"
    });
    if (!bankAccount) {
      throw new AppError("Bank account not found for this workspace", 404);
    }
  } else {
    bankAccount = await ChamaBankAccount.findOne({
      owner_type: ownerType,
      owner_id: ownerId,
      status: "active",
      is_primary: true
    });
    // Not having a registered bank account yet shouldn't block depositing
    // into the chama's ledger BANK account - registering real bank details
    // is a separate, optional step (see bankAccount.service.js).
  }

  const value = toDecimal(amount);
  if (!value.isFinite() || value.lte(0)) {
    throw new AppError("Deposit amount must be greater than zero", 400);
  }
  if (value.gt(toDecimal(cashAccount.current_balance))) {
    throw new AppError("Deposit amount cannot exceed the current cash-in-hand balance", 400);
  }

  const description = [
    "Cash deposited to bank",
    bankAccount ? `(${bankAccount.bank_name} ${bankAccount.maskedAccountNumber?.() || ""})` : "",
    reference ? `- ref ${reference}` : "",
    notes ? `- ${notes}` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const result = await postFinanceOperation({
    ownerType,
    ownerId,
    userId,
    operation: "transfer",
    sourceAccountId: cashAccount._id,
    destinationAccountId: bankFinancialAccount._id,
    amount: value.toFixed(2),
    description
  });

  const status = await getCashDepositStatus(ownerType, ownerId);

  if (ownerType === "Chama") {
    await createAuditLog({
      actorUserId: userId,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId: ownerId,
      action: AUDIT_ACTIONS.CASH_DEPOSITED_TO_BANK,
      resourceType: "FinancialAccount",
      resourceId: cashAccount._id,
      after: {
        amount: value.toFixed(2),
        reference,
        bank_account_id: bankAccount?._id || null,
        remaining_cash_balance: status.cash_balance
      }
    }).catch(() => null);
  }

  return {
    ...result,
    bank_account: bankAccount
      ? {
          id: bankAccount._id,
          bank_name: bankAccount.bank_name,
          account_name: bankAccount.account_name,
          masked_account_number: bankAccount.maskedAccountNumber()
        }
      : null,
    cash_status: status
  };
}
