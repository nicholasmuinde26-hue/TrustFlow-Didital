import crypto from 'node:crypto';

import User from '../../models/User.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Invoice from '../../models/Invoice.js';
import Subscription from '../../models/Subscription.js';
import PlatformAdmin from '../../models/PlatformAdmin.js';
import PlatformAdminAuditLog from '../../models/PlatformAdminAuditLog.js';
import SupportCase from '../../models/SupportCase.js';
import SupportNote from '../../models/SupportNote.js';
import AppError from '../../utils/AppError.js';
import { FREE_PLAN } from '../../constants/billing.constants.js';
import { addDays, addMonths, computeAccess, nextPeriodStart } from '../billing/billing.logic.js';
import {
  getEntitlement,
  getPlan,
  getOrCreateSubscription,
  invalidateEntitlement,
  listPlans,
} from '../billing/billingEntitlement.service.js';
import { applyPaidInvoiceToSubscription } from '../billing/billingPayment.service.js';
import { generateAndSendOtp } from '../auth/auth.service.js';

/**
 * Platform support: billing help per chama, the payments-needing-review
 * queue, user account tools, and internal notes/cases.
 *
 * Every state change here writes a PlatformAdminAuditLog row (append-only)
 * with the reason the admin gave.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const escapeRegex = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));
const pageArgs = (page, limit, max = 100) => {
  const size = Math.min(max, Math.max(1, Number(limit) || 25));
  const current = Math.max(1, Number(page) || 1);
  return { size, current, skip: (current - 1) * size };
};

const needReason = (reason) => {
  const text = String(reason || '').trim();
  if (text.length < 10) throw new AppError('Give a reason of at least 10 characters. It is saved in the audit trail.', 400);
  return text.slice(0, 500);
};

const audit = ({ actor, targetUserId = null, action, before = null, after = null, metadata = null }) =>
  PlatformAdminAuditLog.create({
    actorUserId: actor._id,
    targetUserId,
    action,
    category: 'support',
    before,
    after,
    metadata,
  });

const maskPhone = (phone) => (phone ? `${String(phone).slice(0, 6)}***${String(phone).slice(-2)}` : null);

const presentAttempt = (a) => ({
  _id: a._id,
  status: a.status,
  amount: a.amount,
  phone: maskPhone(a.phone),
  mpesa_receipt: a.mpesa_receipt,
  result_desc: a.result_desc,
  at: a.updatedAt || a.createdAt,
});

const presentInvoice = (inv) => ({
  _id: inv._id,
  number: inv.number,
  chama_id: inv.chama_id?._id || inv.chama_id,
  chama_name: inv.chama_id?.name,
  plan_code: inv.plan_code,
  plan_name: inv.plan_name,
  months: inv.months,
  base_amount: inv.base_amount,
  credit: inv.credit,
  amount: inv.amount,
  status: inv.status,
  paid_at: inv.paid_at,
  period_start: inv.period_start,
  period_end: inv.period_end,
  mpesa_receipt: inv.mpesa_receipt,
  needs_review: inv.needs_review,
  review: inv.review || null,
  created_at: inv.createdAt,
  attempts: (inv.attempts || []).map(presentAttempt),
});

const subjectLabel = async (type, id) => {
  if (!isId(id)) throw new AppError('Invalid subject id', 400);
  if (type === 'user') {
    const user = await User.findById(id).select('name phone').lean();
    if (!user) throw new AppError('User not found', 404);
    return user.name || user.phone;
  }
  if (type === 'chama') {
    const chama = await Chama.findById(id).select('name').lean();
    if (!chama) throw new AppError('Chama not found', 404);
    return chama.name;
  }
  throw new AppError('subject_type must be "user" or "chama"', 400);
};

// ---------------------------------------------------------------------------
// overview (counters for the nav badge and hub header)
// ---------------------------------------------------------------------------

export async function getSupportOverview(actor) {
  const [openCases, myOpenCases, urgentCases, reviewInvoices] = await Promise.all([
    SupportCase.countDocuments({ status: { $in: ['open', 'pending'] } }),
    SupportCase.countDocuments({ status: { $in: ['open', 'pending'] }, assignee_id: actor._id }),
    SupportCase.countDocuments({ status: { $in: ['open', 'pending'] }, priority: 'urgent' }),
    Invoice.countDocuments({ needs_review: true }),
  ]);
  return { openCases, myOpenCases, urgentCases, reviewInvoices };
}

// ---------------------------------------------------------------------------
// 1. BILLING SUPPORT PER CHAMA
// ---------------------------------------------------------------------------

export async function searchChamas({ query = '' }) {
  const term = String(query).trim();
  const filter = term ? { name: { $regex: escapeRegex(term), $options: 'i' } } : {};
  const chamas = await Chama.find(filter).select('name chama_type createdAt').sort({ createdAt: -1 }).limit(20).lean();
  const subs = await Subscription.find({ chama_id: { $in: chamas.map((c) => c._id) } }).lean();
  const byChama = new Map(subs.map((s) => [String(s.chama_id), s]));
  return chamas.map((c) => {
    const sub = byChama.get(String(c._id));
    const access = sub ? computeAccess(sub) : null;
    return {
      _id: c._id,
      name: c.name,
      chama_type: c.chama_type,
      plan_code: sub?.plan_code || null,
      state: access?.state || null,
      access_until: access?.access_until || null,
    };
  });
}

export async function getChamaBilling(chamaId) {
  if (!isId(chamaId)) throw new AppError('Invalid chama id', 400);
  const chama = await Chama.findById(chamaId).select('name chama_type createdAt').lean();
  if (!chama) throw new AppError('Chama not found', 404);

  const { subscription, plan, access } = await getEntitlement(chamaId);
  const [invoices, activeMembers, plans, openCases, leaders] = await Promise.all([
    Invoice.find({ chama_id: chamaId }).sort({ createdAt: -1 }).limit(40).lean(),
    ChamaMembership.countDocuments({ chama_id: chamaId, status: 'active' }),
    listPlans({ includeInactive: false }),
    SupportCase.countDocuments({ subject_type: 'chama', subject_id: chamaId, status: { $in: ['open', 'pending'] } }),
    ChamaMembership.find({ chama_id: chamaId, status: 'active', role: { $in: ['chairperson', 'treasurer'] } })
      .populate('user_id', 'name phone')
      .lean(),
  ]);

  return {
    chama: { _id: chama._id, name: chama.name, chama_type: chama.chama_type, created_at: chama.createdAt },
    subscription: {
      plan_code: subscription.plan_code,
      plan_name: plan?.name,
      status: subscription.status,
      state: access.state,
      days_left: access.days_left,
      grace_days_left: access.grace_days_left,
      access_until: access.access_until,
      grace_until: access.grace_until,
      trial_ends_at: subscription.trial_ends_at,
      current_period_end: subscription.current_period_end,
      last_paid_at: subscription.last_paid_at,
      price_overrides: subscription.price_overrides || {},
      price_monthly: plan?.price_monthly ?? 0,
      list_price_monthly: plan?.list_price_monthly ?? null,
      max_members: plan?.max_members ?? null,
      grants: [...(subscription.support_grants || [])].reverse().slice(0, 15),
    },
    members: { active: activeMembers },
    leaders: leaders
      .filter((m) => m.user_id)
      .map((m) => ({ user_id: m.user_id._id, name: m.user_id.name, phone: m.user_id.phone, role: m.role })),
    plans: plans.map((p) => ({ code: p.code, name: p.name, price_monthly: p.price_monthly, max_members: p.max_members })),
    invoices: invoices.map(presentInvoice),
    open_cases: openCases,
  };
}

const grantEntry = (actor, fields) => ({ ...fields, granted_by: actor._id, granted_at: new Date() });

/** Add days of access on top of whatever the chama has now (or from today if it lapsed). */
export async function extendAccess(chamaId, { days, reason }, actor) {
  const why = needReason(reason);
  const n = Number(days);
  if (!Number.isInteger(n) || n < 1 || n > 90) throw new AppError('Extend by a whole number of days, 1 to 90', 400);

  const sub = await getOrCreateSubscription(chamaId);
  if (sub.plan_code === FREE_PLAN && sub.status === 'active') {
    throw new AppError('The Free plan has no expiry to extend. Use "Comp a plan" to give a paid plan for a set time.', 400);
  }

  const now = new Date();
  const field = sub.status === 'trialing' ? 'trial_ends_at' : 'current_period_end';
  const base = sub[field] && new Date(sub[field]) > now ? new Date(sub[field]) : now;
  const until = addDays(base, n);

  const update = { $set: { [field]: until } };
  if (field === 'current_period_end' && !sub.current_period_start) update.$set.current_period_start = now;
  update.$push = { support_grants: grantEntry(actor, { kind: 'extend', days: n, reason: why, plan_code: sub.plan_code, access_until_after: until }) };
  await Subscription.updateOne({ chama_id: chamaId }, update);
  invalidateEntitlement(chamaId);

  await audit({
    actor, action: 'SUPPORT_EXTEND_ACCESS',
    before: { [field]: sub[field] || null }, after: { [field]: until },
    metadata: { chamaId, days: n, reason: why },
  });
  return getChamaBilling(chamaId);
}

/** Give a paid plan for N months at no charge. Never creates an invoice, so it is never counted as revenue. */
export async function compPlan(chamaId, { plan_code: planCode, months, reason }, actor) {
  const why = needReason(reason);
  const code = String(planCode || '').toLowerCase().trim();
  const plan = await getPlan(code);
  if (!plan || !plan.is_active || code === FREE_PLAN) throw new AppError('Choose an active paid plan', 400);
  const m = Number(months);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw new AppError('Comp for 1 to 12 months', 400);

  const sub = await getOrCreateSubscription(chamaId);
  const now = new Date();
  const start = nextPeriodStart({ sub, invoicePlanCode: code, now });
  const end = addMonths(start, m);

  await Subscription.updateOne(
    { chama_id: chamaId },
    {
      $set: { plan_code: code, status: 'active', current_period_start: start, current_period_end: end },
      $push: { support_grants: grantEntry(actor, { kind: 'comp', plan_code: code, months: m, reason: why, access_until_after: end }) },
    }
  );
  invalidateEntitlement(chamaId);

  await audit({
    actor, action: 'SUPPORT_COMP_PLAN',
    before: { plan_code: sub.plan_code, status: sub.status, current_period_end: sub.current_period_end || null },
    after: { plan_code: code, status: 'active', current_period_end: end },
    metadata: { chamaId, months: m, reason: why },
  });
  return getChamaBilling(chamaId);
}

/** Move a chama to another plan without payment, keeping its current dates. */
export async function changePlan(chamaId, { plan_code: planCode, reason }, actor) {
  const why = needReason(reason);
  const code = String(planCode || '').toLowerCase().trim();
  const plan = await getPlan(code);
  if (!plan || !plan.is_active) throw new AppError('Choose an active plan', 400);

  const sub = await getOrCreateSubscription(chamaId);
  if (sub.plan_code === code) throw new AppError('The chama is already on that plan', 400);

  const set = { plan_code: code };
  if (code === FREE_PLAN) {
    Object.assign(set, { status: 'active', current_period_start: null, current_period_end: null });
  } else {
    const until = sub.status === 'trialing' ? sub.trial_ends_at : sub.current_period_end;
    if (!until) {
      throw new AppError('This chama has no paid or trial period to carry over. Use "Comp a plan" to give a paid plan for a set time.', 400);
    }
  }

  await Subscription.updateOne(
    { chama_id: chamaId },
    { $set: set, $push: { support_grants: grantEntry(actor, { kind: 'plan_change', plan_code: code, reason: why }) } }
  );
  if (code === FREE_PLAN) await Invoice.updateMany({ chama_id: chamaId, status: 'open' }, { $set: { status: 'void' } });
  invalidateEntitlement(chamaId);

  const active = await ChamaMembership.countDocuments({ chama_id: chamaId, status: 'active' });
  const warning = plan.max_members && active > plan.max_members
    ? `This chama has ${active} active members and the ${plan.name} plan allows ${plan.max_members}. Nobody is removed, but no new members can be added.`
    : null;

  await audit({
    actor, action: 'SUPPORT_CHANGE_PLAN',
    before: { plan_code: sub.plan_code }, after: { plan_code: code },
    metadata: { chamaId, reason: why },
  });
  return { ...(await getChamaBilling(chamaId)), warning };
}

// ---------------------------------------------------------------------------
// 2. PAYMENTS NEEDING REVIEW
// ---------------------------------------------------------------------------

const classifyReview = (inv) => {
  const attempts = inv.attempts || [];
  if (attempts.some((a) => a.status === 'duplicate')) return 'double_payment';
  if (attempts.some((a) => String(a.result_desc || '').startsWith('Underpaid'))) return 'underpayment';
  return 'other';
};

export async function listReviewQueue({ resolved = 'false', page = 1, limit = 25 } = {}) {
  const { size, current, skip } = pageArgs(page, limit);
  const filter = resolved === 'true'
    ? { 'review.resolution': { $exists: true } }
    : { needs_review: true };

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate('chama_id', 'name')
      .sort(resolved === 'true' ? { 'review.resolved_at': -1 } : { updatedAt: -1 })
      .skip(skip).limit(size).lean(),
    Invoice.countDocuments(filter),
  ]);

  return {
    total, page: current, limit: size,
    items: items.map((inv) => ({ ...presentInvoice(inv), issue: classifyReview(inv) })),
  };
}

const loadReviewInvoice = async (invoiceId) => {
  if (!isId(invoiceId)) throw new AppError('Invalid invoice id', 400);
  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
};

const RECEIPT_RE = /^[A-Z0-9]{8,12}$/;

/** The customer paid and the system missed it (or underpaid then topped up): record it against the invoice. */
export async function markInvoicePaidByReceipt(invoiceId, { receipt, amount, reason }, actor) {
  const why = needReason(reason);
  const code = String(receipt || '').trim().toUpperCase();
  if (!RECEIPT_RE.test(code)) throw new AppError('Enter the M-Pesa receipt exactly as in the confirmation SMS (8 to 12 letters and numbers).', 400);

  const invoice = await loadReviewInvoice(invoiceId);
  if (invoice.status === 'paid') throw new AppError('This invoice is already paid.', 409);

  const received = Number(amount);
  if (!Number.isFinite(received) || received < invoice.amount) {
    throw new AppError(`The amount received must be at least the invoice amount (KES ${invoice.amount}). To give a discount, use "Comp a plan" instead.`, 400);
  }

  const clash = await Invoice.findOne({
    _id: { $ne: invoice._id },
    $or: [{ mpesa_receipt: code }, { 'attempts.mpesa_receipt': code }],
  }).select('number').lean();
  if (clash) throw new AppError(`Receipt ${code} is already recorded on invoice ${clash.number}.`, 409);

  const now = new Date();
  // Same atomic claim the M-Pesa callback uses: only one caller can move an invoice to paid.
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoice._id, status: { $in: ['open', 'void'] } },
    {
      $set: {
        status: 'paid', paid_at: now, mpesa_receipt: code, needs_review: false,
        review: { resolution: 'marked_paid', note: why, reference: code, resolved_by: actor._id, resolved_at: now },
      },
      $push: {
        attempts: {
          amount: received, status: 'completed', mpesa_receipt: code,
          result_desc: 'Marked paid by platform support', initiated_by: actor._id,
        },
      },
    },
    { returnDocument: 'after' }
  );
  if (!claimed) throw new AppError('This invoice was settled a moment ago. Refresh and check.', 409);

  const { start, end } = await applyPaidInvoiceToSubscription(claimed, now);

  await audit({
    actor, action: 'SUPPORT_MARK_INVOICE_PAID',
    before: { status: invoice.status, needs_review: invoice.needs_review },
    after: { status: 'paid', receipt: code, period_start: start, period_end: end },
    metadata: { invoiceId: invoice._id, invoiceNumber: invoice.number, chamaId: invoice.chama_id, amountReceived: received, reason: why },
  });
  return presentInvoice(await Invoice.findById(invoice._id).populate('chama_id', 'name').lean());
}

/** Close a flagged payment without marking it paid: refunded outside the system, credited as extra time, or dismissed. */
export async function resolveReview(invoiceId, { resolution, note, reference }, actor) {
  const why = needReason(note);
  if (!['refunded', 'credited', 'dismissed'].includes(resolution)) {
    throw new AppError('resolution must be refunded, credited or dismissed', 400);
  }
  const invoice = await loadReviewInvoice(invoiceId);
  if (!invoice.needs_review) throw new AppError('This payment is not waiting for review.', 409);

  const ref = String(reference || '').trim().toUpperCase().slice(0, 40) || null;
  if (resolution === 'refunded' && !ref) throw new AppError('Enter the reversal or refund reference so the refund can be traced.', 400);

  if (resolution === 'credited' && (invoice.status !== 'paid' || !invoice.attempts.some((a) => a.status === 'duplicate'))) {
    throw new AppError('Only a double payment on a paid invoice can be credited as extra time.', 400);
  }

  // Claim first, on needs_review, so two admins can't both resolve (and both credit) the same item.
  const claim = await Invoice.updateOne(
    { _id: invoice._id, needs_review: true },
    { $set: { needs_review: false, review: { resolution, note: why, reference: ref, resolved_by: actor._id, resolved_at: new Date() } } }
  );
  if (!claim.modifiedCount) throw new AppError('Someone else just resolved this payment.', 409);

  let creditedUntil = null;
  if (resolution === 'credited') {
    try {
      const sub = await getOrCreateSubscription(invoice.chama_id);
      const now = new Date();
      const field = sub.status === 'trialing' ? 'trial_ends_at' : 'current_period_end';
      const base = sub[field] && new Date(sub[field]) > now ? new Date(sub[field]) : now;
      creditedUntil = addMonths(base, invoice.months);
      await Subscription.updateOne(
        { chama_id: invoice.chama_id },
        {
          $set: { [field]: creditedUntil },
          $push: { support_grants: grantEntry(actor, { kind: 'extend', months: invoice.months, plan_code: sub.plan_code, reason: `Double payment on ${invoice.number}: ${why}`, access_until_after: creditedUntil }) },
        }
      );
      invalidateEntitlement(invoice.chama_id);
    } catch (error) {
      // Crediting failed: put the item back in the queue rather than lose it.
      await Invoice.updateOne({ _id: invoice._id }, { $set: { needs_review: true }, $unset: { review: 1 } });
      throw error;
    }
  }

  await audit({
    actor, action: `SUPPORT_REVIEW_${resolution.toUpperCase()}`,
    before: { needs_review: true }, after: { needs_review: false, resolution, reference: ref, credited_until: creditedUntil },
    metadata: { invoiceId: invoice._id, invoiceNumber: invoice.number, chamaId: invoice.chama_id, note: why },
  });
  return presentInvoice(await Invoice.findById(invoice._id).populate('chama_id', 'name').lean());
}

// ---------------------------------------------------------------------------
// 3. USER SUPPORT TOOLS
// ---------------------------------------------------------------------------

export async function searchUsers({ query = '', page = 1, limit = 20 }) {
  const { size, current, skip } = pageArgs(page, limit, 50);
  const term = String(query).trim();
  const filter = term
    ? {
        $or: [
          { name: { $regex: escapeRegex(term), $options: 'i' } },
          { phone: { $regex: escapeRegex(term), $options: 'i' } },
          { email: { $regex: escapeRegex(term), $options: 'i' } },
        ],
      }
    : {};
  const [users, total] = await Promise.all([
    User.find(filter).select('name phone email status systemRole isPhoneVerified createdAt').sort({ createdAt: -1 }).skip(skip).limit(size).lean(),
    User.countDocuments(filter),
  ]);
  return { users, total, page: current, limit: size };
}

export async function getUserSupportProfile(userId) {
  if (!isId(userId)) throw new AppError('Invalid user id', 400);
  const user = await User.findById(userId).select('+refreshToken +otpExpiresAt +otpAttempts +ussd_failed_pin_attempts +ussd_pin_locked_until').lean();
  if (!user) throw new AppError('User not found', 404);

  const now = new Date();
  const memberships = await ChamaMembership.find({ user_id: userId, status: { $ne: 'removed' } })
    .populate('chama_id', 'name chama_type').lean();
  const subs = await Subscription.find({ chama_id: { $in: memberships.map((m) => m.chama_id?._id).filter(Boolean) } }).lean();
  const subBy = new Map(subs.map((s) => [String(s.chama_id), s]));

  const [openCases, noteCount] = await Promise.all([
    SupportCase.countDocuments({ subject_type: 'user', subject_id: userId, status: { $in: ['open', 'pending'] } }),
    SupportNote.countDocuments({ subject_type: 'user', subject_id: userId, kind: 'note' }),
  ]);

  const ussdLockedUntil = user.ussd_pin_locked_until && new Date(user.ussd_pin_locked_until) > now ? user.ussd_pin_locked_until : null;
  const otpBurned = Number(user.otpAttempts || 0) > 0;

  return {
    user: {
      _id: user._id, name: user.name, phone: user.phone, email: user.email,
      status: user.status, systemRole: user.systemRole,
      isPhoneVerified: user.isPhoneVerified, createdAt: user.createdAt,
    },
    security: {
      has_active_session: Boolean(user.refreshToken),
      ussd_pin_set: Boolean(user.ussd_pin_set_at),
      ussd_locked_until: ussdLockedUntil,
      ussd_failed_attempts: Number(user.ussd_failed_pin_attempts || 0),
      otp_failed_attempts: Number(user.otpAttempts || 0),
      otp_pending: Boolean(user.otpExpiresAt && new Date(user.otpExpiresAt) > now),
      is_locked: Boolean(ussdLockedUntil) || otpBurned || Number(user.ussd_failed_pin_attempts || 0) > 0,
      last_force_logout: user.tokensValidAfter || null,
    },
    chamas: memberships
      .filter((m) => m.chama_id)
      .map((m) => {
        const sub = subBy.get(String(m.chama_id._id));
        return {
          chama_id: m.chama_id._id, name: m.chama_id.name, chama_type: m.chama_id.chama_type,
          role: m.role, status: m.status,
          plan_code: sub?.plan_code || null, billing_state: sub ? computeAccess(sub).state : null,
        };
      }),
    open_cases: openCases,
    note_count: noteCount,
  };
}

const loadSupportTarget = async (userId, actor) => {
  if (!isId(userId)) throw new AppError('Invalid user id', 400);
  const target = await User.findById(userId).select('+refreshToken +otpCodeHash +otpExpiresAt +otpAttempts +ussd_failed_pin_attempts +ussd_pin_locked_until');
  if (!target) throw new AppError('User not found', 404);
  // Support staff act on ordinary accounts. Touching an admin account is the Super Admin's call.
  if (target.systemRole !== 'user' && actor.systemRole !== 'super_admin') {
    throw new AppError('Only the Super Admin can run support tools on an admin account.', 403);
  }
  return target;
};

/** Clear a USSD PIN lockout and any used-up OTP attempts so the user can try again. Does not lift a suspension. */
export async function unlockUser(userId, { reason }, actor) {
  const why = needReason(reason);
  const target = await loadSupportTarget(userId, actor);
  const before = {
    ussd_failed_attempts: target.ussd_failed_pin_attempts || 0,
    ussd_locked_until: target.ussd_pin_locked_until || null,
    otp_failed_attempts: target.otpAttempts || 0,
  };
  target.ussd_failed_pin_attempts = 0;
  target.ussd_pin_locked_until = null;
  target.otpAttempts = 0;
  target.otpCodeHash = undefined;
  target.otpExpiresAt = undefined;
  await target.save();

  await audit({
    actor, targetUserId: target._id, action: 'SUPPORT_UNLOCK_USER',
    before, after: { ussd_failed_attempts: 0, ussd_locked_until: null, otp_failed_attempts: 0 },
    metadata: { reason: why, accountStatus: target.status },
  });
  return getUserSupportProfile(userId);
}

/** End every session now: the refresh token is cleared and older access tokens stop working immediately. */
export async function forceLogoutUser(userId, { reason }, actor) {
  const why = needReason(reason);
  const target = await loadSupportTarget(userId, actor);
  if (String(target._id) === String(actor._id)) throw new AppError('Use Sign out for your own account.', 400);

  target.refreshToken = undefined;
  target.tokensValidAfter = new Date();
  await target.save();

  await audit({
    actor, targetUserId: target._id, action: 'SUPPORT_FORCE_LOGOUT',
    before: null, after: { tokensValidAfter: target.tokensValidAfter },
    metadata: { reason: why },
  });
  return getUserSupportProfile(userId);
}

/** Send a fresh verification code to an unverified user. The code itself is never returned. */
export async function resendVerification(userId, { reason, channel }, actor) {
  const why = needReason(reason);
  const target = await loadSupportTarget(userId, actor);
  if (target.isPhoneVerified && target.status !== 'unverified') {
    throw new AppError('This account is already verified.', 400);
  }
  if (target.status === 'suspended' || target.status === 'inactive') {
    throw new AppError('This account is not active. Resolve the account status before sending a code.', 400);
  }

  // One send a minute per user, whoever asks, so support cannot be used to spam a phone.
  const recent = await PlatformAdminAuditLog.findOne({
    targetUserId: target._id, action: 'SUPPORT_RESEND_VERIFICATION', createdAt: { $gte: new Date(Date.now() - 60_000) },
  }).lean();
  if (recent) throw new AppError('A code was just sent to this user. Wait a minute before sending another.', 429);

  const allowed = ['sms', 'email', 'whatsapp'];
  const sent = await generateAndSendOtp(target, allowed.includes(channel) ? channel : undefined);

  await audit({
    actor, targetUserId: target._id, action: 'SUPPORT_RESEND_VERIFICATION',
    metadata: { reason: why, channel: sent.channel },
  });
  return { channel: sent.channel, expires_in_minutes: sent.expiryMinutes };
}

// ---------------------------------------------------------------------------
// 4. NOTES AND CASES
// ---------------------------------------------------------------------------

const presentNote = (n) => ({
  _id: n._id, kind: n.kind, body: n.body, pinned: n.pinned, case_id: n.case_id,
  subject_type: n.subject_type, subject_id: n.subject_id,
  author: n.author_id ? { _id: n.author_id._id, name: n.author_id.name } : null,
  created_at: n.createdAt,
});

export async function listNotes({ subject_type: type, subject_id: id, case_id: caseId }) {
  const filter = {};
  if (caseId) {
    if (!isId(caseId)) throw new AppError('Invalid case id', 400);
    filter.case_id = caseId;
  } else {
    if (!['user', 'chama'].includes(type) || !isId(id)) throw new AppError('subject_type and subject_id are required', 400);
    filter.subject_type = type;
    filter.subject_id = id;
  }
  const notes = await SupportNote.find(filter).populate('author_id', 'name').sort({ pinned: -1, createdAt: -1 }).limit(200).lean();
  return notes.map(presentNote);
}

export async function addNote({ subject_type: type, subject_id: id, case_id: caseId, body, pinned }, actor) {
  const text = String(body || '').trim();
  if (!text) throw new AppError('Write something in the note', 400);

  let subjectType = type;
  let subjectId = id;
  if (caseId) {
    if (!isId(caseId)) throw new AppError('Invalid case id', 400);
    const supportCase = await SupportCase.findById(caseId).lean();
    if (!supportCase) throw new AppError('Case not found', 404);
    subjectType = supportCase.subject_type;
    subjectId = supportCase.subject_id;
  } else {
    await subjectLabel(subjectType, subjectId);
  }

  const note = await SupportNote.create({
    subject_type: subjectType, subject_id: subjectId, case_id: caseId || null,
    body: text, pinned: Boolean(pinned), author_id: actor._id,
  });
  if (caseId) await SupportCase.updateOne({ _id: caseId }, { $set: { updatedAt: new Date() } });
  return presentNote(await SupportNote.findById(note._id).populate('author_id', 'name').lean());
}

export async function setNotePinned(noteId, pinned) {
  if (!isId(noteId)) throw new AppError('Invalid note id', 400);
  const note = await SupportNote.findOneAndUpdate({ _id: noteId, kind: 'note' }, { $set: { pinned: Boolean(pinned) } }, { returnDocument: 'after' })
    .populate('author_id', 'name').lean();
  if (!note) throw new AppError('Note not found', 404);
  return presentNote(note);
}

const caseNumber = () => {
  const d = new Date();
  const ym = `${String(d.getUTCFullYear()).slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `CASE-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

const presentCase = (c) => ({
  _id: c._id, number: c.number, title: c.title,
  subject_type: c.subject_type, subject_id: c.subject_id, subject_label: c.subject_label,
  category: c.category, priority: c.priority, status: c.status,
  assignee: c.assignee_id ? { _id: c.assignee_id._id, name: c.assignee_id.name } : null,
  created_by: c.created_by ? { _id: c.created_by._id, name: c.created_by.name } : null,
  invoice_id: c.invoice_id || null,
  resolution: c.resolution, resolved_at: c.resolved_at,
  created_at: c.createdAt, updated_at: c.updatedAt,
});

const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2, low: 3 };

export async function listCases({ status, priority, category, assignee, subject_type: type, subject_id: id, query, page = 1, limit = 25 }, actor) {
  const { size, current, skip } = pageArgs(page, limit);
  const filter = {};
  if (status === 'active') filter.status = { $in: ['open', 'pending'] };
  else if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (category) filter.category = category;
  if (assignee === 'me') filter.assignee_id = actor._id;
  else if (assignee === 'unassigned') filter.assignee_id = null;
  else if (isId(assignee)) filter.assignee_id = assignee;
  if (type && isId(id)) { filter.subject_type = type; filter.subject_id = id; }
  const term = String(query || '').trim();
  if (term) {
    const rx = { $regex: escapeRegex(term), $options: 'i' };
    filter.$or = [{ title: rx }, { number: rx }, { subject_label: rx }];
  }

  const [rows, total] = await Promise.all([
    SupportCase.find(filter).populate('assignee_id created_by', 'name').sort({ updatedAt: -1 }).skip(skip).limit(size).lean(),
    SupportCase.countDocuments(filter),
  ]);
  const items = rows.map(presentCase);
  // Within a page, urgent work floats up; the page itself is by recent activity.
  items.sort((a, b) => (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || (new Date(b.updated_at) - new Date(a.updated_at)));
  return { total, page: current, limit: size, items };
}

export async function createCase({ subject_type: type, subject_id: id, title, category, priority, assignee_id: assigneeId, invoice_id: invoiceId, note }, actor) {
  const heading = String(title || '').trim();
  if (heading.length < 4) throw new AppError('Give the case a short title', 400);
  const label = await subjectLabel(type, id);
  if (assigneeId) await assertAssignable(assigneeId);

  const supportCase = await SupportCase.create({
    number: caseNumber(), subject_type: type, subject_id: id, subject_label: label, title: heading.slice(0, 140),
    category: SupportCase.schema.path('category').enumValues.includes(category) ? category : 'other',
    priority: ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal',
    assignee_id: assigneeId || actor._id,
    created_by: actor._id,
    invoice_id: isId(invoiceId) ? invoiceId : null,
  });
  await SupportNote.create({ subject_type: type, subject_id: id, case_id: supportCase._id, kind: 'event', body: 'Case opened.', author_id: actor._id });
  if (String(note || '').trim()) {
    await SupportNote.create({ subject_type: type, subject_id: id, case_id: supportCase._id, body: String(note).trim(), author_id: actor._id });
  }
  return getCase(supportCase._id);
}

export async function getCase(caseId) {
  if (!isId(caseId)) throw new AppError('Invalid case id', 400);
  const supportCase = await SupportCase.findById(caseId).populate('assignee_id created_by', 'name').lean();
  if (!supportCase) throw new AppError('Case not found', 404);
  const notes = await SupportNote.find({ case_id: caseId }).populate('author_id', 'name').sort({ createdAt: 1 }).lean();
  return { ...presentCase(supportCase), notes: notes.map(presentNote) };
}

/** Anyone who can work a case: the Super Admin or an active admin with support or finance access. */
async function assertAssignable(userId) {
  if (!isId(userId)) throw new AppError('Invalid assignee', 400);
  const user = await User.findById(userId).select('systemRole').lean();
  if (!user) throw new AppError('Assignee not found', 404);
  if (user.systemRole === 'super_admin') return;
  const admin = await PlatformAdmin.findOne({ userId, status: 'ACTIVE' }).lean();
  if (!admin || !(admin.permissions?.support || admin.permissions?.finance)) {
    throw new AppError('That person does not have support access.', 400);
  }
}

export async function listAssignees() {
  const [supers, admins] = await Promise.all([
    User.find({ systemRole: 'super_admin' }).select('name').lean(),
    PlatformAdmin.find({ status: 'ACTIVE', $or: [{ 'permissions.support': true }, { 'permissions.finance': true }] })
      .populate('userId', 'name').lean(),
  ]);
  const seen = new Set();
  return [
    ...supers.map((u) => ({ _id: u._id, name: u.name || 'Super Admin', role: 'Super Admin' })),
    ...admins.filter((a) => a.userId).map((a) => ({ _id: a.userId._id, name: a.userId.name, role: a.category })),
  ].filter((p) => !seen.has(String(p._id)) && seen.add(String(p._id)));
}

const describe = (field, from, to) => `${field}: ${from ?? 'none'} â†’ ${to ?? 'none'}`;

export async function updateCase(caseId, patch, actor) {
  if (!isId(caseId)) throw new AppError('Invalid case id', 400);
  const current = await SupportCase.findById(caseId);
  if (!current) throw new AppError('Case not found', 404);

  const changes = [];
  if (patch.status !== undefined && patch.status !== current.status) {
    if (!['open', 'pending', 'resolved', 'closed'].includes(patch.status)) throw new AppError('Invalid status', 400);
    if (['resolved', 'closed'].includes(patch.status)) {
      const resolution = String(patch.resolution ?? current.resolution ?? '').trim();
      if (resolution.length < 5) throw new AppError('Say how this was resolved before closing the case.', 400);
      current.resolution = resolution.slice(0, 1000);
      current.resolved_at = new Date();
    } else {
      current.resolved_at = null;
    }
    changes.push(describe('Status', current.status, patch.status));
    current.status = patch.status;
  }
  if (patch.priority !== undefined && patch.priority !== current.priority) {
    if (!['low', 'normal', 'high', 'urgent'].includes(patch.priority)) throw new AppError('Invalid priority', 400);
    changes.push(describe('Priority', current.priority, patch.priority));
    current.priority = patch.priority;
  }
  if (patch.assignee_id !== undefined && String(patch.assignee_id || '') !== String(current.assignee_id || '')) {
    if (patch.assignee_id) await assertAssignable(patch.assignee_id);
    const [from, to] = await Promise.all([
      current.assignee_id ? User.findById(current.assignee_id).select('name').lean() : null,
      patch.assignee_id ? User.findById(patch.assignee_id).select('name').lean() : null,
    ]);
    changes.push(describe('Assigned', from?.name, to?.name));
    current.assignee_id = patch.assignee_id || null;
  }
  if (patch.title !== undefined && String(patch.title).trim() && String(patch.title).trim() !== current.title) {
    current.title = String(patch.title).trim().slice(0, 140);
    changes.push('Title edited');
  }

  if (changes.length) {
    await current.save();
    await SupportNote.create({
      subject_type: current.subject_type, subject_id: current.subject_id, case_id: current._id,
      kind: 'event', body: changes.join(' Â· '), author_id: actor._id,
    });
  }
  return getCase(caseId);
}
