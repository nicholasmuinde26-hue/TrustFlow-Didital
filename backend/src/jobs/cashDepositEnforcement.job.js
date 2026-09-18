/**
 * ============================================================================
 * CASH DEPOSIT ENFORCEMENT JOB
 * ============================================================================
 *
 * Chama policy: cash a treasurer records must be deposited into the bank
 * within CASH_DEPOSIT_WINDOW_MS (48h by default) of first accumulating -
 * see financeAccount.service.js for the clock itself. This sweep is what
 * actually enforces that policy over time:
 *
 *  1. DUE SOON  - due_at is within DUE_SOON_WINDOW_MS and nobody's been
 *     reminded yet -> nudge the treasurer.
 *  2. JUST WENT OVERDUE - due_at has passed and the account isn't flagged
 *     overdue yet -> flag it, LOCK new cash inflow (CashProvider.initiate()
 *     checks this lock via cashDeposit.service.js#assertCashInflowAllowed),
 *     send an urgent reminder to the treasurer/chairperson, AND broadcast
 *     to every member - the "force them to deposit" transparency mechanism
 *     the whole chama can see cash is sitting un-banked.
 *  3. STILL OVERDUE - keep nudging the treasurer/chairperson on a cooldown
 *     so the alert doesn't go stale, and periodically re-broadcast to the
 *     whole chama for as long as it stays unresolved.
 *
 * The lock and all of this state clear automatically the moment the
 * treasurer deposits enough cash to bring the CASH balance back to zero
 * (financeAccount.service.js#updateCashDepositClock).
 * ============================================================================
 */

import FinancialAccount from "../models/FinancialAccount.js";
import ChamaMembership from "../models/ChamaMembership.js";
import notificationService from "../services/notification.service.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../services/audit.service.js";
import { AUDIT_ACTIONS } from "../constants/audit.constants.js";
import { toDecimal } from "../shared/decimal.js";

const SWEEP_INTERVAL_MS = Number(process.env.CASH_DEPOSIT_ENFORCEMENT_INTERVAL_MS) || 5 * 60 * 1000; // 5m
const DUE_SOON_WINDOW_MS = Number(process.env.CASH_DEPOSIT_DUE_SOON_WINDOW_MS) || 6 * 60 * 60 * 1000; // 6h before deadline
const REMINDER_COOLDOWN_MS = Number(process.env.CASH_DEPOSIT_REMINDER_COOLDOWN_MS) || 6 * 60 * 60 * 1000; // re-nudge officials every 6h while overdue
const BROADCAST_COOLDOWN_MS = Number(process.env.CASH_DEPOSIT_BROADCAST_COOLDOWN_MS) || 24 * 60 * 60 * 1000; // re-broadcast to all members every 24h while overdue
const BATCH_SIZE = Number(process.env.CASH_DEPOSIT_ENFORCEMENT_BATCH_SIZE) || 50;

let sweepInProgress = false;

const formatKsh = (value) => `KSh ${Number(toDecimal(value).toFixed(0)).toLocaleString()}`;

async function notifyOfficials({ chamaId, account, notificationType, title, message, actionDeadline }) {
  const officials = await ChamaMembership.find({
    chama_id: chamaId,
    role: { $in: ["treasurer", "chairperson"] },
    status: "active"
  });
  if (officials.length === 0) return;

  await notificationService.sendBulkNotification({
    chamaId,
    recipientMembershipIds: officials.map((m) => m._id),
    notificationType,
    title,
    message,
    metadata: {
      financial_account_id: String(account._id),
      cash_balance: account.current_balance?.toString?.() || String(account.current_balance)
    },
    relatedEntityType: "FinancialAccount",
    relatedEntityId: account._id,
    requiresAction: true,
    actionDeadline,
    eventSource: "cashDepositEnforcementJob"
  }).catch((err) => console.error("[cash-deposit-enforcement] notifyOfficials failed:", err.message));
}

async function broadcastToAllMembers({ chamaId, account }) {
  const members = await ChamaMembership.find({ chama_id: chamaId, status: "active" });
  if (members.length === 0) return;

  const balance = formatKsh(account.current_balance);

  await notificationService.sendBulkNotification({
    chamaId,
    recipientMembershipIds: members.map((m) => m._id),
    notificationType: "CASH_DEPOSIT_OVERDUE_ALERT",
    title: "Chama cash-in-hand overdue for deposit",
    message: `${balance} in cash collected by the treasurer has not yet been deposited into the chama's bank account, past the required deposit window. Officials have been notified.`,
    metadata: { financial_account_id: String(account._id) },
    relatedEntityType: "FinancialAccount",
    relatedEntityId: account._id,
    requiresAction: false,
    eventSource: "cashDepositEnforcementJob"
  }).catch((err) => console.error("[cash-deposit-enforcement] broadcastToAllMembers failed:", err.message));
}

async function handleAccount(account) {
  const tracking = account.cash_deposit_tracking || {};
  if (!tracking.held_since || !tracking.due_at) return; // nothing outstanding

  const now = Date.now();
  const dueAt = new Date(tracking.due_at).getTime();
  const chamaId = account.owner_id;

  // ------------------------------------------------------------------
  // 1. DUE SOON - one-time nudge before the deadline
  // ------------------------------------------------------------------
  if (!tracking.is_overdue && dueAt - now <= DUE_SOON_WINDOW_MS && dueAt - now > 0 && !tracking.last_reminder_sent_at) {
    await notifyOfficials({
      chamaId,
      account,
      notificationType: "CASH_DEPOSIT_DUE_SOON",
      title: "Cash deposit due soon",
      message: `${formatKsh(account.current_balance)} in cash-in-hand must be deposited into the bank by ${new Date(tracking.due_at).toLocaleString()}.`,
      actionDeadline: tracking.due_at
    });

    account.cash_deposit_tracking.last_reminder_sent_at = new Date();
    account.cash_deposit_tracking.reminder_count = (tracking.reminder_count || 0) + 1;
    await account.save();
    return;
  }

  // ------------------------------------------------------------------
  // 2. JUST WENT OVERDUE - flag, lock, notify + broadcast
  // ------------------------------------------------------------------
  if (!tracking.is_overdue && dueAt <= now) {
    account.cash_deposit_tracking.is_overdue = true;
    account.cash_deposit_tracking.overdue_since = new Date();
    account.cash_deposit_tracking.inflow_locked = true;
    account.cash_deposit_tracking.last_reminder_sent_at = new Date();
    account.cash_deposit_tracking.reminder_count = (tracking.reminder_count || 0) + 1;
    account.cash_deposit_tracking.last_broadcast_sent_at = new Date();
    await account.save();

    await notifyOfficials({
      chamaId,
      account,
      notificationType: "CASH_DEPOSIT_OVERDUE",
      title: "Cash deposit overdue - action required",
      message: `${formatKsh(account.current_balance)} in cash-in-hand is overdue for deposit into the bank. New cash payments are on hold until it's deposited.`,
      actionDeadline: null
    });

    await broadcastToAllMembers({ chamaId, account });

    await createAuditLog({
      isSystemGenerated: true,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId,
      action: AUDIT_ACTIONS.CASH_DEPOSIT_OVERDUE_FLAGGED,
      resourceType: "FinancialAccount",
      resourceId: account._id,
      after: {
        cash_balance: account.current_balance?.toString?.() || String(account.current_balance),
        held_since: tracking.held_since,
        due_at: tracking.due_at
      }
    }).catch(() => null);

    await createAuditLog({
      isSystemGenerated: true,
      scopeType: AUDIT_SCOPE_TYPES.CHAMA,
      chamaId,
      action: AUDIT_ACTIONS.CASH_INFLOW_LOCKED,
      resourceType: "FinancialAccount",
      resourceId: account._id,
      after: { reason: "Cash-in-hand deposit deadline passed" }
    }).catch(() => null);

    console.warn(`[cash-deposit-enforcement] Chama ${chamaId}: cash deposit overdue, inflow locked.`);
    return;
  }

  // ------------------------------------------------------------------
  // 3. STILL OVERDUE - periodic re-nudge + re-broadcast
  // ------------------------------------------------------------------
  if (tracking.is_overdue) {
    const lastReminder = tracking.last_reminder_sent_at ? new Date(tracking.last_reminder_sent_at).getTime() : 0;
    const lastBroadcast = tracking.last_broadcast_sent_at ? new Date(tracking.last_broadcast_sent_at).getTime() : 0;

    let dirty = false;

    if (now - lastReminder >= REMINDER_COOLDOWN_MS) {
      await notifyOfficials({
        chamaId,
        account,
        notificationType: "CASH_DEPOSIT_OVERDUE",
        title: "Cash deposit still overdue",
        message: `${formatKsh(account.current_balance)} in cash-in-hand is still un-banked. Deposit it now to resume accepting cash payments.`,
        actionDeadline: null
      });
      account.cash_deposit_tracking.last_reminder_sent_at = new Date();
      account.cash_deposit_tracking.reminder_count = (tracking.reminder_count || 0) + 1;
      dirty = true;
    }

    if (now - lastBroadcast >= BROADCAST_COOLDOWN_MS) {
      await broadcastToAllMembers({ chamaId, account });
      account.cash_deposit_tracking.last_broadcast_sent_at = new Date();
      dirty = true;
    }

    if (dirty) await account.save();
  }
}

export const sweepCashDepositCompliance = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const candidates = await FinancialAccount.find({
      owner_type: "Chama",
      account_code: "CASH",
      "cash_deposit_tracking.held_since": { $ne: null }
    }).limit(BATCH_SIZE);

    for (const account of candidates) {
      try {
        await handleAccount(account);
      } catch (error) {
        console.error(`[cash-deposit-enforcement] Failed for account ${account._id}:`, error.message);
      }
    }
  } catch (error) {
    console.error("[cash-deposit-enforcement] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startCashDepositEnforcementJob = () => {
  console.log(`[cash-deposit-enforcement] Cash deposit enforcement job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(sweepCashDepositCompliance, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
