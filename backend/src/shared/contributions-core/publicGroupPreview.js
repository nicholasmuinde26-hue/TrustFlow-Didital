import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import ContributionPledge from '../../models/ContributionPledge.js';
import AppError from '../../utils/AppError.js';

// Minimal read model shared by the public Giving API and ChamaManager.
// Keep the donor-facing response intentionally smaller than organizer detail.
export async function getPublicGroupPreviewByJoinCode(joinCode, { requirePublicGiving = false } = {}) {
  if (!joinCode || typeof joinCode !== 'string') throw new AppError('Join code is required', 400);
  const cleanCode = joinCode.trim().toUpperCase();
  const group = await ContributionGroup.findOne({ join_code: cleanCode }).populate('created_by', 'name').lean();
  if (!group) throw new AppError('Contribution group not found with this join link', 404);
  if (group.status === 'suspended') throw new AppError('This contribution group is temporarily unavailable while it is reviewed.', 423);
  if (requirePublicGiving) {
    const verification = group.verification || {};
    const expired = verification.expires_at && new Date(verification.expires_at) <= new Date();
    if (group.status !== 'active' || verification.status !== 'verified' || verification.level !== 'public' || verification.public_giving_enabled !== true || expired) {
      throw new AppError('This fundraiser is not currently approved for public donations.', 404);
    }
  }
  const [memberCount, pledges] = await Promise.all([
    ContributionGroupMember.countDocuments({ contribution_group_id: group._id, status: 'active' }),
    ContributionPledge.find({ contribution_group_id: group._id, status: { $ne: 'cancelled' } }).populate('obligation_id').lean(),
  ]);
  const totalPledged = pledges.reduce((sum, pledge) => sum + (Number(pledge.pledged_amount?.toString?.() || pledge.pledged_amount) || 0), 0);
  const totalCollected = pledges.reduce((sum, pledge) => sum + (Number(pledge.obligation_id?.paid_amount?.toString?.() || pledge.obligation_id?.paid_amount) || 0), 0);
  const publicDonorCount = new Set(pledges.map((pledge) => String(pledge.donor_id || '')).filter(Boolean)).size;
  return {
    group: {
      id: group._id, name: group.name, description: group.description, type: group.type, status: group.status,
      visibility: group.visibility, event_date: group.event_date, contribution_end_date: group.contribution_end_date,
      beneficiary: group.beneficiary, target_amount: group.target_amount?.toString?.() || null,
      location: group.location, join_code: group.join_code,
      verification: { status: group.verification?.status || 'pending', level: group.verification?.level || 'members', public_giving_enabled: group.verification?.public_giving_enabled === true, verified_at: group.verification?.verified_at || null },
      organizer: { id: group.created_by?._id, name: group.created_by?.name || 'Organizer' },
    },
    totals: { target: Number(group.target_amount?.toString?.() || 0), pledged: totalPledged, collected: totalCollected, outstanding: Math.max(0, totalPledged - totalCollected) },
    memberCount, supporterCount: memberCount + publicDonorCount,
  };
}
