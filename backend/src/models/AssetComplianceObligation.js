import mongoose from "mongoose";

// ========================================
// ASSET COMPLIANCE OBLIGATION SCHEMA
// ========================================
//
// A recurring, non-negotiable-if-ignored payment the chama owes to some
// outside authority BECAUSE it owns this asset — land rates to a county,
// a single business permit, a renewal of some license. Distinct from a
// lease period (AssetLease): a lease period is money coming IN from a
// lessee; this is money going OUT to a jurisdiction, on that
// jurisdiction's clock, whether or not the asset earned anything that
// cycle.
//
// WHY A SEPARATE MODEL FROM LEASE PERIODS
// ----------------------------------------------------------------------
// The shapes look similar (a label, a due date, expected vs settled) but
// the obligation doesn't come from an agreement the chama negotiated —
// it's imposed by a county/authority, is usually annual regardless of
// the asset's own lease cadence, and needs its own `jurisdiction` so a
// chama with several properties across different counties can see "what
// do we owe, and where" at a glance.
//
// WHY `jurisdiction` IS FREE TEXT, AND WHY THE DUE DATE ISN'T DERIVED
// ----------------------------------------------------------------------
// County land-rates deadlines and early-bird/penalty rules change from
// year to year and county to county — hardcoding a per-county calendar
// here would silently go stale and could give a chama the wrong date
// for something with real cash penalties attached. So `jurisdiction` is
// just a label for display/grouping ("Kiambu County", "Nairobi City
// County"), and leadership enters the actual due_date for each cycle
// themselves (same trust model as AssetLease.periods.due_date) — the
// system's job is to remember it and nudge, not to know statutory
// deadlines on the chama's behalf.
//
// PAYING A CYCLE reuses the exact same accounting path as any other
// asset expense (chamaAsset.service.js#recordExpense, category
// "land_rates_taxes" or "licenses_permits") — this document never posts
// to the ledger itself, it only points at the AssetTransaction that did.
//
export const COMPLIANCE_OBLIGATION_TYPES = ["land_rates", "business_permit", "other_tax", "other"];
export const COMPLIANCE_CYCLE_STATUSES = ["pending", "paid", "overdue", "waived"];

const complianceCycleSchema = new mongoose.Schema(
  {
    // e.g. "2026 land rates", "2026/27 single business permit"
    label: { type: String, required: true, trim: true, maxlength: 80 },
    due_date: { type: Date, required: true },
    amount_expected: { type: Number, default: null, min: 0 }, // optional — rates vary and aren't always known ahead of time

    status: { type: String, enum: COMPLIANCE_CYCLE_STATUSES, default: "pending", index: true },
    paid_amount: { type: Number, default: 0, min: 0 },
    paid_at: { type: Date, default: null },
    // Points at the AssetTransaction (type: 'expense') the payment was
    // actually posted through — the authoritative record of the cash
    // event. This field is a cache/link, never a second source of truth.
    asset_transaction_id: { type: mongoose.Schema.Types.ObjectId, ref: "AssetTransaction", default: null },

    waived_reason: { type: String, default: "", trim: true, maxlength: 300 },
    notes: { type: String, default: "", trim: true, maxlength: 500 },

    // ========================================
    // NUDGE TRACKING — set only by jobs/assetNudges.job.js. Same
    // idempotency shape as AssetLease.periods.
    // ========================================
    due_soon_reminder_sent_at: { type: Date, default: null },
    last_overdue_reminder_sent_at: { type: Date, default: null },
    overdue_reminder_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const assetComplianceObligationSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", required: true, index: true },

    obligation_type: { type: String, enum: COMPLIANCE_OBLIGATION_TYPES, required: true },

    // Display/grouping label only — see note above on why this isn't a
    // fixed enum or used to derive due dates.
    jurisdiction: { type: String, required: true, trim: true, maxlength: 160 },
    authority_name: { type: String, default: "", trim: true, maxlength: 160 }, // e.g. "Kiambu County Revenue Board"
    description: { type: String, default: "", trim: true, maxlength: 300 },

    // An obligation that no longer applies (asset disposed, permit
    // discontinued) stops generating nudges without deleting its history.
    active: { type: Boolean, default: true },

    cycles: [complianceCycleSchema],

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

assetComplianceObligationSchema.index({ chama_id: 1, asset_id: 1, active: 1 });

export default mongoose.models.AssetComplianceObligation
  || mongoose.model("AssetComplianceObligation", assetComplianceObligationSchema);
