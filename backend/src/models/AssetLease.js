import mongoose from "mongoose";

// ========================================
// ASSET LEASE SCHEMA
// ========================================
//
// A standing arrangement under which someone (a member or an external
// party — e.g. a local farmer with no account at all) occupies or works
// a chama-owned asset. Two Kenyan-market shapes this exists to cover:
//
//   1. A rental unit / shop with a monthly cash lease — one expected
//      figure, roughly every month.
//   2. Land lent out to a farmer for a share of the harvest (or a
//      harvest share PLUS a top-up cash amount) — income doesn't land
//      monthly, it lands once or twice a year, in kind, tied to a
//      growing season. Modelling this as "expected monthly income" (like
//      a rental unit) would be wrong for every field in the country.
//
// This document is just the AGREEMENT (who, what kind, what's owed in
// general). The actual expected-vs-received bookkeeping happens per
// `periods[]` entry — one per rent month or one per farming season —
// so "did October's rent come in" and "did the 2026 long-rains harvest
// share come in" are answered the same way: compare what was expected
// for that period against what's actually been logged against it.
//
// Cash received against a period is NOT duplicated here — it is looked
// up from AssetTransaction (type: 'income', lease_period_id: <period>),
// which is the one place a cash figure is ever posted, through the same
// accounting engine and M-Pesa reconciliation every other asset income
// entry goes through (see chamaAsset.service.js#recordIncome). In-kind
// receipts (a share of harvest) don't move through the cash ledger at
// all — Safaricom has no receipt number for three bags of maize — so
// those are recorded directly on the period below, with an OPTIONAL
// estimated value for reporting only. If/when the chama actually sells
// that produce for cash, that sale is a completely ordinary asset
// income entry (collectionMethod cash/bank/mpesa) — this model does not
// try to guess a market price on the chama's behalf.
//
export const LEASE_ARRANGEMENT_TYPES = ["cash", "in_kind", "hybrid"];
export const LEASE_CASH_FREQUENCIES = ["monthly", "quarterly", "per_season", "one_off"];
export const LEASE_PERIOD_STATUSES = ["pending", "partially_received", "fulfilled", "overdue", "waived"];

const inKindReceiptSchema = new mongoose.Schema(
  {
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 40 }, // e.g. "90kg bags", "sacks", "litres"
    estimated_value: { type: Number, default: null, min: 0 }, // optional KES estimate, reporting-only
    valuation_note: { type: String, default: "", trim: true, maxlength: 300 }, // e.g. "at farm-gate price of KES 4,500/bag"
    description: { type: String, default: "", trim: true, maxlength: 300 },
    recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    recorded_at: { type: Date, default: Date.now },
  },
  { _id: true }
);

const leasePeriodSchema = new mongoose.Schema(
  {
    // Human label, not a fixed enum, because seasons aren't named the
    // same way everywhere — "October 2026", "2026 Long Rains", "Season
    // 2 2026" are all valid for different assets.
    label: { type: String, required: true, trim: true, maxlength: 80 },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    due_date: { type: Date, default: null }, // when the cash/harvest is expected by

    expected_cash_amount: { type: Number, default: 0, min: 0 },
    expected_in_kind: {
      quantity: { type: Number, default: null, min: 0 },
      unit: { type: String, default: "", trim: true, maxlength: 40 },
      description: { type: String, default: "", trim: true, maxlength: 300 }, // e.g. "30% share of maize harvest"
    },

    in_kind_receipts: [inKindReceiptSchema],

    // Denormalized so the tracker list can render without a second
    // query — recomputed by assetLease.service.js every time a cash
    // receipt posts or an in-kind receipt is logged. The authoritative
    // cash figure always remains the sum of AssetTransaction rows with
    // this period's _id as lease_period_id; this is a cache of that sum.
    received_cash_amount: { type: Number, default: 0, min: 0 },
    received_in_kind_quantity: { type: Number, default: 0, min: 0 },

    status: { type: String, enum: LEASE_PERIOD_STATUSES, default: "pending", index: true },
    notes: { type: String, default: "", trim: true, maxlength: 500 },

    // ========================================
    // NUDGE TRACKING — set only by jobs/assetNudges.job.js, never by
    // hand. Keeps the sweep idempotent: a "due soon" nudge fires once
    // per period, an "overdue" nudge re-fires on a cooldown for as
    // long as the period stays unfulfilled. Cleared implicitly the
    // moment the period leaves "overdue" (recomputePeriodStatus moves
    // it to fulfilled/partially_received/waived) since nothing reads
    // these once status isn't "overdue"/"pending" any more.
    // ========================================
    due_soon_reminder_sent_at: { type: Date, default: null },
    last_overdue_reminder_sent_at: { type: Date, default: null },
    overdue_reminder_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const assetLeaseSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", required: true, index: true },

    // Same member-or-external-party shape as ChamaAsset.management — a
    // plot lent to a farmer with no account at all is the common case
    // this exists for.
    lessee: {
      lessee_type: { type: String, enum: ["member", "external"], required: true },
      member_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      external_name: { type: String, default: "", trim: true, maxlength: 160 },
      external_contact: { type: String, default: "", trim: true, maxlength: 40 },
    },

    arrangement_type: { type: String, enum: LEASE_ARRANGEMENT_TYPES, required: true },

    cash_terms: {
      amount: { type: Number, default: 0, min: 0 },
      frequency: { type: String, enum: LEASE_CASH_FREQUENCIES, default: "monthly" },
    },
    in_kind_terms: {
      description: { type: String, default: "", trim: true, maxlength: 300 }, // e.g. "40% of harvested maize"
      expected_unit: { type: String, default: "", trim: true, maxlength: 40 },
    },

    start_date: { type: Date, required: true },
    end_date: { type: Date, default: null }, // null = open-ended / until renewed

    status: { type: String, enum: ["active", "ended", "terminated"], default: "active", index: true },
    ended_reason: { type: String, default: "", trim: true, maxlength: 300 },

    periods: [leasePeriodSchema],

    // ========================================
    // RENEWAL NUDGE TRACKING — only meaningful when end_date is set
    // (an open-ended lease never expires, so it's never nudged for
    // renewal). Reset to null whenever end_date changes (extended,
    // cleared, or the lease is renewed into a fresh one), so a renewed
    // lease doesn't inherit a stale "already reminded" state.
    // ========================================
    renewal_reminder_sent_at: { type: Date, default: null },

    notes: { type: String, default: "", trim: true, maxlength: 500 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

assetLeaseSchema.index({ chama_id: 1, asset_id: 1, status: 1 });

export default mongoose.models.AssetLease || mongoose.model("AssetLease", assetLeaseSchema);
