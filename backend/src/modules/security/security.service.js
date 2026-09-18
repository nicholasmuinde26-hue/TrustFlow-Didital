import SecurityEvent from './models/SecurityEvent.js';
import SecurityAlert from './models/SecurityAlert.js';
import SecurityIncident from './models/SecurityIncident.js';
import TrustProfile from './models/TrustProfile.js';
import PlatformAdmin from '../../models/PlatformAdmin.js';
import User from '../../models/User.js';
import { sendSecurityAlertEmail, isEmailChannelConfigured } from '../../services/notifications/email.service.js';
import { findUnbalancedOwners } from '../finance/accounting/glBalance.service.js';

// Recipients are every ACTIVE sub-admin scoped to the `security` category
// PLUS every Super Admin. Super Admins are stored on User.systemRole and
// deliberately never get a PlatformAdmin record (see admin.service.js —
// promoteToSubAdmin refuses to touch a super_admin), so a
// PlatformAdmin-only query misses them entirely. On a fresh deployment
// where no sub-admin has been appointed yet, that meant this query
// resolved to zero recipients and every security email silently
// vanished, even though the Super Admin is the one actually watching
// the console. Super Admins always implicitly have `security` console
// access (see CATEGORY_PROFILES / getMyAdminProfile), so they belong here.
const notifySecurityAdmins = async ({ title, summary, severity }) => {
  const [securityAdmins, superAdmins] = await Promise.all([
    PlatformAdmin.find({ category: 'security', status: 'ACTIVE' }).select('userId').lean(),
    User.find({ systemRole: 'super_admin' }).select('_id').lean(),
  ]);
  const userIds = [...new Set([...securityAdmins.map((admin) => String(admin.userId)), ...superAdmins.map((u) => String(u._id))])];
  const users = await User.find({ _id: { $in: userIds }, email: { $exists: true, $ne: null } }).select('name email').lean();
  if (!users.length) {
    console.warn(`Security notification "${title}" had no emailable recipient (found ${userIds.length} admin(s), ${users.length} with an email on file).`);
    return;
  }
  if (!isEmailChannelConfigured()) {
    console.warn(`Security notification "${title}" was not sent: no email channel is configured (set RESEND_API_KEY, or EMAIL_USER/EMAIL_PASS, or SMTP_HOST/SMTP_USER/SMTP_PASS).`);
    return;
  }
  const results = await Promise.allSettled(users.map((user) => sendSecurityAlertEmail({ to: user.email, name: user.name, title, summary, severity })));
  results.forEach((result, i) => {
    if (result.status === 'rejected' || result.value === null) console.error(`Security notification "${title}" failed to reach ${users[i].email}.`);
  });
};

const severityFor = (score) => score >= 85 ? 'CRITICAL' : score >= 65 ? 'HIGH' : score >= 35 ? 'MEDIUM' : 'LOW';
const decisionFor = (score) => score >= 85 ? 'HOLD' : score >= 65 ? 'MONITOR' : 'ALLOW';

// Velocity windows/thresholds used at ingest time to score the *current*
// event against very recent history. These are intentionally short and
// tight — they exist to catch a burst in progress (credential stuffing,
// OTP brute force, a script hammering one IP), not to summarize a day.
// The risk-signals dashboard below uses its own, longer windows for
// "what's been going on today" — the two are different questions.
const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_FAILURE_THRESHOLD = 3;
const OTP_RETRY_WINDOW_MS = 10 * 60 * 1000;
const OTP_RETRY_THRESHOLD = 2;
const HIGH_FREQUENCY_WINDOW_MS = 10 * 60 * 1000;
const HIGH_FREQUENCY_THRESHOLD = 8;

// Counts recent activity for the actor/IP on this event so `evaluate` can
// score bursts, not just single occurrences. A lone failed login is
// normal human behaviour; three from the same account (or five from the
// same IP against different accounts) in fifteen minutes is not.
async function computeVelocity(payload) {
  const actorId = payload.actor?.userId;
  const ip = payload.network?.ip;
  const since = (ms) => new Date(Date.now() - ms);
  const [loginFailuresByActor, loginFailuresByIp, otpFailuresByActor, ipFrequency] = await Promise.all([
    actorId ? SecurityEvent.countDocuments({ eventType: 'AUTH.LOGIN_FAILED', 'actor.userId': actorId, createdAt: { $gte: since(LOGIN_FAILURE_WINDOW_MS) } }) : 0,
    ip ? SecurityEvent.countDocuments({ eventType: 'AUTH.LOGIN_FAILED', 'network.ip': ip, createdAt: { $gte: since(LOGIN_FAILURE_WINDOW_MS) } }) : 0,
    actorId ? SecurityEvent.countDocuments({ eventType: 'AUTH.OTP_FAILED', 'actor.userId': actorId, createdAt: { $gte: since(OTP_RETRY_WINDOW_MS) } }) : 0,
    ip ? SecurityEvent.countDocuments({ 'network.ip': ip, createdAt: { $gte: since(HIGH_FREQUENCY_WINDOW_MS) } }) : 0,
  ]);
  return { loginFailuresByActor, loginFailuresByIp, otpFailuresByActor, ipFrequency };
}

function evaluate(payload, profile, velocity = {}) {
  const signals = [];
  const add = (code, label, contribution, confidence = 'HIGH') => signals.push({ code, label, contribution, confidence });
  const amount = Number(payload.transaction?.amount || 0);
  if (payload.device?.firstSeen) add('DEVICE.NEW', 'Action originated from a new device', 18);
  if (payload.metadata?.newRecipient) add('RECIPIENT.NEW', 'Payout destination is new', 22);
  if (amount >= 100000) add('AMOUNT.HIGH', `Amount of KES ${amount.toLocaleString()} exceeds high-risk threshold`, 20);
  if (payload.metadata?.recentRoleChange) add('ROLE.RECENT_CHANGE', 'Sensitive role changed recently', 20);
  if (payload.metadata?.recentPayoutAccountChange) add('ACCOUNT.RECENT_CHANGE', 'Payout account changed shortly before the action', 18);
  if (payload.metadata?.unusualHour) add('TIME.DEVIATION', 'Action occurred outside normal activity hours', 12, 'MEDIUM');
  if (payload.eventType === 'AUTH.LOGIN_FAILED') add('AUTH.LOGIN_FAILED', 'Login attempt failed', 8, 'LOW');
  if (payload.eventType === 'AUTH.OTP_FAILED') add('AUTH.OTP_FAILED', 'OTP verification failed', 10, 'LOW');
  if (profile?.knownDevices?.length && payload.device?.deviceId && !profile.knownDevices.includes(payload.device.deviceId)) add('DEVICE.UNKNOWN', 'Device is not associated with this user profile', 14);
  if (profile?.knownIps?.length && payload.network?.ip && !profile.knownIps.includes(payload.network.ip)) add('IP.UNKNOWN', 'Network address is not associated with this user profile', 12, 'MEDIUM');
  if (velocity.loginFailuresByActor >= LOGIN_FAILURE_THRESHOLD || velocity.loginFailuresByIp >= LOGIN_FAILURE_THRESHOLD + 2) add('VELOCITY.LOGIN_FAILURES', `${Math.max(velocity.loginFailuresByActor || 0, velocity.loginFailuresByIp || 0)} failed logins in the last 15 minutes`, 35);
  if (velocity.otpFailuresByActor >= OTP_RETRY_THRESHOLD) add('AUTH.OTP_RETRY', 'Repeated OTP failures preceded this action', 18);
  if (velocity.ipFrequency >= HIGH_FREQUENCY_THRESHOLD) add('VELOCITY.HIGH_FREQUENCY', `${velocity.ipFrequency} security-relevant events from this IP in 10 minutes`, 25, 'MEDIUM');
  const combinationBonus = signals.length >= 3 ? 12 : 0;
  if (combinationBonus) add('CORRELATION.COMBINATION', 'Multiple independent high-risk signals occurred together', combinationBonus);
  return { signals, riskScore: Math.min(100, signals.reduce((sum, s) => sum + s.contribution, 0)) };
}

export async function ingestEvent(payload) {
  const entityId = payload.actor?.userId ? String(payload.actor.userId) : null;
  const [profile, velocity] = await Promise.all([
    entityId ? TrustProfile.findOne({ entityType: 'USER', entityId }) : null,
    computeVelocity(payload),
  ]);
  const { signals, riskScore } = evaluate(payload, profile, velocity);
  const decision = decisionFor(riskScore);
  const event = await SecurityEvent.create({ ...payload, riskScore, decision, signals });
  if (payload.eventType === 'AUTH.LOGIN_FAILED') {
    notifySecurityAdmins({ title: 'Failed login detected', summary: `A login attempt failed from ${payload.network?.ip || 'an unknown IP'}. Reason: ${payload.metadata?.reason || 'not provided'}.`, severity: 'LOW' }).catch((error) => console.error('Security login notification failed:', error.message));
  }
  if (entityId) {
    const next = profile || new TrustProfile({ entityType: 'USER', entityId });
    next.riskScore = Math.round((next.riskScore * 0.7) + (riskScore * 0.3));
    next.trustState = decision === 'HOLD' ? 'RESTRICTED' : decision === 'MONITOR' ? 'ELEVATED' : 'NORMAL';
    if (payload.device?.deviceId && !next.knownDevices.includes(payload.device.deviceId)) next.knownDevices.push(payload.device.deviceId);
    if (payload.network?.ip && !next.knownIps.includes(payload.network.ip)) next.knownIps.push(payload.network.ip);
    next.lastEventAt = new Date(); await next.save();
  }
  let alert = null;
  if (riskScore >= 35) {
    const severity = severityFor(riskScore);
    const recommendedControl = decision === 'HOLD' ? 'Place the action on a security hold and require secondary authorization.' : 'Monitor this activity and verify the actor if further signals occur.';
    alert = await SecurityAlert.create({ title: `Suspicious ${payload.eventType.replaceAll('_', ' ').toLowerCase()}`, severity, riskScore, eventId: event._id, actorUserId: payload.actor?.userId, workspaceId: payload.workspace?.id, explanation: { summary: `${signals.length} independent signal${signals.length === 1 ? '' : 's'} raised risk to ${riskScore}/100.`, signals, recommendedControl }, relatedEntities: [{ type: 'USER', id: entityId, label: payload.actor?.role || 'Actor' }, ...(payload.device?.deviceId ? [{ type: 'DEVICE', id: payload.device.deviceId, label: payload.device.deviceId }] : [])] });
    notifySecurityAdmins({ title: alert.title, summary: alert.explanation.summary, severity }).catch((error) => console.error('Security alert notification failed:', error.message));
    if (severity === 'CRITICAL') await SecurityIncident.create({ number: `INV-${Date.now().toString().slice(-8)}`, title: alert.title, severity, alertId: alert._id, timeline: [{ event: 'Risk engine detected anomaly', detail: alert.explanation.summary }, { event: 'Automated response', detail: recommendedControl }] });
  }
  return { event, alert, decision, riskScore };
}

export async function commandCenter() {
  await syncLedgerIntegrityAlerts();
  const [openAlerts, critical, incidents, recentEvents, coverage] = await Promise.all([
    SecurityAlert.countDocuments({ status: 'OPEN' }), SecurityAlert.countDocuments({ status: 'OPEN', severity: 'CRITICAL' }),
    SecurityIncident.countDocuments({ status: { $ne: 'RESOLVED' } }), SecurityEvent.find().sort({ createdAt: -1 }).limit(12).lean(), SecurityEvent.distinct('eventType'),
  ]);
  return { platformTrust: Math.max(0, 100 - Math.min(45, openAlerts * 3 + critical * 7)), activeThreats: openAlerts, incidents, recentEvents, coverage: { authentication: coverage.some(x => x.startsWith('AUTH.')), payments: coverage.some(x => x.startsWith('PAYMENT.')), payouts: coverage.some(x => x.startsWith('PAYOUT.')), admin: coverage.some(x => x.startsWith('ADMIN.') || x.startsWith('ROLE.')) } };
}

async function syncLedgerIntegrityAlerts() {
  const owners = [...await findUnbalancedOwners('Chama'), ...await findUnbalancedOwners('ContributionGroup')];
  await Promise.all(owners.map(async (owner) => {
    const existing = await SecurityAlert.findOne({ status: { $in: ['OPEN', 'ACKNOWLEDGED'] }, 'explanation.signals.code': 'LEDGER.UNBALANCED', 'relatedEntities.id': owner.ownerId });
    if (existing) return;
    const event = await SecurityEvent.create({ eventType: 'SYSTEM.LEDGER_UNBALANCED', workspace: { type: owner.ownerType.toUpperCase(), id: owner.ownerId }, riskScore: 85, decision: 'HOLD', signals: [{ code: 'LEDGER.UNBALANCED', label: 'Ledger debits and credits do not balance', contribution: 85, confidence: 'HIGH' }], metadata: owner });
    const summary = `${owner.ownerType} ${owner.ownerId} has a ledger difference of KES ${owner.difference.toLocaleString()}.`;
    const alert = await SecurityAlert.create({ title: 'Unbalanced ledger detected', severity: 'CRITICAL', riskScore: 85, eventId: event._id, workspaceId: owner.ownerId, explanation: { summary, signals: event.signals, recommendedControl: 'Pause sensitive financial operations and reconcile the ledger before proceeding.' }, relatedEntities: [{ type: owner.ownerType, id: owner.ownerId, label: owner.ownerType }] });
    await notifySecurityAdmins({ title: alert.title, summary, severity: alert.severity });
  }));
}

// Dashboard window/thresholds — deliberately separate from the ingest-time
// velocity constants above. This answers "what does today look like",
// not "is a burst happening right now", so it looks back further and
// groups rather than gates a single event.
const DASHBOARD_WINDOW_MS = 24 * 60 * 60 * 1000;
const DASHBOARD_IP_EVENT_THRESHOLD = 10;
const DEVICE_IP_ANOMALY_CODES = ['DEVICE.NEW', 'DEVICE.UNKNOWN', 'IP.UNKNOWN'];
const FLAGGED_TRANSACTION_RISK_FLOOR = 35;

// Feeds the "inspect the system wholly for suspicious activity" view:
// failed logins, velocity anomalies, flagged transactions and
// device/IP anomalies, all read directly off SecurityEvent/TrustProfile
// so it reflects exactly what the risk engine has already scored —
// nothing here is recomputed or re-judged, only grouped for review.
export async function getRiskSignals() {
  await syncLedgerIntegrityAlerts();
  const since = new Date(Date.now() - DASHBOARD_WINDOW_MS);

  // Ledger integrity is computed directly from LedgerEntry, not read back
  // off SecurityEvent — those events (and their alerts) are also created
  // as a side effect for the alert feed, but a SYSTEM.LEDGER_UNBALANCED
  // event carries no `transaction.amount`, so it can never satisfy the
  // flaggedTransactions filter below. Computing it directly here means
  // this card is correct regardless of whether syncLedgerIntegrityAlerts
  // has already run for this owner.
  const [chamaImbalances, groupImbalances, failedLoginsTotal, otpFailuresTotal, failedLoginsByHour, ipActivity, velocityEvents, flaggedTransactions, deviceIpAnomalies, riskyProfiles] = await Promise.all([
    findUnbalancedOwners('Chama'),
    findUnbalancedOwners('ContributionGroup'),
    SecurityEvent.countDocuments({ eventType: 'AUTH.LOGIN_FAILED', createdAt: { $gte: since } }),
    SecurityEvent.countDocuments({ eventType: 'AUTH.OTP_FAILED', createdAt: { $gte: since } }),
    SecurityEvent.aggregate([
      { $match: { eventType: 'AUTH.LOGIN_FAILED', createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%dT%H:00:00Z', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    SecurityEvent.aggregate([
      { $match: { createdAt: { $gte: since }, 'network.ip': { $exists: true, $ne: null } } },
      { $group: {
        _id: '$network.ip',
        eventCount: { $sum: 1 },
        failedLogins: { $sum: { $cond: [{ $eq: ['$eventType', 'AUTH.LOGIN_FAILED'] }, 1, 0] } },
        actors: { $addToSet: '$actor.userId' },
        lastSeen: { $max: '$createdAt' },
      } },
      { $match: { eventCount: { $gte: DASHBOARD_IP_EVENT_THRESHOLD } } },
      { $sort: { eventCount: -1 } },
      { $limit: 10 },
    ]),
    SecurityEvent.find({
      createdAt: { $gte: since },
      signals: { $elemMatch: { code: { $in: ['VELOCITY.LOGIN_FAILURES', 'VELOCITY.HIGH_FREQUENCY', 'AUTH.OTP_RETRY'] } } },
    }).sort({ createdAt: -1 }).limit(20).select('eventType actor network riskScore decision signals createdAt').lean(),
    SecurityEvent.find({ 'transaction.amount': { $gt: 0 }, $or: [{ riskScore: { $gte: FLAGGED_TRANSACTION_RISK_FLOOR } }, { decision: { $in: ['MONITOR', 'HOLD', 'BLOCK'] } }] })
      .sort({ createdAt: -1 }).limit(15)
      .select('eventType transaction actor workspace riskScore decision signals createdAt')
      .lean(),
    SecurityEvent.find({ createdAt: { $gte: since }, signals: { $elemMatch: { code: { $in: DEVICE_IP_ANOMALY_CODES } } } })
      .sort({ createdAt: -1 }).limit(20)
      .select('eventType actor device network riskScore signals createdAt')
      .lean(),
    TrustProfile.find({ trustState: { $in: ['ELEVATED', 'RESTRICTED'] } }).sort({ riskScore: -1 }).limit(10).lean(),
  ]);

  const ledgerIntegrity = [...chamaImbalances, ...groupImbalances];

  return {
    window: { since, until: new Date(), hours: DASHBOARD_WINDOW_MS / 3_600_000 },
    ledgerIntegrity: { total: ledgerIntegrity.length, unbalancedOwners: ledgerIntegrity },
    failedLogins: {
      total: failedLoginsTotal,
      otpFailures: otpFailuresTotal,
      byHour: failedLoginsByHour.map((bucket) => ({ hour: bucket._id, count: bucket.count })),
    },
    velocityAnomalies: ipActivity.map((row) => ({
      ip: row._id,
      eventCount: row.eventCount,
      failedLogins: row.failedLogins,
      distinctActors: row.actors.filter(Boolean).length,
      lastSeen: row.lastSeen,
    })),
    velocityEvents,
    flaggedTransactions,
    deviceIpAnomalies,
    riskyProfiles,
  };
}

export const listAlerts = (query = {}) => SecurityAlert.find(query).sort({ createdAt: -1 }).limit(100).populate('eventId').lean();
export const getAlert = (id) => SecurityAlert.findById(id).populate('eventId').lean();
export async function respondToAlert(id, action, userId) { return SecurityAlert.findByIdAndUpdate(id, { $set: { status: action === 'resolve' ? 'RESOLVED' : 'ACKNOWLEDGED', response: { action, performedAt: new Date(), performedBy: userId } } }, { new: true }); }