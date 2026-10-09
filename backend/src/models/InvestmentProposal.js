import mongoose from "mongoose";

// ========================================
// INVESTMENT PROPOSAL SCHEMA
// ========================================
//
// There's a real difference between:
//
//    "We want to buy 2 acres in Machakos"          (InvestmentProposal)
//    "The chama owns 2 acres in Machakos"           (ChamaAsset)
//
// This is the first one — the thesis members vote on BEFORE any money
// moves or any ChamaAsset exists. Governance runs through the same
// `ApprovalRequest` engine as loans/withdrawals/MGR
// (resource_type: 'INVESTMENT', which the model already supports),
// so a chama's own committee/threshold configuration applies here
// instead of a bespoke rule.
//
// LIFECYCLE
//
//   draft
//     ↓ (submitted for approval — creates an ApprovalRequest)
//   under_review
//     ↓                              ↓
//   approved                     rejected
//     ↓ (funds committed, chamaAsset.service.js#activateFromProposal)
//   acquired  ──────────────────► ChamaAsset created, status: 'active'
//
// A rejected or withdrawn proposal never produces a ChamaAsset — nothing
// downstream (ledger, dashboard) ever sees it, by construction.
//
const investmentProposalSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chama",
      required: true,
      index: true,
    },

    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 2000 },

    asset_type: {
      type: String,
      enum: ["business", "property", "vehicle", "equipment", "investment", "other"],
      required: true,
    },

    // The financial thesis — what members are actually voting on.
    proposal: {
      purchase_price: { type: Number, required: true, min: 0 },
      acquisition_costs: { type: Number, default: 0, min: 0 },
      funding_source: {
        type: String,
        enum: ["chama_funds", "loan", "mixed", "external"],
        default: "chama_funds",
      },
      funding_target: { type: Number, default: null, min: 0 }, // total to be raised/committed, if different from price
      expected_monthly_income: { type: Number, default: null, min: 0 },
      risk_notes: { type: String, default: "", trim: true, maxlength: 1000 },
    },

    // Running total of member/chama funds earmarked for this proposal
    // before it's acquired — mirrors FinancialAccount.reserved_balance's
    // "committed but not settled" idea, scoped to this one proposal.
    funding_committed: { type: Number, default: 0, min: 0 },

    documents: [
      {
        type: {
          type: String,
          enum: ["feasibility_study", "valuation", "sale_agreement_draft", "site_photo", "other"],
          default: "other",
        },
        file_id: { type: mongoose.Schema.Types.ObjectId, default: null },
        file_url: { type: String, default: null, trim: true },
        uploaded_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploaded_at: { type: Date, default: Date.now },
      },
    ],

    status: {
      type: String,
      enum: ["draft", "under_review", "approved", "rejected", "withdrawn", "acquired"],
      default: "draft",
      index: true,
    },

    proposed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The governing ApprovalRequest (resource_type: 'INVESTMENT'). Left
    // null while status is 'draft' — created the moment the proposer
    // submits it for review.
    approval_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalRequest",
      default: null,
    },

    // Set once approved and materialized into a real ChamaAsset — see
    // chamaAsset.service.js#activateFromProposal.
    resulting_asset_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChamaAsset",
      default: null,
    },

    rejection_reason: { type: String, default: "", trim: true, maxlength: 500 },
    withdrawn_reason: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

investmentProposalSchema.index({ chama_id: 1, status: 1 });

export default mongoose.models.InvestmentProposal || mongoose.model("InvestmentProposal", investmentProposalSchema);