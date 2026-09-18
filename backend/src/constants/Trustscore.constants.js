// ========================================
// CHAMA TRUST SCORE — CONSTANTS
// ========================================
//
// Central place for every tunable number the trust score computation
// uses, so the scoring logic in chamaTrustScore.service.js reads as
// "combine these named things" rather than a wall of magic numbers.
//
// ========================================


// ========================================
// OFFICIAL ROLES
// ========================================
//
// Roles that carry governance/custody responsibility and are therefore
// (a) rateable by peers via OfficialRating, and (b) the set whose
// conduct feeds the "official accountability" trust-score component.
// Deliberately excludes 'member' (nothing to hold accountable beyond
// what the rest of the score already measures) and 'patron' (an
// honorary, non-operational role in this app's role vocabulary).
//
// Mirrors LOAN_OFFICIAL_ROLES in modules/loans/Loan.constants.js.
//
// ========================================

export const OFFICIAL_ROLES = [
  'treasurer',
  'chairperson',
  'secretary',
  'auditor',
  'committee_member',
];


// ========================================
// TRUST SCORE COMPONENT WEIGHTS
// ========================================
//
// Must sum to 1. If a chama has no data yet for a given component (e.g.
// no loans ever disbursed, so repayment reliability is undefined), that
// component is dropped and the remaining weights are renormalized to
// still sum to 1 — see normalizeWeights() in chamaTrustScore.service.js.
// A brand-new chama therefore isn't punished with a low score for
// simply not having history yet; it just gets a score computed from
// less evidence, and `componentsUsed` on the report says which.
//
// ========================================

export const TRUST_SCORE_WEIGHTS = {
  repayment: 0.30,
  kyc: 0.20,
  disputes: 0.15,
  auditIntegrity: 0.15,
  officialAccountability: 0.20,
};


// ========================================
// GRADE BANDS
// ========================================

export const TRUST_SCORE_GRADE_BANDS = [
  { min: 90, grade: 'A+' },
  { min: 80, grade: 'A' },
  { min: 70, grade: 'B+' },
  { min: 60, grade: 'B' },
  { min: 50, grade: 'C' },
  { min: 35, grade: 'D' },
  { min: 0, grade: 'E' },
];

export function gradeForScore(score) {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return null;
  }
  const band = TRUST_SCORE_GRADE_BANDS.find((b) => score >= b.min);
  return band ? band.grade : 'E';
}


// ========================================
// DISPUTES
// ========================================

export const DISPUTE_SUBJECT_TYPES = [
  'loan',
  'contribution',
  'withdrawal',
  'payout',
  'official_conduct',
  'other',
];

export const DISPUTE_STATUSES = [
  'open',
  'investigating',
  'resolved',
  'dismissed',
];

// Only disputes raised in this trailing window count toward the live
// score, so a chama that fixed its problems two years ago isn't held
// to them forever. The Dispute record itself is never deleted or time-
// limited — this only bounds what feeds the CURRENT score.
export const DISPUTE_LOOKBACK_DAYS = 365;

// How much a dispute in each status "costs" against the dispute-rate
// component, relative to a fully-open, unresolved dispute (weight 1).
// A resolved dispute still counts — it happened — but costs less than
// an open one; a dismissed dispute (found to be without merit) costs
// nothing.
export const DISPUTE_STATUS_WEIGHT = {
  open: 1,
  investigating: 0.75,
  resolved: 0.25,
  dismissed: 0,
};


// ========================================
// OFFICIAL ACCOUNTABILITY / CO-SIGNING
// ========================================
//
// ApprovalRequest.resource_type values that represent money actually
// leaving the chama (or being committed) under an official's authority
// — the actions a co-signing requirement exists to check. Excludes
// POLICY_CHANGE, which doesn't move funds.
//
// ========================================

export const HIGH_VALUE_COSIGN_RESOURCE_TYPES = [
  'MGR_PAYOUT',
  'LOAN_DISBURSEMENT',
  'WITHDRAWAL',
  'EXPENSE',
  'INVESTMENT',
  'CHAMA_CONTRIBUTION_PAYOUT',
];

// The platform-wide minimum number of INDEPENDENT approving officials a
// high-value approval request should have before its funds move,
// regardless of what a given chama configured ApprovalRequest.
// required_approvals to. This is what "mandatory co-signing threshold"
// is measured against — a chama that configured a weaker threshold (or
// one whose officials colluded to log only one real approver) shows up
// with a lower co-sign compliance rate.
export const MIN_REQUIRED_COSIGNERS = 2;

// Rating scale used by OfficialRating.rating (and the optional
// dimension ratings).
export const OFFICIAL_RATING_MIN = 1;
export const OFFICIAL_RATING_MAX = 5;

// Trailing window for share-link default validity messaging — the link
// itself doesn't expire automatically (it's revoked explicitly), this
// is only used to nudge officials to refresh stale reports.
export const TRUST_SCORE_REPORT_STALE_AFTER_DAYS = 90;