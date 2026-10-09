import mongoose from "mongoose";

// ========================================
// CHAMA ASSET SCHEMA (v2)
// ========================================
//
// A business or property the CHAMA ITSELF owns (as opposed to a personal
// `Business` owned by a single user — see models/Business.js).
//
// CHANGES FROM v1
// ----------------------------------------------------------------------
// 1. chama_id now correctly refs "Chama", not "ContributionGroup". Every
//    other chama financial flow (ChamaContribution, ChamaLoan, MGR,
//    Withdrawal) treats the parent as `owner_type: "Chama"` — ChamaAsset
//    was the one place still pointing at the wrong collection.
// 2. Governance no longer hardcodes a 2-of-2 chairperson+treasurer array
//    on the document itself. It now delegates to the existing generic
//    `ApprovalRequest` engine (resource_type: 'INVESTMENT') via
//    approval_request_id — the same engine loans/withdrawals/MGR already
//    use, so a chama's configured committee/threshold rules apply here
//    too instead of a rule that's hardcoded per-asset.
// 3. Added `acquisition`, `management`, and `documents` — the asset is
//    now a real financial-asset record (cost basis, funding source,
//    who's responsible for it, proof of ownership), not just a name and
//    an income guess.
// 4. Added `operations_ref` — an OPTIONAL link to an existing `Business`
//    (and, through it, `RentalListing`) so a chama-owned shop or rental
//    block can reuse the marketplace/inventory/tenant machinery you
//    already built for personal businesses, instead of duplicating it.
// 5. Added `book_value` fields that mirror the ledger rather than being
//    hand-edited — same "dashboard must match books" principle you
//    already apply elsewhere.
//
// CHANGES IN v3
// ----------------------------------------------------------------------
// 6. Added `ownership` — per-asset member % stakes (basis points),
//    defaulting to contribution-proportional but lockable to a manual,
//    negotiated split. See chamaAsset.service.js#recalculateAssetOwnership
//    / #setAssetOwnershipOverride.
// 7. Added `operational_status` — idle/leased_out/occupied/under_
//    maintenance/for_sale. Distinct from `status`, which is this
//    record's lifecycle in the system, not what's happening on the
//    ground.
// 8. `management` can now name an external (non-User) caretaker by
//    plain text, for assets run by someone with no account at all.
//
// LIFECYCLE
//
// 1. Registered at chama creation (status: 'active' immediately), OR
// 2. Proposed post-creation via InvestmentProposal → on approval,
//    chamaAsset.service.js#activateFromProposal creates this record
//    already 'active' with acquisition data + posts the purchase
//    entry, OR
// 3. Requested directly (lighter-weight path, no InvestmentProposal) via
//    chamaAsset.service.js#requestAsset — creates it 'pending_approval'
//    behind an ApprovalRequest.
//
// Income/expense post through the accounting engine
// (finance/accounting/rules/chamaAssetIncome.rule.js /
// chamaAssetExpense.rule.js) — never by editing a number on this doc.
//
const chamaAssetSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chama",
      required: true,
      index: true,
    },

    // Set when this asset came out of an investment proposal rather than
    // a lightweight direct request. Null for assets registered at
    // creation or requested directly.
    investment_proposal_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InvestmentProposal",
      default: null,
    },

    // Configurable per chama via workspace_config.asset_types, with free-text custom label.
    asset_type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    custom_asset_type_label: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },

    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },

    income_pattern: {
      type: String,
      enum: ["constant", "irregular", "seasonal", "none"],
      default: "irregular",
    },
    expected_monthly_income: { type: Number, default: null, min: 0 },

    // ========================================
    // ACQUISITION — cost basis, not just a guess
    // ========================================
    acquisition: {
      method: {
        type: String,
        enum: ["purchase", "construction", "member_transfer", "donation", "founding", "other"],
        default: "purchase",
      },
      acquisition_date: { type: Date, default: null },
      purchase_price: { type: Number, default: 0, min: 0 },
      acquisition_costs: { type: Number, default: 0, min: 0 }, // legal fees, survey, etc.
      funding_source: {
        type: String,
        enum: ["chama_funds", "loan", "mixed", "external", "n/a"],
        default: "chama_funds",
      },
    },

    // ========================================
    // OWNERSHIP vs MANAGEMENT — kept separate on purpose. The chama owns
    // the asset; a specific member (or an external party) may be
    // responsible for day-to-day running of it (collecting rent,
    // running the shop). Don't conflate the two.
    // ========================================
    management: {
      manager_type: { type: String, enum: ["member", "external", "unassigned"], default: "unassigned" },
      manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      // Free-text identity for an external (non-member) caretaker — e.g.
      // a local farmer a plot of chama land is lent to for a season, who
      // has no User account at all. Ignored when manager_type: "member".
      external_name: { type: String, default: "", trim: true, maxlength: 160 },
      external_contact: { type: String, default: "", trim: true, maxlength: 40 },
      assigned_at: { type: Date, default: null },
      notes: { type: String, default: "", trim: true, maxlength: 500 },
    },

    // Every PRIOR management assignment, snapshotted the moment a new
    // one replaces it (see chamaAsset.service.js#assignAssetManager).
    // What makes "manager performance history" possible when a chama
    // rotates caretakers — without this, reassigning wipes out who was
    // actually responsible during any earlier reporting period.
    management_history: [
      {
        manager_type: { type: String, enum: ["member", "external", "unassigned"], required: true },
        manager_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        external_name: { type: String, default: "", trim: true, maxlength: 160 },
        external_contact: { type: String, default: "", trim: true, maxlength: 40 },
        assigned_at: { type: Date, default: null },
        ended_at: { type: Date, default: null },
        notes: { type: String, default: "", trim: true, maxlength: 500 },
      },
    ],

    // ========================================
    // MANAGER ACCOUNTABILITY LOOP — the caretaker isn't necessarily a
    // chama officer, so this is how members hold them to a standard
    // without needing to be in the room. `enabled` turns on automatically
    // the first time a real (member or external) manager is assigned —
    // see chamaAsset.service.js#assignAssetManager — and can be turned
    // off for an asset nobody needs periodic reports on. Actual due
    // periods live in the separate AssetManagerReport collection, one
    // document per period, the same "periods" shape leases already use.
    // ========================================
    manager_reporting: {
      enabled: { type: Boolean, default: false },
      cadence: { type: String, enum: ["monthly", "quarterly"], default: "monthly" },
    },

    // ========================================
    // OPERATIONAL STATUS — what's physically happening with the asset
    // right now (idle / leased out / occupied / under maintenance / for
    // sale). Deliberately separate from `status` above: `status` is the
    // asset's lifecycle in THIS SYSTEM (draft → pending → active →
    // disposed) and drives the approval/accounting workflows; this is
    // the day-to-day operating state the manager/caretaker updates and
    // members see on the dashboard. Only meaningful once status: "active".
    // ========================================
    operational_status: {
      type: String,
      enum: ["idle", "leased_out", "occupied", "under_maintenance", "for_sale"],
      default: "idle",
    },

    // ========================================
    // OWNERSHIP — each active member's % stake in THIS asset. Kept
    // per-asset rather than assumed-equal-to-the-whole-chama because
    // real chamas negotiate this: five founding members who personally
    // funded a plot vs. an asset bought from the general pool everyone
    // contributed to. Stored in basis points (10000 = 100.00%) rather
    // than a float percentage so shares always sum exactly, with no
    // rounding drift when there are many members.
    // ========================================
    ownership: {
      basis: {
        type: String,
        enum: ["equal", "contribution_proportional", "manual"],
        default: "contribution_proportional",
      },
      splits: [
        {
          member_id: { type: mongoose.Schema.Types.ObjectId, ref: "ChamaMembership", required: true },
          basis_points: { type: Number, required: true, min: 0, max: 10000 },
        },
      ],
      // True once leadership has manually negotiated/overridden the
      // split — recalculation from contribution history refuses to run
      // (and silently clobber a negotiated split) while this is true.
      locked: { type: Boolean, default: false },
      last_recalculated_at: { type: Date, default: null },
    },

    // ========================================
    // OPERATIONS LINK — optional. Lets a chama-owned shop or rental
    // property be run through the SAME Business/RentalListing/
    // BusinessTransaction machinery a personal business already uses,
    // rather than a parallel one. Business.owner_type must be 'chama'
    // with owner_id === this chama_id for this link to be valid.
    // ========================================
    operations_ref: {
      business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business", default: null },
    },

    // ========================================
    // PAYMENT REFERENCE CODE — the account number a tenant/lessee types
    // into their M-Pesa Paybill screen to pay THIS asset directly (as
    // opposed to a member contributing to the chama itself, which uses
    // their phone number — see mpesaC2b/c2bReconciliation.service.js).
    // Lazily generated the moment an asset becomes able to receive money
    // (see chamaAsset.service.js#ensureAssetPaymentRefCode) rather than
    // up front, so a draft/pending asset never holds an unused code.
    // Format and uniqueness are owned by utils/assetPaymentCode.js.
    // ========================================
    payment_ref_code: { type: String, default: null, trim: true, uppercase: true },

    // ========================================
    // ACCOUNTING — which ledger accounts represent this asset. Income
    // account is created lazily on first income posting (unchanged
    // behavior); the rest are here so the shape is explicit even before
    // they're populated.
    // ========================================
    accounting: {
      income_account_code: { type: String, default: null },
      expense_account_code: { type: String, default: null },
      asset_account_code: { type: String, default: null }, // for purchase/valuation postings, phase 2
    },

    // Rolling figures mirrored from the ledger by the accounting rules
    // after every posting (see chamaAsset.service.js#refreshBookValue) —
    // never hand-edited. Exists purely so the asset list/dashboard can
    // read one document instead of aggregating the ledger on every
    // request; always reconcilable back to LedgerEntry.
    book_value: {
      total_income: { type: Number, default: 0 },
      total_expenses: { type: Number, default: 0 },
      net_income: { type: Number, default: 0 },
      last_posted_at: { type: Date, default: null },
    },

    // Mirrors the latest AssetTransaction of type 'valuation' — never
    // hand-edited, always re-derivable from that history (see
    // chamaAsset.service.js#recordAssetValuation). Distinct from
    // `book_value`/acquisition cost: this is what the asset is
    // currently believed to be WORTH, not what's been collected or
    // originally paid for it. Lets the members' timeline show
    // appreciation, not just cash flow.
    current_valuation: {
      amount: { type: Number, default: null, min: 0 },
      as_of: { type: Date, default: null },
      note: { type: String, default: "", trim: true, maxlength: 500 },
      recorded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },

    status: {
      type: String,
      enum: [
        "draft",
        "pending_approval",
        "active",
        "suspended",
        "disposal_requested",
        "disposed",
        "inactive",
        "rejected",
      ],
      default: "pending_approval",
      index: true,
    },

    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The single ApprovalRequest governing this asset's activation —
    // replaces the old hardcoded approvals[] array. A chama's own
    // eligible_roles/required_approvals/committee config (set when the
    // request is created — see chamaAsset.service.js) decides who signs.
    approval_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalRequest",
      default: null,
    },

    activated_at: { type: Date, default: null },
    disposed_at: { type: Date, default: null },
    disposal_reason: { type: String, default: "", trim: true, maxlength: 500 },

    documents: [
      {
        type: {
          type: String,
          enum: ["title_deed", "sale_agreement", "valuation", "lease", "license", "insurance", "invoice", "other"],
          required: true,
        },
        file_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        file_url: { type: String, default: null, trim: true },
        uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploaded_at: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
        verified_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        verified_at: { type: Date, default: null },
      },
    ],

    rejection_reason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

chamaAssetSchema.index({ chama_id: 1, status: 1 });

// Sparse because most assets never receive money directly (only ones a
// tenant/lessee pays into via M-Pesa get one) — a plain unique index
// would otherwise reject every second asset with payment_ref_code: null.
chamaAssetSchema.index({ payment_ref_code: 1 }, { unique: true, sparse: true });

// A chama shouldn't register the exact same named asset twice while one
// registration is still pending or active.
chamaAssetSchema.index(
  { chama_id: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ["pending_approval", "active"] } },
  }
);

export default mongoose.models.ChamaAsset || mongoose.model("ChamaAsset", chamaAssetSchema);