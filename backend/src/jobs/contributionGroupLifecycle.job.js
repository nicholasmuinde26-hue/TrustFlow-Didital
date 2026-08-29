import ContributionGroup from '../models/ContributionGroup.js';
import ContributionGroupMember from '../models/ContributionGroupMember.js';
import ContributionPledge from '../models/ContributionPledge.js';
import ContributionObligation from '../models/ContributionObligation.js';
import PaymentIntent from '../models/PaymentIntent.js';
import ContributionReminder from '../models/ContributionReminder.js';
import Notification from '../models/Notification.js';

const DAY = 24 * 60 * 60 * 1000;
let timer = null;

async function notifyOnce({ group, recipientId, kind, key, message }) {
  try {
    const reminder = await ContributionReminder.create({ contribution_group_id: group._id, recipient_id: recipientId, kind, channel: 'in_app', message, status: 'sent', sent_at: new Date(), idempotency_key: key });
    await Notification.create({ user_id: recipientId, title: `Contribution group: ${group.name}`, message, category: 'system', link: `/workspace/${group._id}`, metadata: { type: 'contribution_group_lifecycle', reminder_id: reminder._id } });
  } catch (error) {
    if (error?.code !== 11000) throw error;
  }
}

async function groupOrganizers(groupId) {
  const memberships = await ContributionGroupMember.find({ contribution_group_id: groupId, status: 'active', role: { $in: ['organizer', 'co_organizer'] } }).select('user_id').lean();
  return memberships.map((m) => m.user_id);
}

async function hasUnresolvedItems(groupId) {
  const pledges = await ContributionPledge.find({ contribution_group_id: groupId, status: { $in: ['pledged', 'partially_paid'] } }).select('obligation_id').lean();
  const obligationIds = pledges.map((p) => p.obligation_id);
  const arrears = obligationIds.length ? await ContributionObligation.exists({ _id: { $in: obligationIds }, status: { $in: ['pending', 'partially_paid', 'overdue'] } }) : false;
  const pendingPayments = await PaymentIntent.exists({ owner_type: 'ContributionGroup', owner_id: groupId, status: { $in: ['pending', 'processing'] } });
  return Boolean(arrears || pendingPayments);
}

export async function runContributionGroupLifecycle() {
  const now = new Date();
  const groups = await ContributionGroup.find({ status: { $in: ['active', 'closing_review'] }, contribution_end_date: { $ne: null, $lte: new Date(now.getTime() + 14 * DAY) } });
  for (const group of groups) {
    const end = new Date(group.contribution_end_date); const days = Math.ceil((end - now) / DAY); const organizers = await groupOrganizers(group._id);
    for (const threshold of group.reminder_policy?.organizer_days_before || [14, 7, 3, 1]) {
      if (days === threshold) for (const organizerId of organizers) await notifyOnce({ group, recipientId: organizerId, kind: 'deadline', key: `deadline:${group._id}:${threshold}:${end.toISOString().slice(0, 10)}`, message: `${group.name} closes in ${threshold} day(s). Review pledges, arrears, or extend the contribution period.` });
    }
    if (days > 0) continue;
    if (group.status !== 'closing_review') { group.status = 'closing_review'; await group.save(); }
    const unresolved = await hasUnresolvedItems(group._id);
    const archiveAt = new Date(end.getTime() + (group.grace_period_days || 7) * DAY);
    const daysToArchive = Math.ceil((archiveAt - now) / DAY);
    if (daysToArchive === 3 || daysToArchive === 1) for (const organizerId of organizers) await notifyOnce({ group, recipientId: organizerId, kind: 'archival_warning', key: `archive-warning:${group._id}:${daysToArchive}:${archiveAt.toISOString().slice(0, 10)}`, message: `${group.name} is scheduled for archival in ${daysToArchive} day(s). Extend it if fundraising should continue.` });
    if (now < archiveAt) continue;
    if (unresolved) {
      for (const organizerId of organizers) await notifyOnce({ group, recipientId: organizerId, kind: 'arrears_summary', key: `arrears:${group._id}:${now.toISOString().slice(0, 10)}`, message: `${group.name} was not archived because it has outstanding pledges or pending payments.` });
      continue;
    }
    group.status = 'archived'; group.archived_at = now; group.archive_reason = 'auto_clean_close'; await group.save();
    for (const organizerId of organizers) await notifyOnce({ group, recipientId: organizerId, kind: 'close_review', key: `archived:${group._id}`, message: `${group.name} has been archived after a clean close-out. Its financial history remains available.` });
  }
}

export function startContributionGroupLifecycleJob() {
  if (timer) return timer;
  runContributionGroupLifecycle().catch((error) => console.error('[contribution-group-lifecycle] initial run failed', error));
  timer = setInterval(() => runContributionGroupLifecycle().catch((error) => console.error('[contribution-group-lifecycle] run failed', error)), DAY);
  return timer;
}
