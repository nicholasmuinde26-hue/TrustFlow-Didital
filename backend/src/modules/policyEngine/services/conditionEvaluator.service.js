import { CONDITION_TYPES } from '../constants/policyEngine.constants.js';
import { getLatestTrustScore } from '../../../services/Chamatrustscore.service.js';

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

  // Caller supplies ctx.requestedAmount — the amount of THIS request, as
  // opposed to a running balance like MIN_SAVINGS_BALANCE above.
  [CONDITION_TYPES.MAX_AMOUNT_PER_REQUEST]: (params, ctx) => ({
    met: (ctx.requestedAmount ?? Infinity) <= (params.amount ?? Infinity),
    detail: `requests may not exceed ${params.amount ?? 0} at a time`,
  }),

  // Caller supplies ctx.amountInPeriod — the sum of the member's already-
  // approved/paid requests within params.days of "now", NOT including the
  // current request. The domain service owns computing that window; this
  // checker only compares it (plus the current request) against the cap.
  [CONDITION_TYPES.MAX_AMOUNT_PER_PERIOD]: (params, ctx) => {
    const alreadyTaken = ctx.amountInPeriod ?? 0;
    const projected = alreadyTaken + (ctx.requestedAmount ?? 0);
    return {
      met: projected <= (params.amount ?? Infinity),
      detail: `requires no more than ${params.amount ?? 0} taken in the last ${params.days ?? 30} day(s), already at ${alreadyTaken}`,
    };
  },

  // Caller supplies ctx.daysSinceLastRequest — null/undefined means "no
  // prior request", which always passes (nothing to cool down from).
  [CONDITION_TYPES.MIN_DAYS_SINCE_LAST]: (params, ctx) => {
    const days = ctx.daysSinceLastRequest;
    return {
      met: days === null || days === undefined || days >= (params.days ?? 0),
      detail: `requires ${params.days ?? 0}+ day(s) since the last request`,
    };
  },
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