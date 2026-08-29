import mongoose from 'mongoose';

// A pledge is a promise. The linked obligation and completed payments remain
// the financial source of truth for its balance.
const contributionPledgeSchema = new mongoose.Schema({
  contribution_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroup', required: true, index: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroupMember', required: true, index: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPlan', required: true },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', required: true, unique: true },
  pledged_amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0.01 },
  currency: { type: String, default: 'KES', uppercase: true, trim: true },
  status: { type: String, enum: ['pledged', 'partially_paid', 'paid', 'cancelled'], default: 'pledged', index: true },
  pledged_at: { type: Date, default: Date.now },
  amended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  amendment_reason: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

contributionPledgeSchema.index(
  { contribution_group_id: 1, member_id: 1 },
  { unique: true, name: 'one_pledge_per_member_per_group' }
);

contributionPledgeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.pledged_amount !== undefined && ret.pledged_amount !== null) ret.pledged_amount = ret.pledged_amount.toString();
    return ret;
  }
});

export default mongoose.models.ContributionPledge || mongoose.model('ContributionPledge', contributionPledgeSchema);
