import mongoose from 'mongoose';

/**
 * ============================================================================
 * SAVINGS SHAREOUT SCHEMA
 * ============================================================================
 *
 * The OPERATIONAL record of a savings distribution event — mirroring how
 * Payout works for MGR, except a share-out pays MANY recipients at once
 * (every eligible member gets a slice of their own savings back), so the
 * per-member detail lives in an embedded `items` array on one header doc
 * instead of one Payout doc per recipient.
 *
 * Architecture:
 *
 * SavingsShareout (this model, status: draft)
 *       │  officer/scheduler builds a preview of items[]
 *       │  status: pending_approval
 *       ▼
 *       │  chairperson/committee approves (per approval_rule on the policy)
 *       │  status: approved
 *       ▼
 * FinancialTransaction  (transaction_type: 'savings_shareout_obligation')
 *       │
 *       ├── DR total  Member Savings   (liability decreases — we now owe
 *       │              this out instead of holding it as savings)
 *       └── CR total  Payout Clearing
 *
 *       │  treasurer disburses each item individually (methods/timing
 *       │  can differ per member)
 *       ▼
 * FinancialTransaction PER ITEM (transaction_type: 'savings_shareout_settlement')
 *       │
 *       ├── DR item amount  Payout Clearing
 *       └── CR item amount  cash / bank / mpesa
 *
 * When every item is paid or cancelled, status becomes 'completed'.
 *
 * NON-CUSTODIAL, same as Payout: neither phase moves money itself. The
 * obligation phase records that the chama now owes members their share;
 * the settlement phase records that the treasurer has already handed the
 * money over (disbursement_method + external_reference capture how).
 * ============================================================================
 */

const shareoutItemSchema = new mongoose.Schema(
  {
    member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
    },

    // Snapshot of the member's net savings balance at the moment the
    // share-out was built, so later balance changes never retroactively
    // change what this item is entitled to.
    savings_balance_snapshot: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    share_percentage_applied: {
      type: Number,
      required: true,
    },

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
    },

    status: {
      type: String,
      enum: ['pending', 'paid', 'cancelled'],
      default: 'pending',
    },

    disbursement_method: {
      type: String,
      enum: ['cash', 'bank', 'mpesa'],
      default: null,
    },

    external_reference: {
      type: String,
      trim: true,
      default: null,
    },

    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null,
    },

    paid_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null },
  },
  { _id: true, timestamps: false }
);

const savingsShareoutSchema = new mongoose.Schema(
  {
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true,
    },

    policy_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsSharePolicy',
      required: true,
      index: true,
    },

    contribution_plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      required: true,
      index: true,
    },

    // Human label, e.g. "2026 Year-End Savings Share-Out".
    period_label: {
      type: String,
      trim: true,
      maxlength: 150,
      default: '',
    },

    trigger_type: {
      type: String,
      enum: ['manual', 'scheduled'],
      required: true,
    },

    // The moment balances were snapshotted for this batch's items.
    as_of_date: {
      type: Date,
      required: true,
      default: Date.now,
    },

    total_amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },

    currency: {
      type: String,
      default: 'KES',
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      required: true,
    },

    // draft             → items built, nothing submitted yet
    // pending_approval   → submitted, awaiting sign-off per approval_rule
    // approved           → obligation posted to the ledger, treasurer may pay items
    // completed          → every item is paid or cancelled
    // cancelled          → whole batch withdrawn before any item was paid
    status: {
      type: String,
      enum: ['draft', 'pending_approval', 'approved', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },

    items: {
      type: [shareoutItemSchema],
      default: [],
    },

    approvals: [
      {
        approved_by: { type: mongoose.Schema.Types.ObjectId, ref: 'ChamaMembership' },
        approved_at: { type: Date, default: Date.now },
      },
    ],

    obligation_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null,
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    cancelled_at: { type: Date, default: null },
  },
  { timestamps: true }
);

savingsShareoutSchema.index({ chama_id: 1, status: 1 });

savingsShareoutSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.total_amount !== undefined && ret.total_amount !== null) {
      ret.total_amount = ret.total_amount.toString();
    }
    if (Array.isArray(ret.items)) {
      ret.items = ret.items.map((item) => ({
        ...item,
        savings_balance_snapshot: item.savings_balance_snapshot?.toString?.() ?? item.savings_balance_snapshot,
        amount: item.amount?.toString?.() ?? item.amount,
      }));
    }
    return ret;
  },
});

export default mongoose.models.SavingsShareout || mongoose.model('SavingsShareout', savingsShareoutSchema);