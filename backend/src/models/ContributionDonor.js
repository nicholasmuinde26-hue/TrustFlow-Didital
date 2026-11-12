import mongoose from 'mongoose';

const contributionDonorSchema = new mongoose.Schema({
  contribution_group_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContributionGroup',
    required: true,
    index: true,
  },
  display_name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  phone_number: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: null },
  pledge_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionPledge', default: null },
  obligation_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ContributionObligation', default: null },
}, { timestamps: true });

contributionDonorSchema.index({ contribution_group_id: 1, phone_number: 1 }, { unique: true, name: 'one_public_donor_per_group_phone' });

export default mongoose.models.ContributionDonor || mongoose.model('ContributionDonor', contributionDonorSchema);
