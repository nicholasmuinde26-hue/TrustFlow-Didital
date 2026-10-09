import AssetComplianceObligation, {
  COMPLIANCE_OBLIGATION_TYPES,
} from "../../models/AssetComplianceObligation.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import AppError from "../../utils/AppError.js";
import { getIO } from "../realtime/socketServer.js";
import { recordExpense } from "./chamaAsset.service.js";

const emitToChama = (chamaId, event, payload) => {
  try {
    getIO().to(`chama:${chamaId}`).emit(event, payload);
  } catch (error) {
    console.warn(`[assetCompliance.service] Failed to emit ${event}:`, error.message);
  }
};

async function requireAsset(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  return asset;
}

async function requireObligation(chamaId, obligationId) {
  const obligation = await AssetComplianceObligation.findOne({ _id: obligationId, chama_id: chamaId });
  if (!obligation) throw new AppError("Compliance obligation not found", 404);
  return obligation;
}

function findCycle(obligation, cycleId) {
  const cycle = obligation.cycles.id(cycleId);
  if (!cycle) throw new AppError("Compliance cycle not found", 404);
  return cycle;
}

// A cycle's status is derived from what's been paid vs waived — same
// "never hand-set" philosophy as AssetLease.periods.
function recomputeCycleStatus(cycle) {
  if (cycle.status === "waived") return;
  const expected = Number(cycle.amount_expected || 0);
  const paid = Number(cycle.paid_amount || 0);
  if (paid > 0 && (expected <= 0 || paid >= expected)) {
    cycle.status = "paid";
  } else if (cycle.due_date && new Date(cycle.due_date) < new Date()) {
    cycle.status = "overdue";
  } else {
    cycle.status = "pending";
  }
}

// ============================================================
// CREATE — the standing obligation (land rates for this asset, this
// jurisdiction). First cycle is created alongside it since an
// obligation with no due date to track is pointless.
// ============================================================
export async function createComplianceObligation(chamaId, assetId, userId, payload) {
  const asset = await requireAsset(chamaId, assetId);

  const obligationType = payload.obligationType;
  if (!COMPLIANCE_OBLIGATION_TYPES.includes(obligationType)) {
    throw new AppError(`obligationType must be one of: ${COMPLIANCE_OBLIGATION_TYPES.join(", ")}`, 400);
  }
  const jurisdiction = String(payload.jurisdiction || "").trim();
  if (!jurisdiction) throw new AppError("jurisdiction is required", 400);

  const dueDate = new Date(payload.dueDate);
  if (!Number.isFinite(dueDate.getTime())) throw new AppError("A valid dueDate is required for the first cycle", 400);

  const obligation = await AssetComplianceObligation.create({
    chama_id: chamaId,
    asset_id: asset._id,
    obligation_type: obligationType,
    jurisdiction,
    authority_name: payload.authorityName || "",
    description: payload.description || "",
    cycles: [
      {
        label: payload.cycleLabel || `${jurisdiction} — ${obligationType.replace(/_/g, " ")}`,
        due_date: dueDate,
        amount_expected: payload.amountExpected != null ? Number(payload.amountExpected) : null,
      },
    ],
    created_by: userId,
  });

  emitToChama(chamaId, "chama_asset:compliance_obligation_created", { assetId: asset._id, obligationId: obligation._id });
  return obligation;
}

export async function listComplianceObligations(chamaId, assetId, { active } = {}) {
  const query = { chama_id: chamaId };
  if (assetId) query.asset_id = assetId;
  if (active !== undefined) query.active = active;
  const obligations = await AssetComplianceObligation.find(query).sort({ createdAt: -1 });

  const now = new Date();
  let dirty = false;
  for (const obligation of obligations) {
    for (const cycle of obligation.cycles) {
      const before = cycle.status;
      recomputeCycleStatus(cycle);
      if (cycle.status !== before) dirty = true;
    }
    if (dirty) await obligation.save();
    dirty = false;
  }
  return obligations;
}

export async function getComplianceObligation(chamaId, obligationId) {
  return requireObligation(chamaId, obligationId);
}

export async function setComplianceObligationActive(chamaId, obligationId, active) {
  const obligation = await requireObligation(chamaId, obligationId);
  obligation.active = Boolean(active);
  await obligation.save();
  return obligation;
}

// ============================================================
// ADD CYCLE — the next year's/period's due date, added once leadership
// knows it (typically after paying the previous cycle, or at the start
// of a new fiscal year) — not auto-generated, for the same "don't guess
// a statutory deadline" reason the due_date itself isn't derived.
// ============================================================
export async function addComplianceCycle(chamaId, obligationId, payload) {
  const obligation = await requireObligation(chamaId, obligationId);

  const dueDate = new Date(payload.dueDate);
  if (!Number.isFinite(dueDate.getTime())) throw new AppError("A valid dueDate is required", 400);

  obligation.cycles.push({
    label: payload.label || `${obligation.jurisdiction} — ${obligation.obligation_type.replace(/_/g, " ")}`,
    due_date: dueDate,
    amount_expected: payload.amountExpected != null ? Number(payload.amountExpected) : null,
  });
  await obligation.save();

  emitToChama(chamaId, "chama_asset:compliance_cycle_added", { obligationId: obligation._id, assetId: obligation.asset_id });
  return obligation;
}

// ============================================================
// RECORD PAYMENT — posts a real expense through the exact same
// accounting path as any other asset expense, then links the cycle to
// it. Category defaults to land_rates_taxes/licenses_permits by
// obligation type but can be overridden.
// ============================================================
export async function recordComplianceCyclePayment(chamaId, obligationId, cycleId, { amount, collectionMethod, description, recordedBy, category } = {}) {
  const obligation = await requireObligation(chamaId, obligationId);
  const cycle = findCycle(obligation, cycleId);
  if (cycle.status === "waived") throw new AppError("This cycle has been waived; nothing to pay", 409);

  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("A positive amount is required", 400);

  const inferredCategory = category
    || (obligation.obligation_type === "land_rates" ? "land_rates_taxes" : "licenses_permits");

  const posting = await recordExpense(chamaId, obligation.asset_id, {
    amount: value,
    collectionMethod,
    description: description || `${cycle.label} — ${obligation.jurisdiction}`,
    recordedBy,
    category: inferredCategory,
  });

  cycle.paid_amount = Number(cycle.paid_amount || 0) + value;
  cycle.paid_at = new Date();
  cycle.asset_transaction_id = posting?.transactionId || cycle.asset_transaction_id;
  recomputeCycleStatus(cycle);
  await obligation.save();

  emitToChama(chamaId, "chama_asset:compliance_cycle_paid", { obligationId: obligation._id, assetId: obligation.asset_id, cycleId: cycle._id });
  return { obligation, posting };
}

export async function waiveComplianceCycle(chamaId, obligationId, cycleId, { reason, waivedBy } = {}) {
  const obligation = await requireObligation(chamaId, obligationId);
  const cycle = findCycle(obligation, cycleId);
  cycle.status = "waived";
  cycle.waived_reason = reason || "";
  await obligation.save();

  emitToChama(chamaId, "chama_asset:compliance_cycle_waived", { obligationId: obligation._id, assetId: obligation.asset_id, cycleId: cycle._id, waivedBy });
  return obligation;
}
