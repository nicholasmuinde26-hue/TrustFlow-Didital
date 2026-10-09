import mongoose from "mongoose";

// ========================================
// ASSET TRANSACTION SCHEMA
// ========================================
//
// NOT a second accounting engine. Every AssetTransaction is written
// ALONGSIDE a real posting made through accounting.service.js — this is
// a denormalized per-asset index over your existing
// FinancialTransaction/Journal/LedgerEntry chain, so an asset's own page
// can render:
//
//   Mavoko Rental Property
//   2026-01-05  Purchase          KES 5,000,000
//   2026-02-03  Rent received     KES    80,000
//   2026-02-14  Plumbing expense  KES    12,000
//
// ...with one query instead of reverse-joining LedgerEntry by metadata.
// The `financial_transaction_id` / `journal_id` fields are what make it
// reconcilable: book_value on ChamaAsset (and anything this table shows)
// must always be re-derivable from those, never edited independently.
//
// Written by:
//   - chamaAssetIncome.rule.js   (type: 'income')
//   - chamaAssetExpense.rule.js  (type: 'expense')
//   - chamaAsset.service.js#activateFromProposal (type: 'purchase')
//   - (phase 2) disposal / valuation / depreciation flows
//
const assetTransactionSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chama",
      required: true,
      index: true,
    },
    asset_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChamaAsset",
      required: true,
      index: true,
    },
    source_business_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessTransaction",
      default: null,
      index: true,
    },

    type: {
      type: String,
      enum: ["purchase", "income", "expense", "maintenance", "valuation", "transfer", "disposal", "distribution"],
      required: true,
      index: true,
    },

    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "KES", uppercase: true, trim: true, minlength: 3, maxlength: 3 },

    description: { type: String, default: "", trim: true, maxlength: 500 },

    // Expense-only. Written by chamaAssetExpense.rule.js. NOTE: this field
    // (along with reconciliation_status, mpesa_receipt_number, lease_id,
    // and lease_period_id below) was previously missing from this schema —
    // Mongoose's default strict mode was silently dropping every value the
    // accounting rules passed for it, so getAssetExpenseBreakdown() and the
    // reconciliation queue always read back empty/default values no matter
    // what was actually posted. Fixed by declaring them here.
    category: {
      type: String,
      enum: ["repairs_maintenance", "land_rates_taxes", "insurance", "utilities", "inputs_seeds", "licenses_permits", "management_fee", "other"],
      default: null,
    },

    // Income-only (M-Pesa reconciliation — see chamaAsset.service.js#recordIncome).
    // 'not_applicable' for non-mpesa income/expense/purchase rows.
    reconciliation_status: {
      type: String,
      enum: ["not_applicable", "unverified", "verified"],
      default: "not_applicable",
      index: true,
    },
    mpesa_receipt_number: { type: String, default: null, trim: true, index: true },

    // Set when this row is a lease-period collection (cash rent/lease
    // payment) so the lease's expected-vs-received tracker can pull its
    // received total straight from AssetTransaction instead of keeping a
    // second, independently-updatable running balance. See
    // modules/chamaAssets/assetLease.service.js.
    lease_id: { type: mongoose.Schema.Types.ObjectId, ref: "AssetLease", default: null, index: true },
    lease_period_id: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    // The authoritative accounting trail this row is a readable summary
    // of. Required for every type that moves money (an AssetTransaction
    // with no ledger backing behind a cash movement is a bug, not a
    // feature — this is the exact "Asset.income += amount without a
    // ledger entry" anti-pattern to avoid). EXCEPTION: 'valuation' rows
    // are a member's/appraiser's opinion of worth, not a cash event —
    // there is nothing for double-entry accounting to post, so they are
    // the one type allowed to exist without a ledger trail.
    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinancialTransaction",
      required: function () { return this.type !== "valuation"; },
    },
    journal_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Journal",
      required: function () { return this.type !== "valuation"; },
    },
    ledger_entry_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "LedgerEntry" }],

    // Valuation-only — an optional supporting note ("bank appraisal",
    // "3 comparable plots on the same road"). Ignored for every other type.
    valuation_note: { type: String, default: "", trim: true, maxlength: 500 },

    // ========================================
    // MEMBER-RAISED DISCREPANCY FLAG — any active member can flag an
    // income/expense entry they think is wrong (wrong amount, income
    // that was never actually collected, an expense nobody recognizes).
    // Routes through the SAME multi-signatory ApprovalRequest engine as
    // registering an asset or approving an investment (resource_type
    // 'ASSET_DISCREPANCY') rather than a side channel, so it gets the
    // same separation-of-duties guarantees (the flagger can't also be
    // the one who clears it). See chamaAsset.service.js#flagAssetTransactionDiscrepancy.
    // 'flagged' while under review; 'confirmed' once leadership signs
    // off that something was actually wrong; 'dismissed' once cleared.
    // ========================================
    flag_status: {
      type: String,
      enum: ["not_flagged", "flagged", "confirmed", "dismissed"],
      default: "not_flagged",
      index: true,
    },
    flag_request_id: { type: mongoose.Schema.Types.ObjectId, ref: "ApprovalRequest", default: null },

    performed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    occurred_at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

assetTransactionSchema.index({ asset_id: 1, occurred_at: -1 });
assetTransactionSchema.index({ chama_id: 1, type: 1 });

export default mongoose.models.AssetTransaction || mongoose.model("AssetTransaction", assetTransactionSchema);