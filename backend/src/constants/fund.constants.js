import { SETTLEMENTS } from '../modules/yearEnd/yearEnd.constants.js';

/**
 * ============================================================================
 * FUNDS
 * ============================================================================
 *
 * A Fund is the long-lived pot of money. A ContributionPlan is a way of
 * feeding it (a monthly levy, a one-off harambee). Plans come and go; the fund
 * and its ledger account carry on. Several plans can feed one fund, and a
 * campaign plan can close while its fund continues.
 *
 * This file is pure (no database) so the migration's decisions can be tested.
 * ============================================================================
 */

export const FUND_KINDS = Object.freeze([
  'general', 'welfare', 'savings', 'shares', 'project', 'fee', 'fine', 'other',
]);

export const FUND_SETTLEMENTS = Object.freeze(Object.values(SETTLEMENTS));

// Plan behaviour -> fund kind. 'rotation' is absent on purpose: merry-go-round
// plans post through the MGR rule's own pool accounts and never own a ledger
// account, so they never get a fund.
const KIND_BY_BEHAVIOR = Object.freeze({
  dues: 'general',
  welfare: 'welfare',
  savings: 'savings',
  shares: 'shares',
  target: 'project',
  fee: 'fee',
  fine: 'fine',
  other: 'other',
});

export const kindFromBehavior = (behavior) => KIND_BY_BEHAVIOR[behavior] || 'other';

const MAX_NAME = 100;

/**
 * What the migration creates for ONE plan: a fund named after the plan, with
 * the plan's existing ledger account. Nothing about the account changes, so no
 * posting or history is rewritten. Settlement starts as 'retained' (the year-end
 * default for a real balance); a chama changes it deliberately.
 *
 * `taken` is the set of fund names already used by this owner, so two plans
 * with the same name don't collide on the unique name index.
 */
export const fundFromPlan = (plan, { taken = new Set(), accountCode = null } = {}) => {
  const base = String(plan.name || 'Fund').trim().slice(0, MAX_NAME) || 'Fund';
  let name = base;
  if (taken.has(name.toLowerCase())) {
    const suffix = ` (${accountCode || String(plan._id).slice(-6).toUpperCase()})`;
    name = `${base.slice(0, MAX_NAME - suffix.length)}${suffix}`;
  }
  return {
    owner_type: plan.owner_type,
    owner_id: plan.owner_id,
    name,
    kind: kindFromBehavior(plan.behavior),
    settlement: SETTLEMENTS.RETAINED,
    ledger_account_id: plan.ledger_account_id,
  };
};

/**
 * Year-end settlement overrides implied by a chama's funds, keyed by ledger
 * account _id (resolveSettlement reads overrides by account_code first, then by
 * _id). Anything the leadership passes explicitly when starting the close wins:
 * an override keyed by the same _id replaces the fund's, and one keyed by
 * account_code is read before the fund's _id key.
 */
export const mergeSettlementOverrides = (funds, explicit = {}) => {
  const fromFunds = {};
  for (const f of funds) {
    if (f?.ledger_account_id && f.settlement) fromFunds[String(f.ledger_account_id)] = f.settlement;
  }
  return { ...fromFunds, ...explicit };
};
