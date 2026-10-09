/**
 * Billing rules, tested without a database. Run: node --test src/tests/billing.logic.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addMonths,
  computeAccess,
  computeRevenueMetrics,
  evaluateRequest,
  isBlockedDowngrade,
  nextPeriodStart,
  priceInvoice,
  proratedCredit,
} from '../modules/billing/billing.logic.js';

const d = (s) => new Date(s);
const STANDARD = { code: 'standard', name: 'Standard', price_monthly: 500, modules: ['contributions', 'savings'] };
const PRO = { code: 'pro', name: 'Pro', price_monthly: 1500, modules: ['contributions', 'savings', 'loans'] };

test('trial -> grace -> read_only boundaries', () => {
  const sub = { plan_code: 'pro', status: 'trialing', trial_ends_at: d('2026-10-15T00:00:00Z') };
  assert.equal(computeAccess(sub, d('2026-10-14T00:00:00Z')).state, 'trial');
  assert.equal(computeAccess(sub, d('2026-10-15T00:00:00Z')).state, 'trial'); // last instant
  assert.equal(computeAccess(sub, d('2026-10-16T00:00:00Z')).state, 'grace');
  assert.equal(computeAccess(sub, d('2026-10-22T00:00:00Z')).state, 'grace'); // 7 days on
  assert.equal(computeAccess(sub, d('2026-10-22T00:00:01Z')).state, 'read_only');
});

test('active plan counts down and free never expires', () => {
  const sub = { plan_code: 'standard', status: 'active', current_period_end: d('2026-11-01T00:00:00Z') };
  const a = computeAccess(sub, d('2026-10-25T00:00:00Z'));
  assert.equal(a.state, 'active');
  assert.equal(a.days_left, 7);
  assert.equal(computeAccess({ plan_code: 'free', status: 'active' }, d('2030-01-01')).state, 'free');
});

test('reads are never blocked, even when read-only', () => {
  const access = { state: 'read_only' };
  for (const method of ['GET', 'HEAD', 'OPTIONS']) {
    assert.equal(evaluateRequest({ method, url: '/api/v1/chamas/1/loans', access, plan: STANDARD, moduleKey: 'loans' }), null);
  }
});

test('read-only blocks writes but keeps billing, withdrawals and payouts open', () => {
  const access = { state: 'read_only' };
  const blocked = evaluateRequest({ method: 'POST', url: '/api/v1/chamas/1/polls', access, plan: PRO, moduleKey: 'polls' });
  assert.equal(blocked.status, 402);
  assert.equal(blocked.code, 'SUBSCRIPTION_REQUIRED');
  for (const url of ['/api/v1/chamas/1/billing/invoices', '/api/v1/chamas/1/finance/withdrawals', '/api/v1/chamas/1/payouts/9/approve']) {
    assert.equal(evaluateRequest({ method: 'POST', url, access, plan: PRO, moduleKey: 'payouts' }), null, url);
  }
});

test('a module outside the plan is read-only, not hidden', () => {
  const access = { state: 'active' };
  assert.equal(evaluateRequest({ method: 'GET', url: '/x/loans', access, plan: STANDARD, moduleKey: 'loans' }), null);
  const v = evaluateRequest({ method: 'POST', url: '/x/loans', access, plan: STANDARD, moduleKey: 'loans' });
  assert.equal(v.code, 'PLAN_UPGRADE_REQUIRED');
  assert.equal(evaluateRequest({ method: 'POST', url: '/x/savings', access, plan: STANDARD, moduleKey: 'savings' }), null);
});

test('grace period keeps full write access', () => {
  assert.equal(evaluateRequest({ method: 'POST', url: '/x/savings', access: { state: 'grace' }, plan: STANDARD, moduleKey: 'savings' }), null);
});

test('pricing: 12 months bills 10, credit never goes below zero', () => {
  assert.deepEqual(priceInvoice({ plan: STANDARD, months: 1 }), { base_amount: 500, credit: 0, amount: 500 });
  assert.equal(priceInvoice({ plan: STANDARD, months: 12 }).amount, 5000);
  assert.equal(priceInvoice({ plan: STANDARD, months: 1, credit: 9999 }).amount, 0);
  assert.throws(() => priceInvoice({ plan: STANDARD, months: 5 }));
});

test('proration: credit is the unused share of the old plan, capped at its price', () => {
  const now = d('2026-10-01T00:00:00Z');
  assert.equal(proratedCredit({ currentPlan: STANDARD, periodEnd: d('2026-10-16T00:00:00Z'), now }), 250);
  assert.equal(proratedCredit({ currentPlan: STANDARD, periodEnd: d('2027-10-01T00:00:00Z'), now }), 500); // capped
  assert.equal(proratedCredit({ currentPlan: STANDARD, periodEnd: d('2026-09-01T00:00:00Z'), now }), 0);
});

test('downgrade only near renewal', () => {
  const far = { state: 'active', days_left: 20 };
  const near = { state: 'active', days_left: 5 };
  assert.equal(isBlockedDowngrade({ currentPlan: PRO, targetPlan: STANDARD, access: far }), true);
  assert.equal(isBlockedDowngrade({ currentPlan: PRO, targetPlan: STANDARD, access: near }), false);
  assert.equal(isBlockedDowngrade({ currentPlan: STANDARD, targetPlan: PRO, access: far }), false); // upgrade
});

test('period start: trial remainder is free, early renewal stacks, lapsed starts now', () => {
  const now = d('2026-10-10T00:00:00Z');
  assert.deepEqual(nextPeriodStart({ sub: { status: 'trialing', trial_ends_at: d('2026-10-20T00:00:00Z') }, invoicePlanCode: 'pro', now }), d('2026-10-20T00:00:00Z'));
  assert.deepEqual(nextPeriodStart({ sub: { status: 'active', plan_code: 'pro', current_period_end: d('2026-10-25T00:00:00Z') }, invoicePlanCode: 'pro', now }), d('2026-10-25T00:00:00Z'));
  assert.deepEqual(nextPeriodStart({ sub: { status: 'active', plan_code: 'standard', current_period_end: d('2026-10-25T00:00:00Z') }, invoicePlanCode: 'pro', now }), now); // upgrade
  assert.deepEqual(nextPeriodStart({ sub: { status: 'active', plan_code: 'pro', current_period_end: d('2026-09-01T00:00:00Z') }, invoicePlanCode: 'pro', now }), now);
});

test('addMonths clamps the day', () => {
  assert.equal(addMonths(d('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10), '2026-02-28');
});

test('revenue metrics: MRR, ARPU and churn', () => {
  const inv = (chama, plan, base, months, start, end, paidAt) => ({
    chama_id: chama, plan_code: plan, base_amount: base, amount: base, months,
    period_start: d(start), period_end: d(end), paid_at: d(paidAt),
  });
  const invoices = [
    inv('A', 'standard', 500, 1, '2026-08-05', '2026-09-05', '2026-08-05'),
    inv('A', 'standard', 500, 1, '2026-09-05', '2026-10-05', '2026-09-04'),
    inv('B', 'pro', 1500, 1, '2026-08-10', '2026-09-10', '2026-08-10'), // never renews -> churns
    inv('C', 'pro', 15000, 12, '2026-09-20', '2027-09-20', '2026-09-20'), // annual = 1500/mo
  ];
  const subs = [
    { plan_code: 'standard', status: 'active', current_period_end: d('2026-10-05') },
    { plan_code: 'pro', status: 'active', current_period_end: d('2026-09-10') },
    { plan_code: 'pro', status: 'active', current_period_end: d('2027-09-20') },
    { plan_code: 'free', status: 'active' },
  ];
  const m = computeRevenueMetrics({ invoices, subscriptions: subs, totalChamas: 10, now: d('2026-10-04T12:00:00Z'), months: 3 });

  // Today only A (500/mo) and C are covered; B lapsed on 10 Sept.
  // C paid 15,000 for 12 months (Pro bills 10 of 12) = 1,250/mo.
  assert.equal(m.current.paying_groups, 2);
  assert.equal(m.current.mrr, 1750);
  assert.equal(m.current.arr, 21000);
  assert.equal(m.current.arpu_paying, 875);
  assert.equal(m.current.arpu_all_groups, 175);
  assert.deepEqual(m.current.by_plan.pro, { groups: 1, mrr: 1250 });

  const [aug, sep, oct] = m.months;
  assert.equal(aug.month, '2026-08');
  assert.equal(aug.paying_groups, 0);        // nobody covered on 1 Aug
  assert.equal(aug.new_paying, 2);           // A and B by 1 Sept
  assert.equal(aug.collected, 2000);

  assert.equal(sep.paying_groups, 2);        // A and B on 1 Sept
  assert.equal(sep.mrr, 2000);
  assert.equal(sep.churned, 1);              // B gone by 1 Oct
  assert.equal(sep.churn_rate, 50);
  assert.equal(sep.new_paying, 1);           // C joined
  assert.equal(sep.collected, 15500);

  assert.equal(oct.partial, true);
  assert.equal(oct.paying_groups, 2);
  assert.equal(oct.mrr, 1750);
  assert.equal(oct.churned, 0);
});
