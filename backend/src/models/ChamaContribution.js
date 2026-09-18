import mongoose from 'mongoose';

// ========================================
// CHAMA CONTRIBUTION SCHEMA
// ========================================
//
// This is a SEPARATE entity from:
//
//   - Savings          (ContributionPlan contribution_type: 'fixed', see chamaFinance.service.js)
//   - MGR              (ContributionPlan contribution_type: 'merry_go_round')
//   - Scheduled/plan Contributions (ContributionPlan / ContributionObligation)
//   - ContributionGroup (the standalone, personal fundraising entity —
//                        one active group per USER, lives outside any Chama)
//
// A ChamaContribution is an AD-HOC, cause-based fund that lives INSIDE a
// Chama: "let's chip in for James's hospital bill", "let's contribute
// towards Achieng's wedding", "let's raise money to buy the chama a tent".
//
// Any active member can propose one. It only starts accepting money once
// an official (chairperson/treasurer/secretary) approves it. Members then
// chip in any amount they like. Officials close the collection window,
// and disbursing the money out requires a multi-role approval workflow
// (ApprovalRequest, resource_type: CHAMA_CONTRIBUTION_PAYOUT) — the same
// separation-of-duties pattern used for MGR payouts and loan disbursement.
//
// LEDGER
// ------
// Each active ChamaContribution gets its own dedicated FinancialAccount
// (owner_type: 'Chama', owner_id: chama_id, account_code: this doc's
// `account_code`) so its balance is tracked independently of the Chama's
// general savings/contribution balances. See:
//
//   modules/finance/accounting/rules/chamaContribution.rule.js   (funding)
//   modules/finance/accounting/rules/chamaContributionPayout.rule.js (payout)
//
// ========================================

export const CHAMA_CONTRIBUTION_PURPOSES = [
  'emergency',
  'wedding',
  'medical',
  'funeral',
  'purchase',
  'other',
];

export const CHAMA_CONTRIBUTION_STATUSES = [
  'pending_approval', // Awaiting an official's sign-off before it can accept money
  'active',            // Approved — members can chip in
  'rejected',           // An official declined to open it
  'closed',             // Collection window closed — no more chip-ins accepted
  'payout_pending',     // A payout has been proposed and is awaiting multi-role approval
  'completed',          // Money has been disbursed
  'cancelled',          // Withdrawn before ever collecting anything
];

const chamaContributionSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: [true, 'A title is required, e.g. "Hospital bill for James"'],
      trim: true,
      minlength: 2,
      maxlength: 150,
    },

    purpose: {
      type: String,
      enum: CHAMA_CONTRIBUTION_PURPOSES,
      default: 'other',
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: null,
    },

    // Optional — the member this contribution is being raised for (e.g.
    // the member whose emergency/wedding it is). Not required for
    // purchase/"other" causes that benefit the whole chama.
    beneficiary_membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null,
    },

    target_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: null,
      min: 0,
    },

    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
    },

    deadline: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: CHAMA_CONTRIBUTION_STATUSES,
      default: 'pending_approval',
      index: true,
    },

    // ChamaMembership of whoever proposed it
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null,
    },
    reviewed_at: { type: Date, default: null },
    rejection_reason: { type: String, trim: true, maxlength: 300, default: null },

    // Cached running total (source of truth is the ledger — see
    // FinancialAccount.current_balance for account_code below — but this
    // avoids a ledger round-trip for list views).
    collected_amount: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },

    // Deterministic per-contribution ledger account code, e.g. "CCAB12CD34".
    // Set once the contribution is approved and its FinancialAccount exists.
    account_code: {
      type: String,
      trim: true,
      maxlength: 20,
      default: null,
    },

    financial_account_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialAccount',
      default: null,
    },

    closed_at: { type: Date, default: null },
    closed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', default: null },

    // ------------------------------------------------------
    // PAYOUT (requires ApprovalRequest sign-off before disbursing)
    // ------------------------------------------------------
    approval_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ApprovalRequest',
      default: null,
    },

    disbursement: {
      method: { type: String, enum: ['cash', 'bank', 'mpesa', null], default: null },
      phone_number: { type: String, default: null },
      notes: { type: String, trim: true, maxlength: 500, default: null },
      requested_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', default: null },
      requested_at: { type: Date, default: null },
    },

    disbursed_at: { type: Date, default: null },
    disbursed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', default: null },
    disbursement_reference: { type: String, default: null },
    disbursed_amount: { type: mongoose.Schema.Types.Decimal128, default: null },

    cancelled_at: { type: Date, default: null },
    cancelled_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership', default: null },
    cancel_reason: { type: String, trim: true, maxlength: 300, default: null },
  },
  {
    timestamps: true,
  }
);

chamaContributionSchema.index({ chama_id: 1, status: 1 });
chamaContributionSchema.index({ chama_id: 1, createdAt: -1 });

chamaContributionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.target_amount !== undefined && ret.target_amount !== null) {
      ret.target_amount = ret.target_amount.toString();
    }
    if (ret.collected_amount !== undefined && ret.collected_amount !== null) {
      ret.collected_amount = ret.collected_amount.toString();
    }
    if (ret.disbursed_amount !== undefined && ret.disbursed_amount !== null) {
      ret.disbursed_amount = ret.disbursed_amount.toString();
    }
    return ret;
  },
});

const ChamaContribution = mongoose.model('ChamaContribution', chamaContributionSchema);

export default ChamaContribution;
