import mongoose from "mongoose";
import AssetLease from "../../models/AssetLease.js";
import AssetTransaction from "../../models/AssetTransaction.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import AppError from "../../utils/AppError.js";
import { getIO } from "../realtime/socketServer.js";
import { recordIncome } from "./chamaAsset.service.js";

const emitToChama = (chamaId, event, payload) => {
  try {
    getIO().to(`chama:${chamaId}`).emit(event, payload);
  } catch (error) {
    console.warn(`[assetLease.service] Failed to emit ${event}:`, error.message);
  }
};

async function requireActiveAsset(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active chama asset not found", 404);
  return asset;
}

async function requireLease(chamaId, leaseId) {
  const lease = await AssetLease.findOne({ _id: leaseId, chama_id: chamaId });
  if (!lease) throw new AppError("Lease not found", 404);
  return lease;
}

function findPeriod(lease, periodId) {
  const period = lease.periods.id(periodId);
  if (!period) throw new AppError("Lease period not found", 404);
  return period;
}

// A period's status is derived entirely from what's expected vs what's
// actually been logged against it — never hand-set, so it can never
// drift from the receipts underneath it.
export function recomputePeriodStatus(period) {
  const cashExpected = Number(period.expected_cash_amount || 0);
  const inKindExpected = Number(period.expected_in_kind?.quantity || 0);
  const cashReceived = Number(period.received_cash_amount || 0);
  const inKindReceived = Number(period.received_in_kind_quantity || 0);

  if (period.status === "waived") return; // manual override, never auto-recomputed

  const cashSatisfied = cashExpected <= 0 || cashReceived >= cashExpected;
  const inKindSatisfied = inKindExpected <= 0 || inKindReceived >= inKindExpected;
  const somethingExpected = cashExpected > 0 || inKindExpected > 0;
  const somethingReceived = cashReceived > 0 || inKindReceived > 0;

  if (!somethingExpected) {
    period.status = somethingReceived ? "fulfilled" : "pending";
    return;
  }
  if (cashSatisfied && inKindSatisfied) {
    period.status = "fulfilled";
  } else if (somethingReceived) {
    period.status = "partially_received";
  } else if (period.due_date && new Date(period.due_date) < new Date()) {
    period.status = "overdue";
  } else {
    period.status = "pending";
  }
}

// ============================================================
// CREATE — the standing agreement. One lease per lessee/asset
// relationship; seasons/months are added to it afterward via
// addLeasePeriod as they come up, not all up front.
// ============================================================
export async function createLease(chamaId, assetId, userId, payload) {
  const asset = await requireActiveAsset(chamaId, assetId);

  const lesseeType = payload.lesseeType === "member" ? "member" : "external";
  if (lesseeType === "member" && !payload.memberId) {
    throw new AppError("memberId is required when the lessee is an existing member", 400);
  }
  if (lesseeType === "external" && !String(payload.externalName || "").trim()) {
    throw new AppError("externalName is required for a lessee with no account", 400);
  }

  const arrangementType = payload.arrangementType;
  if (!["cash", "in_kind", "hybrid"].includes(arrangementType)) {
    throw new AppError("arrangementType must be cash, in_kind, or hybrid", 400);
  }

  const startDate = new Date(payload.startDate);
  if (!Number.isFinite(startDate.getTime())) throw new AppError("A valid startDate is required", 400);

  const lease = await AssetLease.create({
    chama_id: chamaId,
    asset_id: asset._id,
    lessee: {
      lessee_type: lesseeType,
      member_id: lesseeType === "member" ? payload.memberId : null,
      external_name: lesseeType === "external" ? String(payload.externalName).trim() : "",
      external_contact: lesseeType === "external" ? String(payload.externalContact || "").trim() : "",
    },
    arrangement_type: arrangementType,
    cash_terms: {
      amount: Number(payload.cashAmount || 0),
      frequency: payload.cashFrequency || "monthly",
    },
    in_kind_terms: {
      description: payload.inKindDescription || "",
      expected_unit: payload.inKindUnit || "",
    },
    start_date: startDate,
    end_date: payload.endDate ? new Date(payload.endDate) : null,
    notes: payload.notes || "",
    created_by: userId,
  });

  emitToChama(chamaId, "chama_asset:lease_created", { assetId: asset._id, leaseId: lease._id });
  return lease;
}

export async function listLeases(chamaId, assetId, { status } = {}) {
  const query = { chama_id: chamaId };
  if (assetId) query.asset_id = assetId;
  if (status) query.status = status;
  return AssetLease.find(query).sort({ createdAt: -1 });
}

export async function getLease(chamaId, leaseId) {
  return requireLease(chamaId, leaseId);
}

export async function endLease(chamaId, leaseId, { reason, terminated = false }) {
  const lease = await requireLease(chamaId, leaseId);
  lease.status = terminated ? "terminated" : "ended";
  lease.ended_reason = reason || "";
  await lease.save();
  emitToChama(chamaId, "chama_asset:lease_updated", { assetId: lease.asset_id, leaseId: lease._id, status: lease.status });
  return lease;
}

// ============================================================
// ADD PERIOD — one rent month or one farming season. What's
// "expected" for THIS period, independent of the lease's general
// terms, so a season that was renegotiated (bigger plot, smaller
// share) doesn't require touching history.
// ============================================================
export async function addLeasePeriod(chamaId, leaseId, payload) {
  const lease = await requireLease(chamaId, leaseId);
  if (lease.status !== "active") throw new AppError("Cannot add a period to a lease that is not active", 400);

  const periodStart = new Date(payload.periodStart);
  const periodEnd = new Date(payload.periodEnd);
  if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd < periodStart) {
    throw new AppError("A valid periodStart and periodEnd (end on or after start) are required", 400);
  }
  if (!String(payload.label || "").trim()) throw new AppError("A label is required (e.g. 'October 2026' or '2026 Long Rains')", 400);

  const expectedCash = Number(payload.expectedCashAmount || 0);
  const expectedInKindQuantity = payload.expectedInKindQuantity != null ? Number(payload.expectedInKindQuantity) : null;
  if (lease.arrangement_type === "cash" && expectedCash <= 0) {
    throw new AppError("expectedCashAmount must be greater than zero for a cash lease", 400);
  }
  if (lease.arrangement_type === "in_kind" && !(expectedInKindQuantity > 0)) {
    throw new AppError("expectedInKindQuantity must be greater than zero for an in-kind lease", 400);
  }
  if (lease.arrangement_type === "hybrid" && expectedCash <= 0 && !(expectedInKindQuantity > 0)) {
    throw new AppError("Provide an expected cash amount, an expected in-kind quantity, or both for a hybrid lease", 400);
  }

  lease.periods.push({
    label: String(payload.label).trim(),
    period_start: periodStart,
    period_end: periodEnd,
    due_date: payload.dueDate ? new Date(payload.dueDate) : periodEnd,
    expected_cash_amount: expectedCash,
    expected_in_kind: {
      quantity: expectedInKindQuantity,
      unit: payload.expectedInKindUnit || lease.in_kind_terms?.expected_unit || "",
      description: payload.expectedInKindDescription || lease.in_kind_terms?.description || "",
    },
  });
  const period = lease.periods[lease.periods.length - 1];
  recomputePeriodStatus(period);
  await lease.save();

  emitToChama(chamaId, "chama_asset:lease_updated", { assetId: lease.asset_id, leaseId: lease._id, periodAdded: period._id });
  return lease;
}

// ============================================================
// CASH RECEIPT — routed through the SAME accounting posting +
// M-Pesa reconciliation as any other asset income (recordIncome),
// tagged with leaseId/leasePeriodId so it counts toward this
// period's expected-vs-received figure. Never double-books: the
// received_cash_amount cache is recomputed from AssetTransaction,
// not incremented by hand, so a re-run or a race can't overcount.
// ============================================================
export async function recordLeaseCashReceipt(chamaId, leaseId, periodId, { amount, collectionMethod, mpesaReceiptNumber, description, recordedBy }) {
  const lease = await requireLease(chamaId, leaseId);
  const period = findPeriod(lease, periodId);
  if (lease.status !== "active") throw new AppError("This lease is no longer active", 400);

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("A positive amount is required", 400);

  const asset = await ChamaAsset.findOne({ _id: lease.asset_id, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);

  const result = await recordIncome(chamaId, lease.asset_id, {
    amount: value,
    collectionMethod: collectionMethod || "mpesa",
    description: description || `Lease payment — ${asset.name} (${period.label})`,
    recordedBy,
    mpesaReceiptNumber: mpesaReceiptNumber || null,
    leaseId: lease._id,
    leasePeriodId: period._id,
  });

  const total = await AssetTransaction.aggregate([
    { $match: { chama_id: new mongoose.Types.ObjectId(chamaId), lease_id: lease._id, lease_period_id: period._id, type: "income", reconciliation_status: { $ne: "unverified" } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  period.received_cash_amount = total[0]?.total || 0;
  recomputePeriodStatus(period);
  await lease.save();

  emitToChama(chamaId, "chama_asset:lease_updated", { assetId: lease.asset_id, leaseId: lease._id, periodId: period._id, receivedCash: period.received_cash_amount });
  return { lease, period, posting: result };
}

// ============================================================
// IN-KIND RECEIPT — a share of harvest handed over. No ledger
// posting (there's nothing to reconcile against Safaricom), just a
// quantity logged against this period, with an optional estimate of
// value for reporting. If the chama later sells the produce for
// cash, THAT is recorded as ordinary asset income separately.
// ============================================================
export async function recordLeaseInKindReceipt(chamaId, leaseId, periodId, { quantity, unit, estimatedValue, valuationNote, description, recordedBy }) {
  const lease = await requireLease(chamaId, leaseId);
  const period = findPeriod(lease, periodId);
  if (lease.status !== "active") throw new AppError("This lease is no longer active", 400);

  const value = Number(quantity);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("A positive quantity is required", 400);
  const unitLabel = String(unit || period.expected_in_kind?.unit || "").trim();
  if (!unitLabel) throw new AppError("A unit is required (e.g. '90kg bags')", 400);

  period.in_kind_receipts.push({
    quantity: value,
    unit: unitLabel,
    estimated_value: estimatedValue != null && estimatedValue !== "" ? Number(estimatedValue) : null,
    valuation_note: valuationNote || "",
    description: description || "",
    recorded_by: recordedBy || null,
  });
  period.received_in_kind_quantity = period.in_kind_receipts.reduce((sum, r) => sum + Number(r.quantity || 0), 0);
  recomputePeriodStatus(period);
  await lease.save();

  emitToChama(chamaId, "chama_asset:lease_updated", { assetId: lease.asset_id, leaseId: lease._id, periodId: period._id, receivedInKindQuantity: period.received_in_kind_quantity });
  return { lease, period };
}

export async function waiveLeasePeriod(chamaId, leaseId, periodId, { reason, waivedBy }) {
  const lease = await requireLease(chamaId, leaseId);
  const period = findPeriod(lease, periodId);
  period.status = "waived";
  period.notes = reason ? `${period.notes ? `${period.notes}\n` : ""}Waived: ${reason}` : period.notes;
  await lease.save();
  emitToChama(chamaId, "chama_asset:lease_updated", { assetId: lease.asset_id, leaseId: lease._id, periodId: period._id, status: "waived" });
  return { lease, period };
}

// ============================================================
// SEASON TRACKER — the "expected vs received" view per period,
// plus a lease-level rollup. This is the read the frontend renders
// as the tracker table; it never assumes a monthly cadence, since
// `periods` is whatever cadence this specific lease was given.
// ============================================================
export async function getLeaseSeasonTracker(chamaId, leaseId) {
  const lease = await requireLease(chamaId, leaseId);
  // Overdue periods aren't recomputed until touched — sweep them here so
  // a tracker read always reflects "is this actually overdue right now".
  let dirty = false;
  for (const period of lease.periods) {
    const before = period.status;
    recomputePeriodStatus(period);
    if (period.status !== before) dirty = true;
  }
  if (dirty) await lease.save();

  const periods = [...lease.periods].sort((a, b) => new Date(b.period_start) - new Date(a.period_start));
  const totals = periods.reduce(
    (acc, period) => {
      acc.expectedCash += Number(period.expected_cash_amount || 0);
      acc.receivedCash += Number(period.received_cash_amount || 0);
      acc.expectedInKindQuantity += Number(period.expected_in_kind?.quantity || 0);
      acc.receivedInKindQuantity += Number(period.received_in_kind_quantity || 0);
      acc.estimatedInKindValue += period.in_kind_receipts.reduce((s, r) => s + Number(r.estimated_value || 0), 0);
      return acc;
    },
    { expectedCash: 0, receivedCash: 0, expectedInKindQuantity: 0, receivedInKindQuantity: 0, estimatedInKindValue: 0 }
  );

  return { lease, periods, totals };
}
