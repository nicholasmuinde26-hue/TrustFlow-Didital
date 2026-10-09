import Chama from '../../models/Chama.js';
import Invoice from '../../models/Invoice.js';
import Subscription from '../../models/Subscription.js';
import BillingPlan from '../../models/BillingPlan.js';
import AppError from '../../utils/AppError.js';
import { MIN_PLAN_PRICE } from '../../constants/billing.constants.js';
import { addMonths, computeAccess, computeRevenueMetrics, startOfMonthUtc } from './billing.logic.js';
import { invalidateEntitlement } from './billingEntitlement.service.js';

/** Platform-owner views: revenue, who is paying, who is lapsing. */

export async function getRevenueMetrics({ months = 6 } = {}) {
  const span = Math.min(24, Math.max(1, Number(months) || 6));
  const windowStart = addMonths(startOfMonthUtc(new Date()), -span);

  const [invoices, subscriptions, totalChamas] = await Promise.all([
    Invoice.find({ status: 'paid', period_end: { $gte: windowStart } })
      .select('chama_id plan_code base_amount amount months period_start period_end paid_at')
      .lean(),
    Subscription.find({}).select('plan_code status trial_ends_at current_period_end').lean(),
    Chama.countDocuments({}),
  ]);

  // Money actually collected this window, plus invoices that need a human.
  const needsReview = await Invoice.countDocuments({ needs_review: true });

  return {
    ...computeRevenueMetrics({ invoices, subscriptions, totalChamas, months: span }),
    needs_review_invoices: needsReview,
  };
}

const STATES = new Set(['trial', 'active', 'grace', 'read_only', 'free']);

export async function listSubscriptions({ state, page = 1, limit = 25 } = {}) {
  const all = await Subscription.find({})
    .populate('chama_id', 'name chama_type')
    .sort({ updatedAt: -1 })
    .limit(5000)
    .lean();

  const rows = all
    .map((sub) => {
      const access = computeAccess(sub);
      return {
        chama_id: sub.chama_id?._id || sub.chama_id,
        chama_name: sub.chama_id?.name || '(deleted chama)',
        plan_code: sub.plan_code,
        status: sub.status,
        state: access.state,
        days_left: access.days_left,
        grace_days_left: access.grace_days_left,
        access_until: access.access_until,
        last_paid_at: sub.last_paid_at,
        price_overrides: sub.price_overrides ? Object.fromEntries(Object.entries(sub.price_overrides)) : {},
      };
    })
    .filter((row) => !state || (STATES.has(state) && row.state === state));

  const size = Math.min(100, Math.max(1, Number(limit) || 25));
  const current = Math.max(1, Number(page) || 1);
  return {
    total: rows.length,
    page: current,
    limit: size,
    items: rows.slice((current - 1) * size, current * size),
  };
}

export async function listInvoices({ status, needsReview, page = 1, limit = 25 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (needsReview === 'true' || needsReview === true) filter.needs_review = true;
  const size = Math.min(100, Math.max(1, Number(limit) || 25));
  const current = Math.max(1, Number(page) || 1);

  const [items, total] = await Promise.all([
    Invoice.find(filter)
      .populate('chama_id', 'name')
      .sort(status === 'paid' ? { paid_at: -1, createdAt: -1 } : { createdAt: -1 })
      .skip((current - 1) * size)
      .limit(size)
      .select('-attempts.merchant_request_id')
      .lean(),
    Invoice.countDocuments(filter),
  ]);
  return { total, page: current, limit: size, items };
}

export async function listAllPlans() {
  return BillingPlan.find({}).sort({ sort_order: 1 }).lean();
}

const EDITABLE = ['name', 'tagline', 'price_monthly', 'max_members', 'is_active'];

export async function updatePlan(code, patch) {
  const update = {};
  for (const key of EDITABLE) if (patch[key] !== undefined) update[key] = patch[key];
  if (update.price_monthly !== undefined) {
    const price = Number(update.price_monthly);
    if (!Number.isInteger(price) || price < 0) throw new AppError('price_monthly must be a whole number of KES', 400);
    if (code !== 'free' && price < MIN_PLAN_PRICE) {
      throw new AppError(`A paid plan costs at least KES ${MIN_PLAN_PRICE} a month`, 400);
    }
    update.price_monthly = price;
  }
  if (code === 'free' && (update.price_monthly > 0 || update.is_active === false)) {
    throw new AppError('The Free plan must stay free and active', 400);
  }
  const plan = await BillingPlan.findOneAndUpdate({ code }, { $set: update }, { returnDocument: 'after', runValidators: true }).lean();
  if (!plan) throw new AppError('Plan not found', 404);
  invalidateEntitlement(); // prices and limits show up immediately
  return plan;
}

/**
 * Give one group its own monthly price for a plan (or clear it with null).
 * Takes effect on the next invoice; anything already paid is untouched.
 */
export async function setGroupPrice(chamaId, { plan_code: planCode, price_monthly: rawPrice }) {
  const code = String(planCode || '').toLowerCase().trim();
  const plan = await BillingPlan.findOne({ code }).lean();
  if (!plan || code === 'free') throw new AppError('Choose a paid plan', 400);

  const sub = await Subscription.findOne({ chama_id: chamaId });
  if (!sub) throw new AppError('That chama has no subscription yet', 404);

  if (rawPrice === null || rawPrice === '' || rawPrice === undefined) {
    sub.price_overrides?.delete(code);
  } else {
    const price = Number(rawPrice);
    if (!Number.isInteger(price) || price < MIN_PLAN_PRICE) {
      throw new AppError(`A price must be a whole number of at least KES ${MIN_PLAN_PRICE}`, 400);
    }
    if (!sub.price_overrides) sub.price_overrides = new Map();
    sub.price_overrides.set(code, price);
  }
  await sub.save();
  invalidateEntitlement(chamaId);
  return { chama_id: chamaId, plan_code: code, price_overrides: Object.fromEntries(sub.price_overrides || []) };
}