import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import Meeting from '../../models/Meeting.js';
import AppError from '../../utils/AppError.js';
import mongoose from 'mongoose';

export async function getWorkspaceDashboard({ workspaceId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError('Invalid workspace ID', 400);
  }
  const [chamaMembership, groupMembership] = await Promise.all([
    ChamaMembership.findOne({ chama_id: workspaceId, user_id: userId, status: 'active' }).lean(),
    ContributionGroupMember.findOne({ contribution_group_id: workspaceId, user_id: userId, status: 'active' }).lean(),
  ]);
  const type = chamaMembership ? 'chama' : groupMembership ? 'contribution-group' : null;
  if (!type) throw new AppError('You do not have access to this workspace', 403);

  const membership = chamaMembership || groupMembership;
  const ownerType = type === 'chama' ? 'Chama' : 'ContributionGroup';
  const workspace = type === 'chama'
    ? await Chama.findById(workspaceId).lean()
    : await ContributionGroup.findById(workspaceId).lean();
  if (!workspace) throw new AppError('Workspace not found', 404);

  const memberFilter = type === 'chama'
    ? { chama_id: workspaceId, status: 'active' }
    : { contribution_group_id: workspaceId, status: 'active' };
  const ownerFilter = { owner_type: ownerType, owner_id: workspaceId };
  const now = new Date();
  const [memberCount, activePlans, overdueCount, payments, meetings] = await Promise.all([
    type === 'chama' ? ChamaMembership.countDocuments(memberFilter) : ContributionGroupMember.countDocuments(memberFilter),
    ContributionPlan.countDocuments({ ...ownerFilter, status: 'active' }),
    ContributionObligation.countDocuments({ ...ownerFilter, status: { $in: ['pending', 'partially_paid', 'overdue'] }, due_date: { $lt: now } }),
    ContributionPayment.aggregate([
      { $match: { ...ownerFilter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]),
    Meeting.find({ workspace_id: workspaceId, cancelled_at: null, starts_at: { $gte: now } }).sort({ starts_at: 1 }).limit(3).lean(),
  ]);

  return {
    type,
    workspace: {
      id: String(workspace._id), name: workspace.name, status: workspace.status, role: membership.role,
      monthlySavings: workspace.monthly_savings ?? null, eventDate: workspace.event_date ?? null,
      location: workspace.location ?? null, description: workspace.description ?? null,
    },
    stats: { memberCount, activePlans, overdueCount, totalContributed: payments[0]?.total ?? 0 },
    upcoming: meetings.map((meeting) => ({ id: String(meeting._id), title: meeting.title, startsAt: meeting.starts_at })),
  };
}
