import BillingPlan from '../../models/BillingPlan.js';
import Subscription from '../../models/Subscription.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import AppError from '../../utils/AppError.js';
import {
  DEFAULT_PLANS,
  FREE_PLAN,
  TRIAL_DAYS,
  TRIAL_PLAN,
  isBillingEnforced,
} from '../../constants/billing.constants.js';
import { addDays, computeAccess, evaluateRequest } from './billing.logic.js';

/**
 * What a chama is allowed to do, kept free of any payment code so the module
 * guard can import it cheaply.
 */

const TTL_MS = 15_000;
const entitlementCache = new Map(); // chamaId -> { at, value }
let plansCache = { at: 0, value: null };

/** The plan as THIS chama is priced: a per-group override replaces the list price. */
export function priceForChama(plan, subscription) {
  if (!plan) return plan;
  const overrides = subscription?.price_overrides;
  const custom = overrides instanceof Map ? overrides.get(plan.code) : overrides?.[plan.code];
  if (custom === undefined || custom === null) return plan;
  return { ...plan, list_price_monthly: plan.price_monthly, price_monthly: Number(custom) };
}

export const invalidateEntitlement = (chamaId) => {
  if (chamaId) entitlementCache.delete(String(chamaId));
  else entitlementCache.clear();
  plansCache = { at: 0, value: null };
};

/** Insert any default plan that is missing. Never overwrites an edited price. */
export async function ensureDefaultPlans() {
  for (const plan of DEFAULT_PLANS) {
    await BillingPlan.updateOne({ code: plan.code }, { $setOnInsert: plan }, { upsert: true });
  }
}

export async function listPlans({ includeInactive = false } = {}) {
  if (!includeInactive && plansCache.value && Date.now() - plansCache.at < 60_000) return plansCache.value;
  const plans = await BillingPlan.find(includeInactive ? {} : { is_active: true }).sort({ sort_order: 1 }).lean();
  if (!includeInactive) plansCache = { at: Date.now(), value: plans };
  return plans;
}

export async function getPlan(code) {
  const plans = await listPlans({ includeInactive: true });
  return plans.find((p) => p.code === code) || null;
}

/**
 * The subscription row, created on first sight as a free trial of the top
 * plan. Existing chamas get their trial the first time billing is consulted,
 * so switching enforcement on never locks anyone out on day one.
 */
export async function getOrCreateSubscription(chamaId) {
  const now = new Date();
  return Subscription.findOneAndUpdate(
    { chama_id: chamaId },
    {
      $setOnInsert: {
        chama_id: chamaId,
        plan_code: TRIAL_PLAN,
        status: 'trialing',
        trial_started_at: now,
        trial_ends_at: addDays(now, TRIAL_DAYS),
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean();
}

export async function getEntitlement(chamaId) {
  const key = String(chamaId);
  const hit = entitlementCache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const sub = await getOrCreateSubscription(chamaId);
  const plan = priceForChama((await getPlan(sub.plan_code)) || (await getPlan(FREE_PLAN)), sub);
  const access = computeAccess(sub);
  const value = { subscription: sub, plan, access };
  entitlementCache.set(key, { at: Date.now(), value });
  return value;
}

/**
 * Plan member limit. Call BEFORE a membership becomes active (direct add,
 * approving a join request, returning a suspended member). Throws a 402 when
 * the chama's plan is full; does nothing while enforcement is off. Existing
 * members are never removed - this only stops the next one being added.
 */
export async function assertMemberCapacity(chamaId) {
  if (!isBillingEnforced()) return;
  const { plan } = await getEntitlement(chamaId);
  const limit = plan?.max_members;
  if (!limit) return; // unlimited
  const active = await ChamaMembership.countDocuments({ chama_id: chamaId, status: 'active' });
  if (active >= limit) {
    const error = new AppError(
      `The ${plan.name} plan allows up to ${limit} members and this chama has ${active}. Upgrade the plan to add more. Existing members are not affected.`,
      402
    );
    error.code = 'PLAN_MEMBER_LIMIT';
    throw error;
  }
}

/**
 * Called by requireModule. Returns null to allow or { status, code, message }.
 * With enforcement off (the default) it allows everything.
 */
export async function checkBillingAccess({ chamaId, method, url, moduleKey }) {
  if (!isBillingEnforced()) return null;
  const { plan, access } = await getEntitlement(chamaId);
  return evaluateRequest({ method, url, access, plan, moduleKey });
}
