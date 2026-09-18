import domainEventEmitter from '../../services/domainEvent.emitter.js';
import { evaluateConditions } from './conditionEvaluator.service.js';
import { ACTION_TYPES } from '../constants/policyEngine.constants.js';

// ========================================
// POLICY ENGINE — EVENT WIRING + DECISIONING
// ========================================
//
// Two jobs:
//
// 1. resolveDecision() — turn (conditions + actionSpec) into a single
//    decision object. This is what makes trust score/audit-integrity
//    something that DOES something, not just something that's shown:
//    a policy with a TRUST_SCORE_MIN condition and on_pass:AUTO_APPROVE
//    actually skips the manual approval step, instead of just noting
//    the score on a dashboard.
//
// 2. registerEventTrigger() — a thin wrapper over the domainEventEmitter
//    you already have, so an EVENT-mode policy (trigger_rule.mode ===
//    'event') doesn't need each domain module to hand-wire its own
//    listener. The domain module still owns what happens with the
//    decision — this only standardizes "when policy X's event fires,
//    evaluate its conditions and call me back with the decision".
//
// This deliberately does NOT auto-execute the action (disburse a loan,
// mark a share-out paid, etc.) — that stays in the domain service, which
// already knows how to do that safely (locking, transactions, ledger
// posting). The engine's job stops at "here is the decision and why".
//
// ========================================

export function resolveDecision(evaluation) {
  const spec = evaluation.passed ? evaluation.actionOnPass : evaluation.actionOnFail;
  return {
    action: spec?.type || ACTION_TYPES.REQUIRE_APPROVAL,
    params: spec?.params || {},
    passed: evaluation.passed,
    reasons: evaluation.failedConditions.map((f) => f.detail),
  };
}

/**
 * Evaluate a policy's conditions against a context, then resolve what
 * action should follow, in one call. Returns everything a domain
 * service (loan approval, share-out creation, MGR payout) needs to
 * decide: auto-approve, still require approval, auto-reject, or flag.
 */
export async function evaluatePolicyAction({ conditions, actionSpec, context }) {
  const evaluation = await evaluateConditions({ conditions, context });
  return resolveDecision({
    ...evaluation,
    actionOnPass: actionSpec?.on_pass,
    actionOnFail: actionSpec?.on_fail,
  });
}

/**
 * Wire an EVENT-mode policy to the existing domain event bus.
 *
 * Example (in loans module bootstrap, alongside where Loanapproval
 * .service.js currently emits LOAN_SUBMITTED):
 *
 *   registerEventTrigger('LOAN_SUBMITTED', async (eventData) => {
 *     const policy = await ChamaLoanPolicy.findOne({ chama_id: eventData.chamaId });
 *     if (policy.trigger_rule?.mode !== 'event') return; // still manual-only
 *
 *     const decision = await evaluatePolicyAction({
 *       conditions: policy.eligibility_conditions,
 *       actionSpec: policy.action_spec,
 *       context: await buildLoanEligibilityContext(eventData), // domain module's job
 *     });
 *
 *     if (decision.action === 'AUTO_APPROVE') {
 *       await autoApproveLoan(eventData.loanId, { reason: 'policy engine', decision });
 *     }
 *     // AUTO_REJECT / REQUIRE_APPROVAL / FLAG_FOR_REVIEW handled the
 *     // same way the domain module already handles those paths today.
 *   });
 *
 * Errors in a handler are caught and logged rather than thrown, so one
 * misbehaving automation can't take down the event that other listeners
 * (notifications, audit logging) also depend on — matches the
 * try/catch-per-handler pattern already used in finance.event.handler.js.
 */
export function registerEventTrigger(eventName, handler) {
  domainEventEmitter.on(eventName, async (eventData) => {
    try {
      await handler(eventData);
    } catch (error) {
      console.error(`[PolicyEngine] handler for ${eventName} failed:`, error);
    }
  });
}