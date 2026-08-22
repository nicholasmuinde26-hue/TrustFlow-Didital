import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import Meeting from '../../models/Meeting.js';
import Business from '../../models/Business.js';
import { getSummary } from '../business/business.service.js';
import AppError from '../../utils/AppError.js';
import mongoose from 'mongoose';

export async function getWorkspaceDashboard({ workspaceId, userId }) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError('Invalid workspace ID', 400);
  }

  // 1. Check if workspaceId is a Business
  const business = await Business.findOne({ _id: workspaceId, created_by: userId }).lean();
  if (business) {
    const summary = await getSummary(workspaceId, { _id: userId });
    return {
      type: 'business',
      workspace: {
        id: String(business._id),
        name: business.name,
        status: 'active',
        role: 'owner',
        category: business.category,
        currency: business.currency,
      },
      stats: {
        cashIn: summary?.dashboard?.cashIn || "0",
        cashOut: summary?.dashboard?.cashOut || "0",
        netCash: summary?.dashboard?.netCash || "0",
        totalContributed: summary?.dashboard?.cashIn || "0",
      },
      upcoming: [],
    };
  }

  // 2. Check Chama & Contribution Group memberships & owner fallbacks
  let [chamaMembership, groupMembership] = await Promise.all([
    ChamaMembership.findOne({ chama_id: workspaceId, user_id: userId, status: 'active' }).lean(),
    ContributionGroupMember.findOne({ contribution_group_id: workspaceId, user_id: userId, status: 'active' }).lean(),
  ]);

  if (!chamaMembership && !groupMembership) {
    const chamaCreated = await Chama.findOne({ _id: workspaceId, created_by: userId }).lean();
    if (chamaCreated) {
      chamaMembership = { chama_id: workspaceId, user_id: userId, role: 'admin', status: 'active' };
    }
  }

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
  const [memberCount, activePlans, overdueCount, payments, meetings, topContributorAgg, paidMembersCountAgg, activePlanObj] = await Promise.all([
    type === 'chama' ? ChamaMembership.countDocuments(memberFilter) : ContributionGroupMember.countDocuments(memberFilter),
    ContributionPlan.countDocuments({ ...ownerFilter, status: 'active' }),
    ContributionObligation.countDocuments({ ...ownerFilter, status: { $in: ['pending', 'partially_paid', 'overdue'] }, due_date: { $lt: now } }),
    ContributionPayment.aggregate([
      { $match: { ...ownerFilter, status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]),
    Meeting.find({ workspace_id: workspaceId, cancelled_at: null, starts_at: { $gte: now } }).sort({ starts_at: 1 }).limit(3).lean(),
    ContributionPayment.aggregate([
      { $match: { ...ownerFilter, status: 'completed' } },
      { $group: { _id: '$user_id', total: { $sum: { $toDouble: '$amount' } } } },
      { $sort: { total: -1 } },
      { $limit: 1 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    ]),
    ContributionPayment.aggregate([
      { $match: { ...ownerFilter, status: 'completed' } },
      { $group: { _id: '$user_id' } },
      { $count: 'paidCount' },
    ]),
    ContributionPlan.findOne({ ...ownerFilter, status: 'active' }).lean(),
  ]);

  let topContributor = null;
  if (topContributorAgg && topContributorAgg.length > 0) {
    const top = topContributorAgg[0];
    topContributor = {
      name: top.user ? `${top.user.first_name || ''} ${top.user.last_name || ''}`.trim() || top.user.email : 'Member',
      amount: top.total || 0,
    };
  }

  const totalContributed = payments[0]?.total ?? 0;
  const paidCount = paidMembersCountAgg[0]?.paidCount ?? (totalContributed > 0 ? 1 : 0);

  // Calculate daysLeft if eventDate exists
  let daysLeft = null;
  if (workspace.event_date) {
    const diff = new Date(workspace.event_date).getTime() - now.getTime();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  // Calculate target goal
  const targetGoal = activePlanObj?.target_amount || activePlanObj?.amount_per_member * (memberCount || 1) || 100000;

  return {
    type,
    workspace: {
      id: String(workspace._id), name: workspace.name, status: workspace.status, role: membership.role || 'member',
      monthlySavings: workspace.monthly_savings ?? null, eventDate: workspace.event_date ?? null,
      location: workspace.location ?? null, description: workspace.description ?? null,
      targetGoal, daysLeft, topContributor,
    },
    stats: { memberCount, activePlans, overdueCount, totalContributed, paidCount },
    upcoming: meetings.map((meeting) => ({ id: String(meeting._id), title: meeting.title, startsAt: meeting.starts_at })),
  };
}

