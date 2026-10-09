import mongoose from "mongoose";
import Chama from "../../models/Chama.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import ChamaGoal from "../../models/ChamaGoal.js";
import ChamaBusinessFunding from "../../models/ChamaBusinessFunding.js";
import ChamaAssetDistribution from "../../models/ChamaAssetDistribution.js";
import AssetManagerReport from "../../models/AssetManagerReport.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import BusinessItem from "../../models/BusinessItem.js";
import BusinessCustomer from "../../models/BusinessCustomer.js";
import RentalListing from "../../models/RentalListing.js";
import RentalInquiry from "../../models/RentalInquiry.js";
import { getOwnedBusiness } from "./business.service.js";

/**
 * ============================================================================
 * CHAMA BUSINESS DASHBOARD
 * ============================================================================
 * The per-business view a chama sees inside that business's own workspace.
 * It answers two questions at once:
 *
 *   1. Is this business earning its keep for the chama?
 *      (profit, ROI, capital invested vs returned, manager accountability)
 *   2. How is it actually running day to day?
 *      (a block that depends on the business category: retail, restaurant,
 *       rental, service, other)
 *
 * Access is whatever getOwnedBusiness() decides: chairperson, treasurer, the
 * assigned manager, or an active member who can see the asset (read-only).
 * Money is aggregated server-side with $toDouble so Decimal128 never leaks
 * to the client as an object.
 *
 * Figures use the same definitions as portfolioDashboard.service.js (income =
 * completed cash_in, spend = completed cash_out, capital returned = completed
 * or processing distributions) so the chama portfolio and this page agree.
 * ============================================================================
 */

const TZ = "Africa/Nairobi";
const LOW_STOCK_THRESHOLD = 5; // BusinessItem has no reorder level yet
const TREND_MONTHS = 6;
const DAY_MS = 24 * 60 * 60 * 1000;

const httpError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const num = (value) => {
  const parsed = Number(value?.toString?.() ?? value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, digits = 0) => {
  const factor = 10 ** digits;
  return Math.round(num(value) * factor) / factor;
};

// Start of the current calendar month / day in Nairobi (UTC+3, no DST).
function nairobiStart(unit, now = new Date()) {
  const local = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth();
  const d = local.getUTCDate();
  const startLocal = unit === "month" ? Date.UTC(y, m, 1) : Date.UTC(y, m, d);
  return new Date(startLocal - 3 * 60 * 60 * 1000);
}

function addMonths(date, months) {
  const local = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  const shifted = Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1);
  return new Date(shifted - 3 * 60 * 60 * 1000);
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

/* ----------------------------------------------------------------------------
 * Shared financial block
 * -------------------------------------------------------------------------- */
async function buildPerformance(businessId, now) {
  const monthStart = nairobiStart("month", now);
  const prevMonthStart = addMonths(monthStart, -1);
  const trendStart = addMonths(monthStart, -(TREND_MONTHS - 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);

  const [monthly, lifetime, lastTx] = await Promise.all([
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, status: "completed", createdAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            y: { $year: { date: "$createdAt", timezone: TZ } },
            m: { $month: { date: "$createdAt", timezone: TZ } },
            d: "$direction",
          },
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]),
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, status: "completed" } },
      { $group: { _id: "$direction", total: { $sum: { $toDouble: "$amount" } } } },
    ]),
    BusinessTransaction.findOne({ business_id: businessId, status: "completed", direction: "cash_in" })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean(),
  ]);

  const byMonth = new Map();
  for (const row of monthly) {
    const key = monthKey(row._id.y, row._id.m);
    const entry = byMonth.get(key) || { income: 0, spend: 0 };
    if (row._id.d === "cash_in") entry.income += row.total;
    if (row._id.d === "cash_out") entry.spend += row.total;
    byMonth.set(key, entry);
  }

  const trend = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i -= 1) {
    const start = addMonths(monthStart, -i);
    const local = new Date(start.getTime() + 3 * 60 * 60 * 1000);
    const key = monthKey(local.getUTCFullYear(), local.getUTCMonth() + 1);
    const entry = byMonth.get(key) || { income: 0, spend: 0 };
    trend.push({
      month: key,
      label: MONTH_LABELS[local.getUTCMonth()],
      income: round(entry.income),
      spend: round(entry.spend),
      net: round(entry.income - entry.spend),
    });
  }

  const current = trend[trend.length - 1];
  const previous = trend[trend.length - 2] || { income: 0, spend: 0, net: 0 };
  const change = (now, before) => (before > 0 ? round(((now - before) / before) * 100, 1) : null);

  const totalIn = num(lifetime.find((r) => r._id === "cash_in")?.total);
  const totalOut = num(lifetime.find((r) => r._id === "cash_out")?.total);

  return {
    lifetime: { income: round(totalIn), spend: round(totalOut), net: round(totalIn - totalOut) },
    thisMonth: {
      income: current.income,
      spend: current.spend,
      net: current.net,
      incomeChangePct: change(current.income, previous.income),
      spendChangePct: change(current.spend, previous.spend),
      margin: current.income > 0 ? round((current.net / current.income) * 100, 1) : null,
    },
    trend,
    lastIncomeAt: lastTx?.createdAt || null,
    quiet30Days: !lastTx || lastTx.createdAt < thirtyDaysAgo,
    periodStarts: { monthStart, prevMonthStart },
  };
}

/* ----------------------------------------------------------------------------
 * Chama capital + accountability block
 * -------------------------------------------------------------------------- */
async function buildChamaBlock({ business, asset, performance, now }) {
  const chamaId = business.owner_id;
  const assetId = asset?._id;

  const [chama, fundings, distributions, goals, reports] = await Promise.all([
    Chama.findById(chamaId).select("name").lean(),
    ChamaBusinessFunding.find({ chama_id: chamaId, business_id: business._id, status: "posted" }).lean(),
    assetId
      ? ChamaAssetDistribution.find({ chama_id: chamaId, asset_id: assetId, status: { $in: ["completed", "processing"] } }).lean()
      : [],
    assetId ? ChamaGoal.find({ chama_id: chamaId, asset_id: assetId, status: "active" }).lean() : [],
    assetId ? AssetManagerReport.find({ asset_id: assetId }).sort({ "period.period_end": -1 }).limit(6).lean() : [],
  ]);

  const acquisition = num(asset?.acquisition?.purchase_price) + num(asset?.acquisition?.acquisition_costs);
  const topUps = fundings.reduce((sum, f) => sum + num(f.amount), 0);
  const invested = acquisition + topUps;
  const returned = distributions.reduce((sum, d) => sum + num(d.total_amount), 0);
  const net = performance.lifetime.net;

  const reportingEnabled = Boolean(asset?.manager_reporting?.enabled);
  const lastReport = reports[0] || null;
  const missed = reports.filter(
    (r) => r.status === "missed" || (r.status === "pending" && r.period?.due_date && new Date(r.period.due_date) < now)
  ).length;

  const alerts = [];
  if (reportingEnabled && missed > 0) {
    alerts.push({ level: "danger", code: "manager_report", message: `${missed} manager report${missed > 1 ? "s are" : " is"} overdue or missed` });
  }

  return {
    chama: { id: String(chamaId), name: chama?.name || null },
    asset: asset
      ? {
          id: String(asset._id),
          name: asset.name,
          status: asset.status,
          operationalStatus: asset.operational_status || null,
        }
      : null,
    capital: {
      invested: round(invested),
      initial: round(acquisition),
      topUps: round(topUps),
      returned: round(returned),
      paybackPct: invested > 0 ? round((returned / invested) * 100, 1) : null,
      roiPct: invested > 0 ? round((net / invested) * 100, 1) : null,
    },
    manager: {
      name: asset?.management?.manager_id?.name || asset?.management?.external_name || null,
      type: asset?.management?.manager_type || "unassigned",
      reportingEnabled,
      cadence: asset?.manager_reporting?.cadence || null,
      lastReportStatus: lastReport?.status || null,
      lastReportAt: lastReport?.submitted_at || lastReport?.period?.period_end || null,
      overdueReports: missed,
    },
    goals: goals.map((g) => ({
      id: String(g._id),
      name: g.name,
      targetAmount: num(g.target_amount),
      savedAmount: num(g.saved_amount),
      progressPct: num(g.target_amount) > 0 ? Math.min(100, round((num(g.saved_amount) / num(g.target_amount)) * 100)) : 0,
      targetDate: g.target_date || null,
      breakEvenDate: g.break_even_date || null,
    })),
    alerts,
  };
}

/* ----------------------------------------------------------------------------
 * Category blocks. Every builder returns:
 *   { kind, title, metrics: [{key,label,value,format,tone?}], lists?: [...], alerts: [] }
 * `format` is "money" | "number" | "percent" so the client stays dumb.
 * -------------------------------------------------------------------------- */
const metric = (key, label, value, format = "number", tone) => ({ key, label, value, format, ...(tone ? { tone } : {}) });

async function retailBlock(businessId) {
  const items = await BusinessItem.find({ business_id: businessId, status: "active" })
    .select("name quantity price cost_price track_stock")
    .lean();
  const tracked = items.filter((i) => i.track_stock !== false);
  const out = tracked.filter((i) => num(i.quantity) <= 0);
  const low = tracked.filter((i) => num(i.quantity) > 0 && num(i.quantity) <= LOW_STOCK_THRESHOLD);
  const costValue = tracked.reduce((s, i) => s + num(i.quantity) * num(i.cost_price || i.price), 0);
  const retailValue = tracked.reduce((s, i) => s + num(i.quantity) * num(i.price), 0);

  const alerts = [];
  if (out.length) alerts.push({ level: "warning", code: "out_of_stock", message: `${out.length} item${out.length > 1 ? "s are" : " is"} out of stock` });

  return {
    kind: "retail",
    title: "Stock & shelf health",
    metrics: [
      metric("skus", "Products listed", items.length),
      metric("outOfStock", "Out of stock", out.length, "number", out.length ? "warning" : undefined),
      metric("lowStock", `Low stock (≤${LOW_STOCK_THRESHOLD})`, low.length, "number", low.length ? "warning" : undefined),
      metric("stockCost", "Stock value (cost)", round(costValue), "money"),
      metric("stockRetail", "Stock value (retail)", round(retailValue), "money"),
      metric("potentialMargin", "Potential margin on stock", retailValue > 0 ? round(((retailValue - costValue) / retailValue) * 100, 1) : 0, "percent"),
    ],
    lists: [
      { key: "restock", title: "Needs restocking", empty: "Nothing is running low.", rows: [...out, ...low.sort((a, b) => a.quantity - b.quantity)].slice(0, 6).map((i) => ({ label: i.name, value: `${num(i.quantity)} left` })) },
    ],
    alerts,
  };
}

async function restaurantBlock(businessId, now) {
  const dayStart = nairobiStart("day", now);
  const since24h = new Date(now.getTime() - DAY_MS);
  const since30d = new Date(now.getTime() - 30 * DAY_MS);

  const [today, last30, queued, ready, hours, menuCount] = await Promise.all([
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: dayStart } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $toDouble: "$amount" } } } },
    ]),
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since30d } } },
      { $group: { _id: null, orders: { $sum: 1 }, revenue: { $sum: { $toDouble: "$amount" } } } },
    ]),
    // Only the last 24h: older orders that were never marked ready would otherwise sit in "queued" forever.
    BusinessTransaction.countDocuments({ business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since24h }, $or: [{ kitchen_status: "queued" }, { kitchen_status: { $exists: false } }] }),
    BusinessTransaction.countDocuments({ business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since24h }, kitchen_status: "ready" }),
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since30d } } },
      { $group: { _id: { $hour: { date: "$createdAt", timezone: TZ } }, orders: { $sum: 1 } } },
      { $sort: { orders: -1 } },
      { $limit: 3 },
    ]),
    BusinessItem.countDocuments({ business_id: businessId, status: "active" }),
  ]);

  const t = today[0] || { orders: 0, revenue: 0 };
  const m = last30[0] || { orders: 0, revenue: 0 };
  const fmtHour = (h) => `${String(h).padStart(2, "0")}:00`;

  return {
    kind: "restaurant",
    title: "Floor & kitchen",
    metrics: [
      metric("ordersToday", "Orders today", t.orders),
      metric("revenueToday", "Takings today", round(t.revenue), "money"),
      metric("queued", "In the kitchen (24h)", queued, "number", queued > 8 ? "warning" : undefined),
      metric("ready", "Ready for pickup (24h)", ready),
      metric("avgTicket", "Average order (30d)", m.orders ? round(m.revenue / m.orders) : 0, "money"),
      metric("menu", "Menu items", menuCount),
    ],
    lists: [
      { key: "peak", title: "Busiest hours (30 days)", empty: "No orders in the last 30 days.", rows: hours.map((h) => ({ label: fmtHour(h._id), value: `${h.orders} orders` })) },
    ],
    alerts: [],
  };
}

async function rentalBlock(businessId, now) {
  const monthStart = nairobiStart("month", now);
  const [listings, inquiries, rentThisMonth] = await Promise.all([
    RentalListing.find({ business_id: businessId }).select("title listing_type status rent_amount rent_period").lean(),
    RentalInquiry.countDocuments({ business_id: businessId, status: "new" }),
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", status: "completed", rental_listing_id: { $ne: null }, createdAt: { $gte: monthStart } } },
      { $group: { _id: "$rental_listing_id", paid: { $sum: { $toDouble: "$amount" } } } },
    ]),
  ]);

  const paidByUnit = new Map(rentThisMonth.map((r) => [String(r._id), r.paid]));
  const occupied = listings.filter((l) => l.status === "occupied");
  const vacant = listings.length - occupied.length;
  const monthly = (l) => (l.rent_period || "month") === "month";
  const expected = occupied.filter(monthly).reduce((s, l) => s + num(l.rent_amount), 0);
  const collected = rentThisMonth.reduce((s, r) => s + r.paid, 0);
  const potential = listings.filter(monthly).reduce((s, l) => s + num(l.rent_amount), 0);

  // Occupied monthly units with nothing recorded this month = likely arrears.
  const unpaid = occupied.filter((l) => monthly(l) && !paidByUnit.has(String(l._id)));
  const unpaidValue = unpaid.reduce((s, l) => s + num(l.rent_amount), 0);

  const alerts = [];
  if (unpaid.length) alerts.push({ level: "warning", code: "rent_unpaid", message: `${unpaid.length} occupied unit${unpaid.length > 1 ? "s have" : " has"} no rent recorded this month` });
  if (listings.length && vacant / listings.length >= 0.5) alerts.push({ level: "info", code: "vacancy", message: "Half or more of the units are vacant" });

  return {
    kind: "rental",
    title: "Units & rent roll",
    metrics: [
      metric("units", "Total units", listings.length),
      metric("occupancy", "Occupancy", listings.length ? round((occupied.length / listings.length) * 100) : 0, "percent"),
      metric("vacant", "Vacant units", vacant, "number", vacant ? "warning" : undefined),
      metric("collected", "Rent collected this month", round(collected), "money"),
      metric("expected", "Expected from occupied units", round(expected), "money"),
      metric("collection", "Collection rate", expected > 0 ? Math.min(100, round((collected / expected) * 100)) : 0, "percent"),
      metric("potential", "Full-occupancy potential / month", round(potential), "money"),
      metric("inquiries", "New tenant inquiries", inquiries, "number", inquiries ? "info" : undefined),
    ],
    lists: [
      { key: "arrears", title: "No rent recorded this month", empty: "Every occupied unit has paid something this month.", rows: unpaid.slice(0, 6).map((l) => ({ label: l.title, value: num(l.rent_amount) })), valueFormat: "money", footnote: unpaid.length ? `Combined monthly rent: ${round(unpaidValue).toLocaleString()}` : null },
    ],
    alerts,
  };
}

async function serviceBlock(businessId, now) {
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const [byStatus, clientCount, topClients] = await Promise.all([
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", createdAt: { $gte: since30d } } },
      { $group: { _id: "$status", count: { $sum: 1 }, total: { $sum: { $toDouble: "$amount" } } } },
    ]),
    BusinessCustomer.countDocuments({ business_id: businessId }),
    BusinessTransaction.aggregate([
      { $match: { business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since30d }, customer_name: { $nin: [null, ""] } } },
      { $group: { _id: "$customer_name", total: { $sum: { $toDouble: "$amount" } }, jobs: { $sum: 1 } } },
      { $sort: { total: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const get = (status) => byStatus.find((r) => r._id === status) || { count: 0, total: 0 };
  const done = get("completed");
  const pending = get("pending");
  const failed = get("failed");

  const alerts = [];
  if (pending.count) alerts.push({ level: "info", code: "pending_payments", message: `${pending.count} payment${pending.count > 1 ? "s are" : " is"} still pending (30 days)` });

  return {
    kind: "service",
    title: "Jobs & clients",
    metrics: [
      metric("jobs", "Jobs paid (30d)", done.count),
      metric("avgJob", "Average job value", done.count ? round(done.total / done.count) : 0, "money"),
      metric("pending", "Awaiting payment", pending.count, "number", pending.count ? "warning" : undefined),
      metric("pendingValue", "Value awaiting payment", round(pending.total), "money"),
      metric("failed", "Failed payments (30d)", failed.count, "number", failed.count ? "warning" : undefined),
      metric("clients", "Clients on record", clientCount),
    ],
    lists: [
      { key: "clients", title: "Top clients (30 days)", empty: "No named clients paid in the last 30 days.", rows: topClients.map((c) => ({ label: c._id, value: round(c.total) })), valueFormat: "money" },
    ],
    alerts,
  };
}

async function otherBlock(businessId, now) {
  const since30d = new Date(now.getTime() - 30 * DAY_MS);
  const agg = await BusinessTransaction.aggregate([
    { $match: { business_id: businessId, type: "sale", status: "completed", createdAt: { $gte: since30d } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: { $toDouble: "$amount" } } } },
  ]);
  const a = agg[0] || { count: 0, total: 0 };
  return {
    kind: "other",
    title: "Last 30 days",
    metrics: [
      metric("sales", "Sales recorded", a.count),
      metric("takings", "Takings", round(a.total), "money"),
      metric("avg", "Average sale", a.count ? round(a.total / a.count) : 0, "money"),
    ],
    lists: [],
    alerts: [],
  };
}

const CATEGORY_BUILDERS = { retail: retailBlock, restaurant: restaurantBlock, rental: rentalBlock, service: serviceBlock, other: otherBlock };

/* ----------------------------------------------------------------------------
 * Entry point
 * -------------------------------------------------------------------------- */
export async function getChamaBusinessDashboard(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);

  if (business.isGroup || business.owner_type !== "chama") {
    throw httpError("This dashboard is only available for chama-owned businesses", 404);
  }

  const now = new Date();
  const bid = new mongoose.Types.ObjectId(String(business._id));

  const asset = business.chama_asset_id
    ? await ChamaAsset.findOne({ _id: business.chama_asset_id, chama_id: business.owner_id })
        .populate("management.manager_id", "name")
        .lean()
    : null;

  const performance = await buildPerformance(bid, now);
  const chamaBlock = await buildChamaBlock({ business, asset, performance, now });

  const category = CATEGORY_BUILDERS[business.category] ? business.category : "other";
  const categoryBlock = await CATEGORY_BUILDERS[category](bid, now);

  const alerts = [...chamaBlock.alerts, ...categoryBlock.alerts];
  if (performance.thisMonth.net < 0) alerts.unshift({ level: "warning", code: "loss", message: "Spending is ahead of income this month" });
  if (performance.quiet30Days) alerts.push({ level: "info", code: "quiet", message: "No income recorded in the last 30 days" });

  const { periodStarts, ...performanceOut } = performance;

  return {
    business: {
      id: String(business._id),
      name: business.name,
      category,
      categoryLabel: business.category_label || null,
      currency: business.currency || "KES",
      location: business.location || null,
    },
    access: business.access || null,
    chama: chamaBlock.chama,
    asset: chamaBlock.asset,
    performance: performanceOut,
    capital: chamaBlock.capital,
    manager: chamaBlock.manager,
    goals: chamaBlock.goals,
    categoryInsights: categoryBlock,
    alerts,
    generatedAt: now,
  };
}

export default { getChamaBusinessDashboard };
