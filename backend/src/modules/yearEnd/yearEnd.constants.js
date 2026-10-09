// ============================================================================
// YEAR-END CONSTANTS
// ============================================================================

// Lifecycle of a financial year's close. This is deliberately separate from
// ChamaFinancialYear.status ('upcoming' | 'active' | 'closed'): the year stays
// 'active' for the whole of 'closing' so the one-active-year-per-chama index
// and getActiveYear() keep working, and only flips to 'closed' at the very end.
export const CLOSE_STATES = Object.freeze({
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed',
});

// Allowed transitions. closing -> open is the abort path (rejected approval,
// cancelled by leadership, or the ledger moved after the snapshot was taken).
// closed is terminal.
export const CLOSE_TRANSITIONS = Object.freeze({
  [CLOSE_STATES.OPEN]: [CLOSE_STATES.CLOSING],
  [CLOSE_STATES.CLOSING]: [CLOSE_STATES.CLOSED, CLOSE_STATES.OPEN],
  [CLOSE_STATES.CLOSED]: [],
});

// Lifecycle of one close attempt (YearEndClose document).
export const RUN_STATES = Object.freeze({
  PENDING_APPROVAL: 'pending_approval',
  SEALED: 'sealed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  STALE: 'stale',
});

// How an account's closing balance is settled when the year ends.
//   retained    - real balance that persists: carries into next year's opening.
//   cleared     - nominal (income/expense): closes out, net result is reported
//                 but nothing carries.
//   distributed - account is fully paid out to members by year end: carries
//                 nothing, and the close REFUSES to start if a balance is left
//                 (otherwise that money would silently disappear).
export const SETTLEMENTS = Object.freeze({
  RETAINED: 'retained',
  CLEARED: 'cleared',
  DISTRIBUTED: 'distributed',
});

// Snapshot movement buckets (signed, in the account's own normal-balance terms).
export const BUCKETS = Object.freeze([
  'contributions',
  'income',
  'expenses',
  'payouts',
  'other',
]);

export const CONTRIBUTION_TX_TYPES = Object.freeze([
  'contribution',
  'contribution_payment',
  'contribution_reversal',
  'mgr_contribution',
  'chama_contribution_payment',
]);

export const PAYOUT_TX_TYPES = Object.freeze([
  'payout',
  'payout_obligation',
  'payout_settlement',
  'payout_cancellation',
  'chama_contrib_payout_settlement',
  'savings_shareout_obligation',
  'savings_shareout_settlement',
  'savings_shareout_cancellation',
  'withdrawal',
  'withdrawal_obligation',
  'withdrawal_settlement',
  'withdrawal_cancellation',
]);

export const APPROVAL_RESOURCE_TYPE = 'YEAR_END_CLOSE';
export const AUDIT_RESOURCE_TYPE = 'YEAR_END_CLOSE';
