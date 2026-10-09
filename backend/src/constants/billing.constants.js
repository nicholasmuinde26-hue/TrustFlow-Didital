import { MODULE_KEYS, LOCKED_MODULE_KEYS } from './workspaceModules.constants.js';

/**
 * ============================================================================
 * PLATFORM BILLING - CONSTANTS
 * ============================================================================
 * What a chama pays the PLATFORM for the software. This is separate from the
 * money members pay into their chama; it never touches the chama's books.
 *
 * Lifecycle (derived from dates, see modules/billing/billing.logic.js):
 *
 *   trial / active  -> full access to the plan
 *   grace           -> still full access, but warnings are shown
 *   read_only       -> every read still works (records and money history are
 *                      never held hostage); new records cannot be created
 *                      until the plan is paid or the chama moves to Free
 * ============================================================================
 */

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 7;
export const TRIAL_PLAN = 'pro';
export const FREE_PLAN = 'free';

// Months a treasurer can pay for in one invoice, and the annual discount:
// paying for 12 months is billed as (12 - ANNUAL_FREE_MONTHS).
// Lowest monthly price a paid plan (or a per-group price) can be set to, in
// whole KES. M-Pesa takes any whole amount above zero, so this is a business
// floor, not a technical one.
export const MIN_PLAN_PRICE = 10;

export const ALLOWED_MONTHS = Object.freeze([1, 3, 12]);
export const ANNUAL_FREE_MONTHS = 2;

// A downgrade (or switch to Free) is only offered this close to renewal, so a
// chama cannot drop a plan it has already paid for by accident.
export const CHANGE_WINDOW_DAYS = 7;

// Writes that stay possible even in read-only mode. Matched against the
// request path. Paying the subscription must always work, and money that
// belongs to members (withdrawals, payouts) must never be blocked.
export const READ_ONLY_WRITE_ALLOWLIST = Object.freeze([
  /\/billing(\/|$)/i,
  /\/withdrawals?(\/|$)/i,
  /\/payouts?(\/|$)/i,
  /\/exports?(\/|$)/i,
]);

const FREE_MODULES = ['contributions', 'meetings', 'polls', 'announcements'];
const STANDARD_MODULES = [
  ...FREE_MODULES,
  'savings', 'savings_shareout', 'payouts', 'withdrawals', 'mgr',
  'chat', 'trust', 'officials', 'disputes',
];

const withLocked = (keys) => [...new Set([...LOCKED_MODULE_KEYS, ...keys])].filter((k) => MODULE_KEYS.includes(k));

// Defaults seeded once. After that the database copy is the source of truth,
// so a super admin can change a price without a deploy.
export const DEFAULT_PLANS = Object.freeze([
  {
    code: 'free',
    name: 'Free',
    tagline: 'For small groups getting started',
    price_monthly: 0,
    max_members: 20,
    modules: withLocked(FREE_MODULES),
    sort_order: 1,
  },
  {
    code: 'standard',
    name: 'Standard',
    tagline: 'Savings, merry-go-round, payouts and trust',
    price_monthly: 500,
    max_members: 100,
    modules: withLocked(STANDARD_MODULES),
    sort_order: 2,
  },
  {
    code: 'pro',
    name: 'Pro',
    tagline: 'Everything: loans, assets, businesses and welfare',
    price_monthly: 1500,
    max_members: null, // unlimited
    modules: [...MODULE_KEYS],
    sort_order: 3,
  },
]);

export const isBillingEnforced = () =>
  String(process.env.BILLING_ENFORCEMENT || '').trim().toLowerCase() === 'on';
