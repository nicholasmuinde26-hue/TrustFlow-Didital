/**
 * ============================================================================
 * ASSET NUDGES JOB
 * ============================================================================
 *
 * "Fully manage" in practice: chamas lose money less to fraud than to
 * forgetting — a lease that quietly lapsed, land rates that went unpaid
 * and accrued penalties. This sweep is the automated-nudge layer over
 * everything already being tracked on ChamaAsset/AssetLease/
 * AssetComplianceObligation:
 *
 *  1. LEASE PERIODS DUE SOON — a rent month or farming season's due_date
 *     is approaching and nothing's been received yet -> one nudge, once.
 *  2. LEASE PERIODS OVERDUE — due_date has passed with nothing received
 *     (AssetLease.periods already computes this via recomputePeriodStatus
 *     -> status 'overdue') -> nudge, then keep re-nudging on a cooldown
 *     for as long as it stays overdue. Covers both a cash-rent unit AND
 *     land lent to a farmer for a harvest share — same mechanism, since
 *     both are just "periods" on the same lease model.
 *  3. LEASE RENEWAL DUE SOON — a fixed-term lease's end_date is
 *     approaching -> one nudge so leadership can renew or renegotiate
 *     before it lapses unnoticed.
 *  4. COMPLIANCE OBLIGATIONS (land rates / permits) DUE SOON / OVERDUE —
 *     same due-soon-once / overdue-on-cooldown shape as lease periods,
 *     pulled from AssetComplianceObligation.cycles, grouped by the
 *     asset's jurisdiction so the nudge names which authority is owed.
 *
 * Recipients: the chama's treasurer/chairperson (financial officials),
 * plus the asset's assigned manager when they're a member with an
 * account (an external caretaker has nowhere in-app to receive this —
 * that's still the officials' job to relay).
 *
 * All state this job reads/writes (reminder timestamps, counts) lives on
 * the documents themselves and is never touched anywhere else, so this
 * sweep is safe to run concurrently with normal reads/writes to the same
 * leases/obligations.
 * ============================================================================
 */

import AssetLease from "../models/AssetLease.js";
import AssetComplianceObligation from "../models/AssetComplianceObligation.js";
import ChamaAsset from "../models/ChamaAsset.js";
import ChamaMembership from "../models/ChamaMembership.js";
import Chama from "../models/Chama.js";
import { isModuleEnabled } from "../constants/workspaceModules.constants.js";
import notificationService from "../services/notification.service.js";
import { recomputePeriodStatus } from "../modules/chamaAssets/assetLease.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const LEASE_DUE_SOON_WINDOW_MS = Number(process.env.LEASE_DUE_SOON_WINDOW_MS) || 7 * DAY_MS; // nudge once a period is within 7 days of its due date
const LEASE_OVERDUE_COOLDOWN_MS = Number(process.env.LEASE_OVERDUE_COOLDOWN_MS) || 3 * DAY_MS; // re-nudge every 3 days while overdue
const LEASE_RENEWAL_WINDOW_MS = Number(process.env.LEASE_RENEWAL_WINDOW_MS) || 30 * DAY_MS; // nudge once a fixed-term lease is within 30 days of expiry
const COMPLIANCE_DUE_SOON_WINDOW_MS = Number(process.env.COMPLIANCE_DUE_SOON_WINDOW_MS) || 14 * DAY_MS; // nudge once a cycle is within 14 days of its due date
const COMPLIANCE_OVERDUE_COOLDOWN_MS = Number(process.env.COMPLIANCE_OVERDUE_COOLDOWN_MS) || 7 * DAY_MS; // re-nudge every 7 days while overdue

const SWEEP_INTERVAL_MS = Number(process.env.ASSET_NUDGES_SWEEP_INTERVAL_MS) || 60 * 60 * 1000; // hourly — reminders are day-granularity, not minute-critical
const BATCH_SIZE = Number(process.env.ASSET_NUDGES_BATCH_SIZE) || 200;

let sweepInProgress = false;

const formatKsh = (value) => `KSh ${Number(value || 0).toLocaleString()}`;
const formatDate = (date) => new Date(date).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" });

// ------------------------------------------------------------------------
// RECIPIENTS — every active treasurer/chairperson for the chama, plus the
// asset's assigned manager when they're a member (external caretakers
// have no in-app account to notify).
// ------------------------------------------------------------------------
async function getStakeholderMembershipIds(chamaId, asset) {
  const officials = await ChamaMembership.find({
    chama_id: chamaId,
    role: { $in: ["treasurer", "chairperson"] },
    status: "active",
  }).select("_id user_id");

  const ids = new Map(officials.map((m) => [String(m._id), m]));

  if (asset?.management?.manager_type === "member" && asset.management.manager_id) {
    const managerMembership = await ChamaMembership.findOne({
      chama_id: chamaId,
      user_id: asset.management.manager_id,
      status: "active",
    }).select("_id");
    if (managerMembership) ids.set(String(managerMembership._id), managerMembership);
  }

  return [...ids.keys()];
}

async function notifyStakeholders({ chamaId, asset, notificationType, title, message, relatedEntityType, relatedEntityId, actionDeadline, requiresAction = false }) {
  const recipientMembershipIds = await getStakeholderMembershipIds(chamaId, asset);
  if (recipientMembershipIds.length === 0) return;

  await notificationService.sendBulkNotification({
    chamaId,
    recipientMembershipIds,
    notificationType,
    title,
    message,
    metadata: { asset_id: String(asset._id), asset_name: asset.name },
    relatedEntityType,
    relatedEntityId,
    requiresAction,
    actionDeadline,
    eventSource: "assetNudgesJob",
  }).catch((err) => console.error("[asset-nudges] notifyStakeholders failed:", err.message));
}

// ------------------------------------------------------------------------
// 1 & 2. LEASE PERIODS — due-soon (once) and overdue (on cooldown)
// ------------------------------------------------------------------------
async function sweepLeasePeriods() {
  const now = Date.now();
  const leases = await AssetLease.find({
    status: "active",
    periods: { $elemMatch: { status: { $in: ["pending", "partially_received", "overdue"] } } },
  }).limit(BATCH_SIZE);

  for (const lease of leases) {
    let dirty = false;
    const chama = await Chama.findById(lease.chama_id).select('chama_type workspace_config').lean();
    if (!chama || !isModuleEnabled(chama, 'assets')) continue;

    const asset = await ChamaAsset.findOne({ _id: lease.asset_id, chama_id: lease.chama_id });
    if (!asset) continue;

    for (const period of lease.periods) {
      if (!["pending", "partially_received", "overdue"].includes(period.status)) continue;

      // Overdue periods aren't recomputed until touched (see
      // assetLease.service.js#getLeaseSeasonTracker) — sweep them here so
      // a period that's silently slipped past its due date is actually
      // flagged overdue instead of sitting as stale "pending" forever.
      const statusBefore = period.status;
      recomputePeriodStatus(period);
      if (period.status !== statusBefore) dirty = true;

      if (!period.due_date) continue;
      const dueAt = new Date(period.due_date).getTime();

      // DUE SOON — one-time, only while still pending/partially received
      // (an already-overdue period has missed this window entirely).
      if (period.status !== "overdue" && !period.due_soon_reminder_sent_at && dueAt - now <= LEASE_DUE_SOON_WINDOW_MS && dueAt - now > 0) {
        const lesseeLabel = lease.lessee?.lessee_type === "member" ? "the member lessee" : (lease.lessee?.external_name || "the lessee");
        await notifyStakeholders({
          chamaId: lease.chama_id,
          asset,
          notificationType: "LEASE_PERIOD_DUE_SOON",
          title: "Rent/harvest share due soon",
          message: `${period.label} for ${asset.name} is due from ${lesseeLabel} by ${formatDate(period.due_date)}.`,
          relatedEntityType: "AssetLease",
          relatedEntityId: lease._id,
          actionDeadline: period.due_date,
        });
        period.due_soon_reminder_sent_at = new Date();
        dirty = true;
        continue;
      }

      // OVERDUE — first nudge the moment status flips (handled by
      // recomputePeriodStatus elsewhere), then re-nudge on a cooldown.
      if (period.status === "overdue") {
        const lastReminder = period.last_overdue_reminder_sent_at ? new Date(period.last_overdue_reminder_sent_at).getTime() : 0;
        if (now - lastReminder >= LEASE_OVERDUE_COOLDOWN_MS) {
          const lesseeLabel = lease.lessee?.lessee_type === "member" ? "the member lessee" : (lease.lessee?.external_name || "the lessee");
          const amountNote = period.expected_cash_amount > 0 ? ` (${formatKsh(period.expected_cash_amount)} expected)` : "";
          await notifyStakeholders({
            chamaId: lease.chama_id,
            asset,
            notificationType: "LEASE_PERIOD_OVERDUE",
            title: "Rent/harvest share overdue",
            message: `${period.label} for ${asset.name} was due ${formatDate(period.due_date)} from ${lesseeLabel}${amountNote} and hasn't come in yet.`,
            relatedEntityType: "AssetLease",
            relatedEntityId: lease._id,
            requiresAction: true,
          });
          period.last_overdue_reminder_sent_at = new Date();
          period.overdue_reminder_count = (period.overdue_reminder_count || 0) + 1;
          dirty = true;
        }
      }
    }

    if (dirty) await lease.save().catch((err) => console.error("[asset-nudges] failed saving lease", lease._id.toString(), err.message));
  }
}

// ------------------------------------------------------------------------
// 3. LEASE RENEWAL — a fixed-term lease approaching its end_date
// ------------------------------------------------------------------------
async function sweepLeaseRenewals() {
  const now = Date.now();
  const leases = await AssetLease.find({
    status: "active",
    end_date: { $ne: null },
    renewal_reminder_sent_at: null,
  }).limit(BATCH_SIZE);

  for (const lease of leases) {
    const chama = await Chama.findById(lease.chama_id).select('chama_type workspace_config').lean();
    if (!chama || !isModuleEnabled(chama, 'assets')) continue;

    const endAt = new Date(lease.end_date).getTime();
    if (endAt - now > LEASE_RENEWAL_WINDOW_MS || endAt - now <= 0) continue;

    const asset = await ChamaAsset.findOne({ _id: lease.asset_id, chama_id: lease.chama_id });
    if (!asset) continue;

    const lesseeLabel = lease.lessee?.lessee_type === "member" ? "the member lessee" : (lease.lessee?.external_name || "the lessee");
    await notifyStakeholders({
      chamaId: lease.chama_id,
      asset,
      notificationType: "LEASE_RENEWAL_DUE_SOON",
      title: "Lease nearing expiry",
      message: `The lease on ${asset.name} with ${lesseeLabel} ends ${formatDate(lease.end_date)}. Renew or renegotiate before it lapses.`,
      relatedEntityType: "AssetLease",
      relatedEntityId: lease._id,
      actionDeadline: lease.end_date,
      requiresAction: true,
    });

    lease.renewal_reminder_sent_at = new Date();
    await lease.save().catch((err) => console.error("[asset-nudges] failed saving lease renewal state", lease._id.toString(), err.message));
  }
}

// ------------------------------------------------------------------------
// 4. COMPLIANCE OBLIGATIONS — land rates / permits, due-soon (once) and
// overdue (on cooldown), same shape as lease periods.
// ------------------------------------------------------------------------
async function sweepComplianceObligations() {
  const now = Date.now();
  const obligations = await AssetComplianceObligation.find({
    active: true,
    cycles: { $elemMatch: { status: { $in: ["pending", "overdue"] } } },
  }).limit(BATCH_SIZE);

  for (const obligation of obligations) {
    let dirty = false;
    const chama = await Chama.findById(obligation.chama_id).select('chama_type workspace_config').lean();
    if (!chama || !isModuleEnabled(chama, 'assets')) continue;

    const asset = await ChamaAsset.findOne({ _id: obligation.asset_id, chama_id: obligation.chama_id });
    if (!asset) continue;

    for (const cycle of obligation.cycles) {
      if (!["pending", "overdue"].includes(cycle.status)) continue;
      const dueAt = new Date(cycle.due_date).getTime();
      const isOverdue = dueAt < now;

      // Keep the cycle's own status in sync (same derivation the service
      // layer uses) so a due date that's slipped into the past without
      // anyone touching this obligation still reads as overdue.
      if (isOverdue && cycle.status !== "overdue") {
        cycle.status = "overdue";
        dirty = true;
      }

      if (!isOverdue && !cycle.due_soon_reminder_sent_at && dueAt - now <= COMPLIANCE_DUE_SOON_WINDOW_MS) {
        const amountNote = cycle.amount_expected ? ` (approx. ${formatKsh(cycle.amount_expected)})` : "";
        await notifyStakeholders({
          chamaId: obligation.chama_id,
          asset,
          notificationType: "ASSET_COMPLIANCE_DUE_SOON",
          title: "Land rates/tax due soon",
          message: `${cycle.label} for ${asset.name} is due to ${obligation.jurisdiction} by ${formatDate(cycle.due_date)}${amountNote}.`,
          relatedEntityType: "AssetComplianceObligation",
          relatedEntityId: obligation._id,
          actionDeadline: cycle.due_date,
        });
        cycle.due_soon_reminder_sent_at = new Date();
        dirty = true;
        continue;
      }

      if (isOverdue) {
        const lastReminder = cycle.last_overdue_reminder_sent_at ? new Date(cycle.last_overdue_reminder_sent_at).getTime() : 0;
        if (now - lastReminder >= COMPLIANCE_OVERDUE_COOLDOWN_MS) {
          const amountNote = cycle.amount_expected ? ` (approx. ${formatKsh(cycle.amount_expected)})` : "";
          await notifyStakeholders({
            chamaId: obligation.chama_id,
            asset,
            notificationType: "ASSET_COMPLIANCE_OVERDUE",
            title: "Land rates/tax overdue",
            message: `${cycle.label} for ${asset.name} was due to ${obligation.jurisdiction} on ${formatDate(cycle.due_date)}${amountNote} and is unpaid — penalties may be accruing.`,
            relatedEntityType: "AssetComplianceObligation",
            relatedEntityId: obligation._id,
            requiresAction: true,
          });
          cycle.last_overdue_reminder_sent_at = new Date();
          cycle.overdue_reminder_count = (cycle.overdue_reminder_count || 0) + 1;
          dirty = true;
        }
      }
    }

    if (dirty) await obligation.save().catch((err) => console.error("[asset-nudges] failed saving obligation", obligation._id.toString(), err.message));
  }
}

export const sweepAssetNudges = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;
  try {
    await sweepLeasePeriods();
    await sweepLeaseRenewals();
    await sweepComplianceObligations();
  } catch (error) {
    console.error("[asset-nudges] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startAssetNudgesJob = () => {
  console.log(`[asset-nudges] Asset nudges job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const run = () => sweepAssetNudges();
  run(); // catch up on boot rather than waiting a full interval
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
