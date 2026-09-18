import { CONDITION_TYPES } from '../constants/policyEngine.constants.js';
import { getLatestTrustScore } from '../../services/Chamatrustscore.service.js';

// ========================================
// CONDITION EVALUATOR
// ========================================
//
// One place that answers "does this member/chama meet this condition"
// for every policy type. Loan eligibility, savings share-out recipient
// filtering, and MGR payout eligibility all currently ask slightly
// different versions of the same questions (active membership? overdue
// loans? enough tenure?) with hand-written checks buried in each
// service. This centralizes the check; each domain service still owns
// ASSEMBLING the context (it already has the member/loan data loaded),
// it just stops writing its own if/else ladder for eligibility.
//
// Usage (inside e.g. Loaneligibility.service.js):
//
//   const result = await evaluateConditions({
//     conditions: loanPolicy.eligibility_conditions, // [] until migrated
//     context: {
//       chamaId,
//       membership,                 // { status, joined_at, ... }
//       overdueLoanCount,
//       outstandingPenaltyTotal,
//       savingsBalance,
//       activeLoanCount,
//     },
//   });
//   if (!result.passed) {
//     // result.failedConditions tells you exactly which ones, and
//     // whether each was blocking or advisory (see conditionSchema.blocking)
//   }
//
// ========================================

function monthsSince(date) {
  if (!date) return 0;
  const ms = Date.now() - new Date(date).getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.44);
}

// Each checker returns { met: boolean, detail?: string }. Add new
// condition types here + in policyEngine.constants.js#CONDITION_TYPES —
// nowhere else needs to change for a new condition to become usable by
// every policy type at once.
const CHECKERS = {
  [CONDITION_TYPES.ACTIVE_MEMBERSHIP]: (params, ctx) => ({
    met: ctx.membership?.status === 'active',
    detail: 'membership must be active',
  }),

  [CONDITION_TYPES.MIN_TENURE_MONTHS]: (params, ctx) => ({
    met: monthsSince(ctx.membership?.joined_at) >= (params.months ?? 0),
    detail: `requires ${params.months ?? 0}+ months of membership`,
  }),

  [CONDITION_TYPES.NO_OVERDUE_LOANS]: (params, ctx) => ({
    met: (ctx.overdueLoanCount ?? 0) === 0,
    detail: 'requires no overdue loans',
  }),

  [CONDITION_TYPES.NO_OUTSTANDING_PENALTIES]: (params, ctx) => ({
    met: (ctx.outstandingPenaltyTotal ?? 0) === 0,
    detail: 'requires no outstanding penalties',
  }),

  [CONDITION_TYPES.MIN_SAVINGS_BALANCE]: (params, ctx) => ({
    met: (ctx.savingsBalance ?? 0) >= (params.amount ?? 0),
    detail: `requires savings balance >= ${params.amount ?? 0}`,
  }),

  [CONDITION_TYPES.MAX_ACTIVE_LOANS]: (params, ctx) => ({
    met: (ctx.activeLoanCount ?? 0) <= (params.count ?? Infinity),
    detail: `requires active loans <= ${params.count}`,
  }),

  // The trust-relevant additions. These are the ones no existing policy
  // checks today — this is the concrete "automate trust" hook.
  [CONDITION_TYPES.TRUST_SCORE_MIN]: async (params, ctx) => {
    if (!ctx.chamaId) return { met: false, detail: 'no chamaId in context' };
    const latest = await getLatestTrustScore(ctx.chamaId);
    const score = latest?.score ?? null;
    return {
      met: score !== null && score >= (params.score ?? 0),
      detail: `requires chama trust score >= ${params.score}, currently ${score ?? 'no score yet'}`,
    };
  },

  [CONDITION_TYPES.OFFICIAL_RATING_MIN]: (params, ctx) => ({
    // Caller supplies the official's current rating on ctx.officialRating —
    // left as an injected value rather than a query here, since which
    // official/role this applies to is decided by the calling module
    // (e.g. "the treasurer approving this disbursement").
    met: (ctx.officialRating ?? null) !== null && ctx.officialRating >= (params.score ?? 0),
    detail: `requires official rating >= ${params.score}`,
  }),
};

export async function evaluateConditions({ conditions = [], context = {} }) {
  const results = [];

  for (const condition of conditions) {
    const checker = CHECKERS[condition.type];
    if (!checker) {
      results.push({ type: condition.type, met: false, blocking: condition.blocking, detail: 'unknown condition type' });
      continue;
    }
    const outcome = await checker(condition.params || {}, context);
    results.push({ type: condition.type, met: outcome.met, blocking: condition.blocking, detail: outcome.detail });
  }

  const failedConditions = results.filter((r) => !r.met);
  const blockingFailures = failedConditions.filter((r) => r.blocking);

  return {
    passed: blockingFailures.length === 0,
    hasAdvisoryFailures: failedConditions.length > blockingFailures.length,
    failedConditions,
    results,
  };
}