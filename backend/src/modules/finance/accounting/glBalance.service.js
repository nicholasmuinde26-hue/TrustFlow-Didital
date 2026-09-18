/**
 * ============================================================
 * GENERAL LEDGER BALANCE CHECK (read-only)
 * ============================================================
 *
 * The whole point of double-entry is TOTAL DEBITS === TOTAL CREDITS
 * for every owner, always (see LedgerEntry.js). In a healthy system
 * this should never drift — but bugs, partial writes, or a bypassed
 * posting path can break it silently. This module only ever reads
 * LedgerEntry; it does not post, correct, or touch any ledger data,
 * so it can't make an imbalance worse.
 *
 * "balanced" tolerates a tiny epsilon (1 cent) to absorb floating
 * point noise from $toDouble on Decimal128 — not to hide a real
 * imbalance.
 * ============================================================
 */

import mongoose from "mongoose";
import LedgerEntry from "../../../models/LedgerEntry.js";

const EPSILON = 0.01;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Check whether one owner's (Chama / ContributionGroup / Business) posted
 * ledger entries balance.
 */
export async function checkGlBalance(ownerType, ownerId) {
  const rows = await LedgerEntry.aggregate([
    {
      $match: {
        owner_type: ownerType,
        owner_id: new mongoose.Types.ObjectId(ownerId),
        status: "posted",
      },
    },
    {
      $group: {
        _id: "$entry_type",
        total: { $sum: { $toDouble: "$amount" } },
      },
    },
  ]);

  const totals = { debit: 0, credit: 0 };
  for (const row of rows) totals[row._id] = row.total;

  const totalDebits = round2(totals.debit);
  const totalCredits = round2(totals.credit);
  const difference = round2(totalDebits - totalCredits);

  return {
    ownerType,
    ownerId: String(ownerId),
    totalDebits,
    totalCredits,
    difference,
    balanced: Math.abs(difference) < EPSILON,
    checkedAt: new Date().toISOString(),
  };
}

/**
 * Scan every owner of a given type and return only the ones whose ledger
 * doesn't balance. Used by the executive overview / risk-alert scan —
 * intentionally not run on every request, since it's an O(all owners)
 * aggregation.
 */
export async function findUnbalancedOwners(ownerType, { limit = 500 } = {}) {
  const rows = await LedgerEntry.aggregate([
    { $match: { owner_type: ownerType, status: "posted" } },
    {
      $group: {
        _id: { owner_id: "$owner_id", entry_type: "$entry_type" },
        total: { $sum: { $toDouble: "$amount" } },
      },
    },
    {
      $group: {
        _id: "$_id.owner_id",
        totals: { $push: { type: "$_id.entry_type", total: "$total" } },
      },
    },
    { $limit: limit },
  ]);

  const unbalanced = [];
  for (const row of rows) {
    const debit = round2(row.totals.find((t) => t.type === "debit")?.total || 0);
    const credit = round2(row.totals.find((t) => t.type === "credit")?.total || 0);
    const difference = round2(debit - credit);
    if (Math.abs(difference) >= EPSILON) {
      unbalanced.push({
        ownerType,
        ownerId: String(row._id),
        totalDebits: debit,
        totalCredits: credit,
        difference,
      });
    }
  }
  return unbalanced;
}

export default { checkGlBalance, findUnbalancedOwners };