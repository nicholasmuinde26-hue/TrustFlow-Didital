import mongoose from 'mongoose';

// A pledge is a promise. The linked obligation and completed payments remain
// the financial source of truth for its balance.
const contributionPledgeSchema = new mongoose.Schema({
  contribution_group_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroup', required: true, index: true },
  member_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionGroupMember', default: null, index: true },
  donor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionDonor', default: null, index: true },
  plan_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPlan', required: true },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', required: true, unique: true },
  pledged_amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0.01 },
  currency: { type: String, default: 'KES', uppercase: true, trim: true },
  status: { type: String, enum: ['pledged', 'partially_paid', 'paid', 'cancelled'], default: 'pledged', index: true },
  pledged_at: { type: Date, default: Date.now },
  amended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  amendment_reason: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true });

contributionPledgeSchema.pre('validate', function validatePledger() {
  if (Boolean(this.member_id) === Boolean(this.donor_id)) {
    throw new Error('A pledge must belong to exactly one member or public donor.');
  }
});

contributionPledgeSchema.index(
  { contribution_group_id: 1, member_id: 1 },
  { unique: true, name: 'contribution_group_id_1_member_id_1', partialFilterExpression: { member_id: { $type: 'objectId' } } }
);
contributionPledgeSchema.index(
  { contribution_group_id: 1, donor_id: 1 },
  { unique: true, name: 'one_pledge_per_public_donation', partialFilterExpression: { donor_id: { $type: 'objectId' } } }
);

contributionPledgeSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.pledged_amount !== undefined && ret.pledged_amount !== null) ret.pledged_amount = ret.pledged_amount.toString();
    return ret;
  }
});

export default mongoose.models.ContributionPledge || mongoose.model('ContributionPledge', contributionPledgeSchema);
