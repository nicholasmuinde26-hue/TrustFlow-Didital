/**
 * ============================================================================
 * BANK RECONCILIATION SERVICE
 * ============================================================================
 * See models/BankReconciliation.js for the shape and the inflow/outflow
 * convention. This service never touches account balances - it only
 * compares the statement's lines against LedgerEntry rows already posted
 * against the bank's FinancialAccount, and records the match.
 * ============================================================================
 */

import mongoose from "mongoose";
import BankReconciliation from "../../models/BankReconciliation.js";
import ChamaBankAccount from "../../models/ChamaBankAccount.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import AppError from "../../utils/AppError.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../constants/audit.constants.js";
import { requestAdjustment } from "./adjustment.service.js";

const toNum = (v) => Number(v?.toString ? v.toString() : v);
// inflow (money landing in the bank per the statement) is a DEBIT to our
// BANK asset account; outflow is a CREDIT. See the note on `direction` in
// the model - this is the one place that mapping happens.
const entryTypeForDirection = (direction) => (direction === "inflow" ? "debit" : "credit");

async function getSession(ownerType, ownerId, sessionId) {
  const session = await BankReconciliation.findOne({ _id: sessionId, owner_type: ownerType, owner_id: ownerId });
  if (!session) throw new AppError("Reconciliation session not found", 404);
  return session;
}

function getLine(session, lineId) {
  const line = session.lines.id(lineId);
  if (!line) throw new AppError("Statement line not found", 404);
  return line;
}

export async function createSession({ ownerType, ownerId, userId, bankAccountId, periodStart, periodEnd, openingBalance, closingBalance, notes = "" }) {
  if (ownerType !== "Chama") {
    throw new AppError("Bank reconciliation is only supported for Chama workspaces", 400);
  }

  const bankAccount = await ChamaBankAccount.findOne({ _id: bankAccountId, owner_type: ownerType, owner_id: ownerId });
  if (!bankAccount) throw new AppError("Bank account not found", 404);
  if (!bankAccount.financial_account_id) {
    throw new AppError("This bank account has no linked ledger account yet - re-save it to link one", 400);
  }

  const session = await BankReconciliation.create({
    owner_type: ownerType,
    owner_id: ownerId,
    bank_account_id: bankAccount._id,
    financial_account_id: bankAccount.financial_account_id,
    period_start: periodStart,
    period_end: periodEnd,
    opening_balance: Number(openingBalance).toFixed(2),
    closing_balance: Number(closingBalance).toFixed(2),
    notes,
    created_by: userId,
    lines: []
  });

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action: AUDIT_ACTIONS.BANK_RECONCILIATION_STARTED,
    resourceType: "BankReconciliation",
    resourceId: session._id,
    after: { bank_account: bankAccount.bank_name, period_start: periodStart, period_end: periodEnd }
  }).catch(() => null);

  return session;
}

/**
 * Add statement lines to an in-progress session. Accepts a plain array of
 * {date, description, amount, direction, external_ref} - the frontend is
 * responsible for turning a CSV export into this shape (or the treasurer
 * enters them by hand); this stays file-format agnostic on purpose.
 */
export async function addLines({ ownerType, ownerId, sessionId, lines = [] }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") {
    throw new AppError("Cannot add lines to a completed session", 400);
  }
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError("At least one statement line is required", 400);
  }

  for (const line of lines) {
    const amount = Number(line.amount);
    if (!amount || amount <= 0) {
      throw new AppError(`Invalid amount for line "${line.description || ""}"`, 400);
    }
    if (!["inflow", "outflow"].includes(line.direction)) {
      throw new AppError(`Line "${line.description || ""}" must have direction 'inflow' or 'outflow'`, 400);
    }
    if (!line.date) {
      throw new AppError(`Line "${line.description || ""}" is missing a date`, 400);
    }

    session.lines.push({
      date: new Date(line.date),
      description: line.description || "",
      amount: amount.toFixed(2),
      direction: line.direction,
      external_ref: line.external_ref || ""
    });
  }

  await session.save();
  return session;
}

/**
 * Try to auto-match every unmatched line against posted ledger entries on
 * this session's bank account. Only matches when exactly one un-consumed
 * candidate shares the same amount + implied entry type within the
 * period window (+/- 5 days, to absorb clearing lag) - anything ambiguous
 * is left for a human to match by hand.
 */
export async function autoMatch({ ownerType, ownerId, sessionId }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") {
    throw new AppError("Session is already completed", 400);
  }

  const windowStart = new Date(session.period_start);
  windowStart.setDate(windowStart.getDate() - 5);
  const windowEnd = new Date(session.period_end);
  windowEnd.setDate(windowEnd.getDate() + 5);

  const candidateEntries = await LedgerEntry.find({
    owner_type: ownerType,
    owner_id: ownerId,
    account_id: session.financial_account_id,
    status: "posted",
    posted_at: { $gte: windowStart, $lte: windowEnd }
  }).lean();

  const alreadyUsed = new Set(
    session.lines.filter((l) => l.matched_ledger_entry_id).map((l) => String(l.matched_ledger_entry_id))
  );

  let matchedCount = 0;

  for (const line of session.lines) {
    if (line.status !== "unmatched") continue;

    const wantEntryType = entryTypeForDirection(line.direction);
    const wantAmount = toNum(line.amount);

    const candidates = candidateEntries.filter(
      (e) => !alreadyUsed.has(String(e._id)) && e.entry_type === wantEntryType && toNum(e.amount) === wantAmount
    );

    if (candidates.length === 1) {
      const entry = candidates[0];
      line.status = "matched";
      line.matched_ledger_entry_id = entry._id;
      line.matched_transaction_id = entry.transaction_id;
      line.match_type = "auto";
      line.matched_at = new Date();
      alreadyUsed.add(String(entry._id));
      matchedCount++;
    }
  }

  await session.save();
  return { session, matchedCount };
}

export async function matchLine({ ownerType, ownerId, sessionId, lineId, ledgerEntryId, matchedByMembershipId, userId }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") throw new AppError("Session is already completed", 400);
  const line = getLine(session, lineId);

  const entry = await LedgerEntry.findOne({ _id: ledgerEntryId, owner_type: ownerType, owner_id: ownerId, account_id: session.financial_account_id });
  if (!entry) throw new AppError("Ledger entry not found on this bank account", 404);

  const wantEntryType = entryTypeForDirection(line.direction);
  if (entry.entry_type !== wantEntryType) {
    throw new AppError(`This ledger entry is a ${entry.entry_type}, but the statement line is an ${line.direction}`, 400);
  }
  if (toNum(entry.amount) !== toNum(line.amount)) {
    throw new AppError("The ledger entry amount does not match the statement line amount", 400);
  }

  const alreadyUsed = session.lines.some(
    (l) => String(l._id) !== String(line._id) && l.matched_ledger_entry_id && String(l.matched_ledger_entry_id) === String(entry._id)
  );
  if (alreadyUsed) throw new AppError("This ledger entry is already matched to another line", 400);

  line.status = "matched";
  line.matched_ledger_entry_id = entry._id;
  line.matched_transaction_id = entry.transaction_id;
  line.match_type = "manual";
  line.matched_at = new Date();
  line.matched_by = matchedByMembershipId;

  await session.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action: AUDIT_ACTIONS.BANK_RECONCILIATION_LINE_MATCHED,
    resourceType: "BankReconciliation",
    resourceId: session._id,
    metadata: { line_id: String(line._id) }
  }).catch(() => null);

  return session;
}

export async function unmatchLine({ ownerType, ownerId, sessionId, lineId }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") throw new AppError("Session is already completed", 400);
  const line = getLine(session, lineId);

  line.status = "unmatched";
  line.matched_ledger_entry_id = null;
  line.matched_transaction_id = null;
  line.match_type = null;
  line.matched_at = null;
  line.matched_by = null;

  await session.save();
  return session;
}

export async function ignoreLine({ ownerType, ownerId, sessionId, lineId, reason = "" }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") throw new AppError("Session is already completed", 400);
  const line = getLine(session, lineId);

  line.status = "ignored";
  line.ignored_reason = reason;

  await session.save();
  return session;
}

/**
 * For a genuinely bank-only line (a fee, interest, or other item that will
 * never appear as a ledger entry until it's booked) - raise a
 * LedgerAdjustment through the normal approval workflow instead of forcing
 * a fake match. The line is marked resolved once the adjustment exists;
 * whether it's actually posted yet is tracked on the adjustment itself.
 */
export async function raiseAdjustmentForLine({ ownerType, ownerId, sessionId, lineId, contraAccountId, reason, userId, membershipId }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") throw new AppError("Session is already completed", 400);
  const line = getLine(session, lineId);
  if (line.status !== "unmatched") throw new AppError("Only unmatched lines can have an adjustment raised", 400);

  const isInflow = line.direction === "inflow";
  const { adjustment } = await requestAdjustment({
    ownerType,
    ownerId,
    userId,
    membershipId,
    // Money landing in the bank: DR Bank / CR <contra>. Money leaving the
    // bank: DR <contra> / CR Bank.
    debitAccountId: isInflow ? session.financial_account_id : contraAccountId,
    creditAccountId: isInflow ? contraAccountId : session.financial_account_id,
    amount: toNum(line.amount),
    currency: "KES",
    reason: reason || `Bank statement item not in the books: ${line.description}`,
    reference: line.external_ref,
    source: "bank_reconciliation",
    sourceReconciliationId: session._id,
    sourceReconciliationLineId: line._id
  });

  line.status = "matched";
  line.match_type = "adjustment";
  line.adjustment_id = adjustment._id;
  line.matched_at = new Date();
  line.matched_by = membershipId;

  await session.save();
  return { session, adjustment };
}

export async function completeSession({ ownerType, ownerId, sessionId, membershipId, userId, force = false }) {
  const session = await getSession(ownerType, ownerId, sessionId);
  if (session.status !== "in_progress") throw new AppError("Session is already completed", 400);

  const unmatched = session.lines.filter((l) => l.status === "unmatched");
  if (unmatched.length > 0 && !force) {
    throw new AppError(`${unmatched.length} statement line(s) are still unmatched - match, ignore, or raise an adjustment for each, or pass force to close anyway`, 400);
  }

  session.status = "completed";
  session.completed_by = membershipId;
  session.completed_at = new Date();
  await session.save();

  await createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action: AUDIT_ACTIONS.BANK_RECONCILIATION_COMPLETED,
    resourceType: "BankReconciliation",
    resourceId: session._id,
    after: { unmatched_left: unmatched.length }
  }).catch(() => null);

  return session;
}

export function summarizeSession(session) {
  const lines = session.lines || [];
  const inflow = lines.filter((l) => l.direction === "inflow").reduce((s, l) => s + toNum(l.amount), 0);
  const outflow = lines.filter((l) => l.direction === "outflow").reduce((s, l) => s + toNum(l.amount), 0);
  const matched = lines.filter((l) => l.status === "matched").length;
  const unmatched = lines.filter((l) => l.status === "unmatched").length;
  const ignored = lines.filter((l) => l.status === "ignored").length;

  const expectedClosing = toNum(session.opening_balance) + inflow - outflow;
  const variance = toNum(session.closing_balance) - expectedClosing;

  return {
    total_lines: lines.length,
    matched,
    unmatched,
    ignored,
    total_inflow: inflow,
    total_outflow: outflow,
    // Opening + statement inflows - outflows, compared to the closing
    // balance the treasurer entered - a non-zero variance usually means a
    // line is missing or mis-keyed, not a ledger problem.
    expected_closing_balance: Number(expectedClosing.toFixed(2)),
    variance: Number(variance.toFixed(2))
  };
}

export async function listSessions(ownerType, ownerId, { status = null, bankAccountId = null } = {}) {
  const query = { owner_type: ownerType, owner_id: ownerId };
  if (status) query.status = status;
  if (bankAccountId) query.bank_account_id = bankAccountId;
  return BankReconciliation.find(query).select("-lines").populate("bank_account_id", "bank_name account_name").sort({ createdAt: -1 });
}

export async function getSessionDetail(ownerType, ownerId, sessionId) {
  const session = await getSession(ownerType, ownerId, sessionId);
  return { session, summary: summarizeSession(session) };
}