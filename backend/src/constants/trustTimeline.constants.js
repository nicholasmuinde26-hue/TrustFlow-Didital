// ========================================
// TRUST TIMELINE — MEMBER-FACING EVENT WHITELIST
// ========================================
//
// The full AuditLog (see audit.constants.js) captures every action for
// treasurers/auditors — including high-volume, internal, or purely
// operational events (chat messages, announcement edits, individual
// savings postings). That's the right shape for an auditor's log; it's
// the wrong shape for a member deciding whether to trust this Chama.
//
// This file defines the SMALLER whitelist of actions that actually speak
// to trust — money movements, governance changes, and accountability
// events — plus a human-readable label for each. Anything not listed
// here is deliberately left out of the member-facing timeline, not
// hidden by an access check.
//
// ========================================

export const TRUST_TIMELINE_ACTIONS = [
  // Membership & governance
  'MEMBER_ADDED',
  'MEMBER_REMOVED',
  'MEMBER_STATUS_UPDATED',
  'MEMBER_ROLE_UPDATED',
  'MEMBER_JOIN_APPROVED',
  'MEMBER_JOIN_REJECTED',
  'TREASURER_TRANSFERRED',
  'CHAMA_SUSPENDED',
  'CHAMA_ACTIVATED',

  // Loans — the highest-trust-sensitivity area of a chama
  'LOAN_APPROVED',
  'LOAN_REJECTED',
  'LOAN_DISBURSED',
  'LOAN_DEFAULTED',
  'LOAN_RECOVERY_APPLIED',
  'LOAN_CLOSED',
  'LOAN_POLICY_UPDATED',

  // Payouts & rotations
  'PAYOUT_TRIGGERED',
  'PAYOUT_ORDER_UPDATED',

  // Corrections — a reversal is exactly the kind of event members should
  // be able to see happened, not just officials.
  'SAVING_REVERSED',

  // Accountability — official conduct, not just member conduct. Shown
  // as a generic "something happened" line with no dispute content or
  // rating value attached (see dispute.service.js / officialRating.
  // service.js) — the point is that every member can see accountability
  // mechanisms are actually being used, not read anyone's complaint.
  'DISPUTE_RAISED',
  'DISPUTE_RESOLVED',
  'DISPUTE_DISMISSED',
  'OFFICIAL_RATING_SUBMITTED',
];

// Category groups the icon/tone shown in the UI — kept separate from the
// label so the frontend doesn't need to string-match action names.
export const TRUST_TIMELINE_CATEGORIES = {
  MEMBER_ADDED: 'membership',
  MEMBER_REMOVED: 'membership',
  MEMBER_STATUS_UPDATED: 'membership',
  MEMBER_ROLE_UPDATED: 'membership',
  MEMBER_JOIN_APPROVED: 'membership',
  MEMBER_JOIN_REJECTED: 'membership',
  TREASURER_TRANSFERRED: 'governance',
  CHAMA_SUSPENDED: 'governance',
  CHAMA_ACTIVATED: 'governance',

  LOAN_APPROVED: 'loan',
  LOAN_REJECTED: 'loan',
  LOAN_DISBURSED: 'loan',
  LOAN_DEFAULTED: 'loan',
  LOAN_RECOVERY_APPLIED: 'loan',
  LOAN_CLOSED: 'loan',
  LOAN_POLICY_UPDATED: 'loan',

  PAYOUT_TRIGGERED: 'payout',
  PAYOUT_ORDER_UPDATED: 'payout',

  SAVING_REVERSED: 'correction',

  DISPUTE_RAISED: 'accountability',
  DISPUTE_RESOLVED: 'accountability',
  DISPUTE_DISMISSED: 'accountability',
  OFFICIAL_RATING_SUBMITTED: 'accountability',
};

// Present-tense, member-readable label per action. `{actor}` and any
// other placeholder is substituted by trustTimeline.service.js from the
// log's actor/metadata — falls back to the raw label if a placeholder
// value isn't available.
export const TRUST_TIMELINE_LABELS = {
  MEMBER_ADDED: '{actor} added a new member to the chama',
  MEMBER_REMOVED: '{actor} removed a member from the chama',
  MEMBER_STATUS_UPDATED: '{actor} updated a member\u2019s status',
  MEMBER_ROLE_UPDATED: '{actor} changed a member\u2019s role',
  MEMBER_JOIN_APPROVED: '{actor} approved a member\u2019s request to join',
  MEMBER_JOIN_REJECTED: '{actor} declined a member\u2019s request to join',
  TREASURER_TRANSFERRED: '{actor} transferred the Treasurer role',
  CHAMA_SUSPENDED: '{actor} suspended the chama',
  CHAMA_ACTIVATED: '{actor} reactivated the chama',

  LOAN_APPROVED: '{actor} approved a loan application',
  LOAN_REJECTED: '{actor} rejected a loan application',
  LOAN_DISBURSED: '{actor} disbursed an approved loan',
  LOAN_DEFAULTED: 'A loan was marked as defaulted',
  LOAN_RECOVERY_APPLIED: '{actor} applied loan recovery action',
  LOAN_CLOSED: 'A loan was closed out',
  LOAN_POLICY_UPDATED: '{actor} updated the chama\u2019s loan policy',

  PAYOUT_TRIGGERED: '{actor} triggered a payout',
  PAYOUT_ORDER_UPDATED: '{actor} updated the payout rotation order',

  SAVING_REVERSED: '{actor} reversed a savings entry',

  DISPUTE_RAISED: '{actor} raised a dispute for the committee to look into',
  DISPUTE_RESOLVED: '{actor} marked a dispute as resolved',
  DISPUTE_DISMISSED: '{actor} dismissed a dispute',
  OFFICIAL_RATING_SUBMITTED: '{actor} submitted a rating for a chama official',
};