import mongoose from "mongoose";

// ========================================
// ASSET MANAGER REPORT SCHEMA
// ========================================
//
// The manager-accountability half of the asset progress dashboard. One
// document per DUE PERIOD (one per month, or per quarter — see
// ChamaAsset.manager_reporting.cadence), mirroring the AssetLease
// "periods" shape: created 'pending', filled in once, then closed out.
//
// Deliberately a FIXED, STRUCTURED shape rather than a free-text field —
// the whole point is that "October" is comparable to "November" is
// comparable to what a *different* caretaker reported eight months ago
// after the chama rotated who's responsible for the property. A wall of
// prose can't be compared across periods or managers; five fixed fields
// can.
//
// This is the caretaker's OWN account of the period — separate from,
// and not a substitute for, the actual ledger-backed AssetTransaction
// income/expense rows. A mismatch between what a manager reports here
// and what's actually posted to the books is exactly the kind of thing
// a member should be able to notice and flag (see AssetTransaction
// flag_status / chamaAsset.service.js#flagAssetTransactionDiscrepancy).
//
export const REPORT_STATUSES = ["pending", "submitted", "late", "acknowledged", "missed"];
export const MAINTENANCE_FLAGS = ["none", "minor", "urgent"];

const assetManagerReportSchema = new mongoose.Schema(
  {
    chama_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chama", required: true, index: true },
    asset_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaAsset", required: true, index: true },

    // Who was actually responsible for the asset during THIS period,
    // captured at the moment the period is opened — not a live pointer
    // to ChamaAsset.management, which may have moved on to someone else
    // by the time this period is looked back at.
    manager_snapshot: {
      manager_type: { type: String, enum: ["member", "external", "unassigned"], default: "unassigned" },
      manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      external_name: { type: String, default: "", trim: true, maxlength: 160 },
    },

    period: {
      label: { type: String, required: true, trim: true, maxlength: 40 }, // e.g. "October 2026", "Q4 2026"
      period_start: { type: Date, required: true },
      period_end: { type: Date, required: true },
      due_date: { type: Date, required: true }, // period_end + grace window
    },

    status: { type: String, enum: REPORT_STATUSES, default: "pending", index: true },

    // The structured submission itself — every field fixed-shape and
    // short, so it stays comparable period over period.
    submission: {
      submitted_at: { type: Date, default: null },
      submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      // True when a leader filled this in on behalf of an external
      // caretaker with no account of their own to log in with.
      submitted_on_behalf: { type: Boolean, default: false },
      // True when the submission landed after due_date. Kept SEPARATE from
      // `status` on purpose: a late submission is still a submitted
      // report (status 'submitted'), not one still waiting on a filing.
      was_late: { type: Boolean, default: false },
      operational_status: { type: String, enum: ["idle", "leased_out", "occupied", "under_maintenance", "for_sale"], default: null },
      income_collected: { type: Number, default: null, min: 0 },
      expenses_incurred: { type: Number, default: null, min: 0 },
      condition_rating: { type: Number, default: null, min: 1, max: 5 }, // 1 = poor, 5 = excellent
      maintenance_flag: { type: String, enum: MAINTENANCE_FLAGS, default: "none" },
      note: { type: String, default: "", trim: true, maxlength: 300 }, // short context only, not a substitute for the structured fields
    },

    acknowledgement: {
      acknowledged_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      acknowledged_at: { type: Date, default: null },
      comment: { type: String, default: "", trim: true, maxlength: 300 },
    },

    created_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

assetManagerReportSchema.index({ chama_id: 1, asset_id: 1, "period.period_start": -1 });
assetManagerReportSchema.index({ asset_id: 1, status: 1 });
assetManagerReportSchema.index({ "manager_snapshot.manager_id": 1 });

export default mongoose.models.AssetManagerReport || mongoose.model("AssetManagerReport", assetManagerReportSchema);