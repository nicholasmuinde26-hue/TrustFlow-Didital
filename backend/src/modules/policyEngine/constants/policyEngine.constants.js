// ========================================
// POLICY ENGINE — SHARED CONSTANTS
// ========================================
//
// The vocabulary every domain policy (ChamaLoanPolicy, SavingsSharePolicy,
// MgrPolicy, and any future one — TrustFlow escrow rules included) draws
// from instead of re-inventing its own condition/trigger shape.
//
// Nothing here replaces those schemas. Each keeps its own domain-specific
// fields (loan_multiplier, share_percentage, rotation_rule, ...). What
// moves here is the part that was already conceptually identical across
// all three: "when does this fire" and "what must be true for it to
// apply" — trigger_rule and eligibility_rule/recipients_rule.
//
// ========================================

// ----------------------------------------
// TRIGGER MODES
// ----------------------------------------
// MANUAL    — only fires when an officer explicitly starts it (existing
//             behaviour of every policy today).
// SCHEDULED — a scheduler job fires it (mirrors SavingsSharePolicy's
//             existing schedule shape).
// EVENT     — fires automatically off a domainEventEmitter event. This is
//             the new capability: it's what makes trust "programmable"
//             instead of "reported after the fact".
// BOTH      — manual OR scheduled/event, whichever comes first.
export const TRIGGER_MODES = ['manual', 'scheduled', 'event', 'both'];

// ----------------------------------------
// CONDITION TYPES
// ----------------------------------------
// Each entry here replaces a hand-rolled boolean that today lives
// separately on SavingsSharePolicy.recipients_rule, MgrPolicy.eligibility_rule,
// and ChamaLoanPolicy — same idea, different field name, in each file.
export const CONDITION_TYPES = {
  ACTIVE_MEMBERSHIP: 'ACTIVE_MEMBERSHIP',           // params: {}
  MIN_TENURE_MONTHS: 'MIN_TENURE_MONTHS',           // params: { months }
  NO_OVERDUE_LOANS: 'NO_OVERDUE_LOANS',             // params: {}
  NO_OUTSTANDING_PENALTIES: 'NO_OUTSTANDING_PENALTIES', // params: {}
  MIN_SAVINGS_BALANCE: 'MIN_SAVINGS_BALANCE',       // params: { amount }
  MAX_ACTIVE_LOANS: 'MAX_ACTIVE_LOANS',             // params: { count }
  // The new one: lets trust score gate an action instead of just
  // reporting it. Backed by Chamatrustscore.service.js#getLatestTrustScore.
  TRUST_SCORE_MIN: 'TRUST_SCORE_MIN',               // params: { score }
  OFFICIAL_RATING_MIN: 'OFFICIAL_RATING_MIN',       // params: { score, role? }
};

// ----------------------------------------
// ACTION TYPES
// ----------------------------------------
// What a policy does once its conditions are evaluated. Deliberately
// generic — the domain module (loans, savings, mgr) supplies the payload;
// the engine just standardizes the envelope so every policy type gets
// automated gating "for free" instead of each module wiring its own.
export const ACTION_TYPES = {
  AUTO_APPROVE: 'AUTO_APPROVE',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',   // falls through to ApprovalRequest as-is today
  AUTO_REJECT: 'AUTO_REJECT',
  FLAG_FOR_REVIEW: 'FLAG_FOR_REVIEW',     // creates a Dispute-adjacent flag, doesn't block
  ADJUST_LIMIT: 'ADJUST_LIMIT',           // e.g. shrink a loan limit dynamically
};

// Scope types a policy or its evaluation context can be anchored to.
// ContributionGroup and Business included now so this doesn't need a
// second migration when TrustFlow lands.
export const POLICY_SCOPE_TYPES = ['CHAMA', 'CONTRIBUTION_GROUP', 'BUSINESS'];