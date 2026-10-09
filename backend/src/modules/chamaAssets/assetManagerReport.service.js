import mongoose from "mongoose";
import AssetManagerReport from "../../models/AssetManagerReport.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import AssetTransaction from "../../models/AssetTransaction.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import User from "../../models/User.js";
import AppError from "../../utils/AppError.js";
import { getIO } from "../realtime/socketServer.js";
import notificationService from "../../services/notification.service.js";

const emitToChama = (chamaId, event, payload) => {
  try {
    getIO().to(`chama:${chamaId}`).emit(event, payload);
  } catch (error) {
    console.warn(`[assetManagerReport.service] Failed to emit ${event}:`, error.message);
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 7; // how long after period_end the report is still just "due", not "late"
const MISSED_AFTER_DAYS = 30; // past due_date by this long, it's not realistically coming
const LEADER_ROLES = ["chairperson", "treasurer", "secretary"];

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// ---- who is "the manager" -------------------------------------------------

const snapshotOf = (management = {}) => ({
  manager_type: management?.manager_type || "unassigned",
  manager_id: management?.manager_type === "member" ? management.manager_id || null : null,
  external_name: management?.manager_type === "external" ? management.external_name || "" : "",
});

export function isSameManager(a, b) {
  const x = snapshotOf(a);
  const y = snapshotOf(b);
  if (x.manager_type !== y.manager_type) return false;
  if (x.manager_type === "member") return String(x.manager_id) === String(y.manager_id);
  if (x.manager_type === "external") return x.external_name.trim().toLowerCase() === y.external_name.trim().toLowerCase();
  return true; // both unassigned
}

// Monthly → the next full calendar-length month; quarterly → the next
// 3-month block. Both anchored to the day AFTER the previous period
// ended, so gaps/overlaps never creep in.
function computeNextPeriod(cadence, afterDate) {
  const start = startOfDay(afterDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + (cadence === "quarterly" ? 3 : 1));
  end.setDate(end.getDate() - 1);
  const dueDate = new Date(end);
  dueDate.setDate(dueDate.getDate() + GRACE_DAYS);
  const label = cadence === "quarterly"
    ? `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
    : start.toLocaleString("en-KE", { month: "long", year: "numeric" });
  return { label, period_start: start, period_end: end, due_date: dueDate };
}

// The first day of the cadence window that contains `date` — used so a
// long-dormant asset (or a sweep that was down for a while) doesn't
// backfill months nobody could realistically have reported on.
function currentWindowStart(cadence, date) {
  const d = startOfDay(date);
  if (cadence === "quarterly") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

// ============================================================
// OPEN NEXT PERIOD — idempotent and CALENDAR-driven: a new period is
// created once the previous one has ended, whether or not anyone filed
// it. That's what makes a manager who never reports show up as a
// visible run of late/missed periods rather than the cycle quietly
// stopping. No-ops if reporting isn't enabled for the asset.
// ============================================================
export async function openNextReportPeriodIfNeeded(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset || !asset.manager_reporting?.enabled) return null;

  const cadence = asset.manager_reporting.cadence || "monthly";
  const now = new Date();
  const last = await AssetManagerReport.findOne({ chama_id: chamaId, asset_id: assetId }).sort({ "period.period_end": -1 });

  // The latest period still covers today (period_end is stored at the
  // start of its final day) — nothing new to open yet.
  if (last && new Date(last.period.period_end.getTime() + DAY_MS) > now) return last;

  let anchor = last
    ? new Date(last.period.period_end.getTime() + DAY_MS)
    : (asset.management?.assigned_at || asset.activated_at || now);
  let period = computeNextPeriod(cadence, anchor);

  // Would be missed the moment it opens (long outage / dormant asset):
  // start from the current window instead of blaming anyone for it.
  if (now.getTime() > period.due_date.getTime() + MISSED_AFTER_DAYS * DAY_MS) {
    period = computeNextPeriod(cadence, currentWindowStart(cadence, now));
  }

  const report = await AssetManagerReport.create({
    chama_id: chamaId,
    asset_id: assetId,
    manager_snapshot: snapshotOf(asset.management),
    period,
  });

  emitToChama(chamaId, "chama_asset:report_period_opened", { assetId, reportId: report._id, dueDate: period.due_date });
  return report;
}

// ============================================================
// HANDOVER — called by assignAssetManager when the person responsible
// actually changes. The in-progress period is cut off today and stays
// with the OUTGOING manager (their snapshot, their report to file), so
// they're judged on the stretch they actually ran; the incoming manager
// gets a fresh period starting tomorrow.
// ============================================================
export async function closeReportPeriodForHandover(chamaId, assetId, handoverAt = new Date()) {
  const today = startOfDay(handoverAt);
  const current = await AssetManagerReport.find({
    chama_id: chamaId,
    asset_id: assetId,
    "period.period_start": { $lte: today },
    "period.period_end": { $gt: today },
    status: { $in: ["pending", "late"] },
  });
  for (const report of current) {
    report.period.period_end = today;
    const due = new Date(today);
    due.setDate(due.getDate() + GRACE_DAYS);
    report.period.due_date = due;
    if (!/\(handover\)$/.test(report.period.label)) report.period.label = `${report.period.label} (handover)`.slice(0, 40);
    await report.save();
  }
  return current.length;
}

// ============================================================
// LIST — the tracker view. Recomputes pending→late on read (same
// pattern as the lease season tracker), makes sure the current period
// exists BEFORE reading so a page load always shows it, and returns the
// asset's current manager + reporting config alongside the periods.
// ============================================================
export async function listReportPeriods(chamaId, assetId) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId }).populate("management.manager_id", "name");
  if (!asset) throw new AppError("Chama asset not found", 404);

  if (asset.status === "active" && asset.manager_reporting?.enabled) await openNextReportPeriodIfNeeded(chamaId, assetId);

  const reports = await AssetManagerReport.find({ chama_id: chamaId, asset_id: assetId })
    .populate("manager_snapshot.manager_id", "name")
    .populate("submission.submitted_by", "name")
    .populate("acknowledgement.acknowledged_by", "name")
    .sort({ "period.period_start": -1 });

  const now = new Date();
  for (const report of reports) {
    if (report.status === "pending" && report.period.due_date < now) {
      report.status = "late";
      await report.save();
    }
  }

  // What the books actually show for each submitted period, so a member can
  // spot "reported KES 40,000, books show KES 32,000" at a glance and flag the
  // entries behind it. Purely informational — never blocks or edits anything.
  const filed = reports.filter((r) => r.submission?.submitted_at);
  let rows = [];
  if (filed.length) {
    const from = new Date(Math.min(...filed.map((r) => r.period.period_start.getTime())));
    const to = new Date(Math.max(...filed.map((r) => r.period.period_end.getTime())) + DAY_MS);
    rows = await AssetTransaction.find({
      chama_id: chamaId,
      asset_id: assetId,
      type: { $in: ["income", "expense", "maintenance"] },
      occurred_at: { $gte: from, $lt: to },
    }).select("type amount occurred_at").lean();
  }
  const reportsOut = reports.map((report) => {
    const out = report.toObject();
    if (report.submission?.submitted_at) {
      const start = report.period.period_start.getTime();
      const end = report.period.period_end.getTime() + DAY_MS;
      const within = rows.filter((row) => { const t = new Date(row.occurred_at).getTime(); return t >= start && t < end; });
      out.booked = {
        income: within.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount || 0), 0),
        expenses: within.filter((row) => row.type !== "income").reduce((sum, row) => sum + Number(row.amount || 0), 0),
      };
    }
    return out;
  });

  const m = asset.management || {};
  return {
    reports: reportsOut,
    reporting: { enabled: Boolean(asset.manager_reporting?.enabled), cadence: asset.manager_reporting?.cadence || "monthly" },
    manager: {
      type: m.manager_type || "unassigned",
      userId: m.manager_type === "member" ? String(m.manager_id?._id || m.manager_id || "") || null : null,
      name: m.manager_type === "member" ? m.manager_id?.name || "Member" : m.manager_type === "external" ? m.external_name || "External caretaker" : null,
      assignedAt: m.assigned_at || null,
    },
  };
}

// Leadership can turn reporting off for an asset nobody needs periodic
// reports on, or switch cadence for slow-moving assets like farmland.
export async function setManagerReportingConfig(chamaId, assetId, { enabled, cadence }) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId });
  if (!asset) throw new AppError("Chama asset not found", 404);
  if (cadence !== undefined && !["monthly", "quarterly"].includes(cadence)) throw new AppError("cadence must be monthly or quarterly", 400);
  const current = asset.manager_reporting?.toObject?.() ?? asset.manager_reporting ?? {};
  asset.manager_reporting = {
    enabled: enabled === undefined ? Boolean(current.enabled) : Boolean(enabled),
    cadence: cadence ?? current.cadence ?? "monthly",
  };
  await asset.save();
  // Already-open periods keep the cadence they were opened with; the
  // change applies from the next period onward.
  emitToChama(chamaId, "chama_asset:updated", { assetId: asset._id });
  return asset.manager_reporting;
}

// ============================================================
// SUBMIT — the manager's own structured account of the period. Filed by
// whoever was responsible FOR THAT PERIOD (its snapshot — so an outgoing
// manager can still file their handover report), or by a chama leader
// on behalf of an external caretaker who has no account to log in with.
// ============================================================
export async function submitManagerReport(chamaId, assetId, reportId, { submittedByUserId, isLeader, payload }) {
  const asset = await ChamaAsset.findOne({ _id: assetId, chama_id: chamaId, status: "active" });
  if (!asset) throw new AppError("Active chama asset not found", 404);
  const report = await AssetManagerReport.findOne({ _id: reportId, chama_id: chamaId, asset_id: assetId });
  if (!report) throw new AppError("Report period not found", 404);
  if (!["pending", "late"].includes(report.status)) throw new AppError("This report period has already been closed out", 409);
  if (report.submission?.submitted_at) throw new AppError("This report has already been submitted", 409);

  const now = new Date();
  if (now < report.period.period_end) throw new AppError("This report can be filed from the last day of the period", 409);

  const isPeriodManager = report.manager_snapshot?.manager_type === "member"
    && String(report.manager_snapshot.manager_id) === String(submittedByUserId);
  const submittedOnBehalf = !isPeriodManager && Boolean(isLeader);
  if (!isPeriodManager && !isLeader) {
    throw new AppError("Only the manager responsible for this period, or chama leadership on their behalf, can submit this report", 403);
  }

  const { operational_status: operationalStatus, income_collected: incomeCollected, expenses_incurred: expensesIncurred, condition_rating: conditionRating, maintenance_flag: maintenanceFlag, note } = payload;

  const VALID_STATUSES = ["idle", "leased_out", "occupied", "under_maintenance", "for_sale"];
  if (!VALID_STATUSES.includes(operationalStatus)) throw new AppError(`operational_status must be one of: ${VALID_STATUSES.join(", ")}`, 400);
  const rating = Number(conditionRating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new AppError("condition_rating must be a whole number from 1 (poor) to 5 (excellent)", 400);
  const income = Number(incomeCollected || 0);
  const expenses = Number(expensesIncurred || 0);
  if (!Number.isFinite(income) || income < 0 || !Number.isFinite(expenses) || expenses < 0) throw new AppError("income_collected and expenses_incurred must be zero or greater", 400);
  const maintenance = ["none", "minor", "urgent"].includes(maintenanceFlag) ? maintenanceFlag : "none";

  report.status = "submitted";
  report.submission = {
    submitted_at: now,
    submitted_by: submittedByUserId,
    submitted_on_behalf: submittedOnBehalf,
    was_late: now > report.period.due_date,
    operational_status: operationalStatus,
    income_collected: income,
    expenses_incurred: expenses,
    condition_rating: rating,
    maintenance_flag: maintenance,
    note: String(note || "").slice(0, 300),
  };
  await report.save();

  // The structured report doubles as the "update operational status"
  // action — but only when it's the CURRENT manager's period, so an
  // outgoing manager's handover report can't overwrite fresher ground
  // truth the new manager has already recorded.
  if (isSameManager(report.manager_snapshot, asset.management) && asset.operational_status !== operationalStatus) {
    asset.operational_status = operationalStatus;
    await asset.save();
  }

  emitToChama(chamaId, "chama_asset:manager_report_submitted", { assetId, reportId: report._id, status: report.status, maintenanceFlag: maintenance });

  if (maintenance === "urgent") {
    try {
      const leaders = await ChamaMembership.find({ chama_id: chamaId, status: "active", role: { $in: LEADER_ROLES } }).select("_id");
      if (leaders.length) {
        await notificationService.sendBulkNotification({
          chamaId,
          recipientMembershipIds: leaders.map((l) => l._id),
          notificationType: "ASSET_MANAGER_REPORT_URGENT_MAINTENANCE",
          title: `Urgent maintenance flagged — ${asset.name}`,
          message: `The ${report.period.label} report for ${asset.name} flags urgent maintenance. ${note ? String(note).slice(0, 160) : ""}`.trim(),
          metadata: { assetId: String(asset._id), reportId: String(report._id) },
          relatedEntityType: "ASSET_MANAGER_REPORT",
          relatedEntityId: report._id,
          priority: "high",
        });
      }
    } catch (error) {
      // The report is already saved — a notification hiccup must not fail the submission.
      console.error("[assetManagerReport.service] urgent-maintenance notification failed:", error.message);
    }
  }

  return report;
}

// Leadership review — closes the loop without re-litigating the
// figures; a discrepancy in what was reported belongs on the
// AssetTransaction flag flow (chamaAsset.service.js), not here.
// Separation of duties: you can't acknowledge a report you filed
// (including one you filed on someone's behalf).
export async function acknowledgeManagerReport(chamaId, assetId, reportId, { acknowledgedByUserId, comment }) {
  const report = await AssetManagerReport.findOne({ _id: reportId, chama_id: chamaId, asset_id: assetId });
  if (!report) throw new AppError("Report period not found", 404);
  if (report.status !== "submitted") throw new AppError("Only a submitted report can be acknowledged", 409);
  if (String(report.submission?.submitted_by) === String(acknowledgedByUserId)) {
    throw new AppError("You submitted this report, so another leader needs to acknowledge it", 403);
  }
  report.status = "acknowledged";
  report.acknowledgement = { acknowledged_by: acknowledgedByUserId, acknowledged_at: new Date(), comment: String(comment || "").slice(0, 300) };
  await report.save();
  emitToChama(chamaId, "chama_asset:manager_report_acknowledged", { assetId, reportId: report._id });
  return report;
}

// Sweep — flips overdue periods to late/missed and opens the current
// period for every asset with reporting enabled, so the cycle keeps
// moving even if nobody opens the asset's page. Interval-driven — see
// jobs/Assetmanagerreportscheduler.job.js.
export async function sweepManagerReportSchedules() {
  const now = new Date();
  const overdue = await AssetManagerReport.find({ status: { $in: ["pending", "late"] } });
  for (const report of overdue) {
    const staleAfter = new Date(report.period.due_date.getTime() + MISSED_AFTER_DAYS * DAY_MS);
    if (now > staleAfter) {
      report.status = "missed";
      await report.save();
    } else if (report.status === "pending" && now > report.period.due_date) {
      report.status = "late";
      await report.save();
    }
  }

  const assets = await ChamaAsset.find({ status: "active", "manager_reporting.enabled": true }).select("_id chama_id");
  for (const asset of assets) {
    await openNextReportPeriodIfNeeded(asset.chama_id, asset._id).catch((error) => console.error("[asset-manager-report-sweep] failed for asset", asset._id.toString(), error.message));
  }
}

// ============================================================
// MANAGER PERFORMANCE — the cross-asset track record for one member.
// Report stats come from each period's own manager SNAPSHOT (so they
// stay correct after the chama rotates who's responsible); confirmed
// discrepancies are attributed by date to the tenure window in
// `management` / `management_history`. This is what a chama should look
// at before reassigning — not just "who do we like".
// ============================================================
export async function getManagerPerformance(chamaId, managerUserId) {
  if (!mongoose.isValidObjectId(managerUserId)) throw new AppError("Invalid manager id", 400);
  const chamaObjectId = new mongoose.Types.ObjectId(chamaId);
  const userObjectId = new mongoose.Types.ObjectId(managerUserId);

  const [user, reports, assets] = await Promise.all([
    User.findById(userObjectId).select("name"),
    AssetManagerReport.find({ chama_id: chamaObjectId, "manager_snapshot.manager_type": "member", "manager_snapshot.manager_id": userObjectId }).lean(),
    ChamaAsset.find({
      chama_id: chamaObjectId,
      $or: [
        { "management.manager_type": "member", "management.manager_id": userObjectId },
        { "management_history.manager_type": "member", "management_history.manager_id": userObjectId },
      ],
    }).select("name management management_history").lean(),
  ]);

  const perAsset = new Map();
  const ensure = (assetId, assetName) => {
    const key = String(assetId);
    if (!perAsset.has(key)) {
      perAsset.set(key, { assetId, assetName, windows: [], start: null, end: null, current: false, due: 0, onTime: 0, late: 0, missed: 0, urgentFlags: 0, ratingSum: 0, ratingCount: 0, confirmedDiscrepancies: 0 });
    }
    return perAsset.get(key);
  };

  for (const asset of assets) {
    const entry = ensure(asset._id, asset.name);
    for (const past of asset.management_history || []) {
      if (past.manager_type === "member" && String(past.manager_id) === String(userObjectId)) entry.windows.push({ start: past.assigned_at, end: past.ended_at });
    }
    if (asset.management?.manager_type === "member" && String(asset.management.manager_id) === String(userObjectId)) {
      entry.windows.push({ start: asset.management.assigned_at, end: null });
      entry.current = true;
    }
  }

  const missingNames = reports.filter((r) => !perAsset.has(String(r.asset_id))).map((r) => r.asset_id);
  if (missingNames.length) {
    const extra = await ChamaAsset.find({ _id: { $in: missingNames } }).select("name").lean();
    for (const a of extra) ensure(a._id, a.name);
  }

  for (const report of reports) {
    const entry = ensure(report.asset_id, perAsset.get(String(report.asset_id))?.assetName);
    if (report.status === "pending") continue; // still inside its window, not yet resolved either way
    entry.due += 1;
    if (report.status === "missed") entry.missed += 1;
    else if (report.status === "late") entry.late += 1; // overdue and still unfiled
    else if (report.submission?.was_late) entry.late += 1; // filed, but after the due date
    else entry.onTime += 1;
    if (report.submission?.condition_rating) { entry.ratingSum += report.submission.condition_rating; entry.ratingCount += 1; }
    if (report.submission?.maintenance_flag === "urgent") entry.urgentFlags += 1;
  }

  for (const entry of perAsset.values()) {
    for (const window of entry.windows) {
      const match = { chama_id: chamaObjectId, asset_id: entry.assetId, flag_status: "confirmed", occurred_at: { $gte: new Date(window.start || 0) } };
      if (window.end) match.occurred_at.$lte = new Date(window.end);
      entry.confirmedDiscrepancies += await AssetTransaction.countDocuments(match);
    }
    const starts = entry.windows.map((w) => w.start).filter(Boolean).map((d) => new Date(d).getTime());
    entry.start = starts.length ? new Date(Math.min(...starts)) : null;
    entry.end = entry.current ? null : (entry.windows.map((w) => w.end).filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null);
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  const tenures = [...perAsset.values()].map(({ windows, ratingSum, ratingCount, ...rest }) => ({
    ...rest,
    avgConditionRating: ratingCount ? round1(ratingSum / ratingCount) : null,
  }));

  if (!tenures.length) return { managerUserId, managerName: user?.name || null, tenures: [], summary: null };

  const total = tenures.reduce((s, t) => ({
    due: s.due + t.due, onTime: s.onTime + t.onTime, late: s.late + t.late, missed: s.missed + t.missed,
    urgentFlags: s.urgentFlags + t.urgentFlags, confirmedDiscrepancies: s.confirmedDiscrepancies + t.confirmedDiscrepancies,
  }), { due: 0, onTime: 0, late: 0, missed: 0, urgentFlags: 0, confirmedDiscrepancies: 0 });
  const ratings = reports.map((r) => r.submission?.condition_rating).filter(Boolean);

  return {
    managerUserId,
    managerName: user?.name || null,
    tenures,
    summary: {
      totalDue: total.due,
      onTimeRatePct: total.due > 0 ? round1((total.onTime / total.due) * 100) : null,
      onTime: total.onTime,
      late: total.late,
      missed: total.missed,
      avgConditionRating: ratings.length ? round1(ratings.reduce((s, v) => s + v, 0) / ratings.length) : null,
      urgentFlags: total.urgentFlags,
      confirmedDiscrepancies: total.confirmedDiscrepancies,
    },
  };
}
