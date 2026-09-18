// ========================================
// LEADERSHIP SESSION BRIDGE
// ========================================
//
// The axios instance in app/services/api.js is a plain module — it has
// no access to React context. But it needs two things from the
// Leadership session:
//
//   1. the current desk token, to attach as X-Leadership-Token
//   2. a way to ASK the user for their PIN mid-flight, when the server
//      answers LEADERSHIP_STEP_UP_REQUIRED, and then retry
//
// So LeadershipSessionProvider registers itself here on mount, and the
// interceptors read from this module. Keeping it as a tiny mutable
// holder (rather than importing the provider) avoids a circular import
// between the API client and the component tree that uses it.
//
// Everything degrades safely: if no provider is mounted, the getters
// return null and the prompt rejects, so an un-provided app behaves
// exactly as it did before the PIN existed.
//
// ========================================

let getDeskToken = () => null;
let promptForStepUp = () => Promise.reject(new Error('No leadership session provider mounted'));
let onSessionInvalidated = () => {};

export function registerLeadershipSession({ getToken, requestStepUp, invalidate }) {
  if (typeof getToken === 'function') getDeskToken = getToken;
  if (typeof requestStepUp === 'function') promptForStepUp = requestStepUp;
  if (typeof invalidate === 'function') onSessionInvalidated = invalidate;

  return () => {
    getDeskToken = () => null;
    promptForStepUp = () => Promise.reject(new Error('No leadership session provider mounted'));
    onSessionInvalidated = () => {};
  };
}

export function readDeskToken() {
  try {
    return getDeskToken();
  } catch {
    return null;
  }
}

// Returns a step-up token, or throws if the user cancels the prompt.
export function requestStepUpToken({ action, chamaId, message }) {
  return promptForStepUp({ action, chamaId, message });
}

// Called when the server tells us the desk session is dead (expired,
// PIN rotated, role changed) so the provider can drop it and re-gate.
export function invalidateDeskSession(reason) {
  try {
    onSessionInvalidated(reason);
  } catch {
    /* a provider that blew up here must not break the API response */
  }
}

// Response codes the backend uses to signal a PIN is needed. Kept here
// so the interceptor and the provider agree on the vocabulary.
export const LEADERSHIP_CODES = Object.freeze({
  PIN_REQUIRED: 'LEADERSHIP_PIN_REQUIRED',
  SESSION_EXPIRED: 'LEADERSHIP_SESSION_EXPIRED',
  PIN_ROTATED: 'LEADERSHIP_PIN_ROTATED',
  ROLE_CHANGED: 'LEADERSHIP_ROLE_CHANGED',
  STEP_UP_REQUIRED: 'LEADERSHIP_STEP_UP_REQUIRED',
  STEP_UP_EXPIRED: 'LEADERSHIP_STEP_UP_EXPIRED',
});

export const DESK_SESSION_DEAD_CODES = [
  LEADERSHIP_CODES.PIN_REQUIRED,
  LEADERSHIP_CODES.SESSION_EXPIRED,
  LEADERSHIP_CODES.PIN_ROTATED,
  LEADERSHIP_CODES.ROLE_CHANGED,
];

export const STEP_UP_CODES = [
  LEADERSHIP_CODES.STEP_UP_REQUIRED,
  LEADERSHIP_CODES.STEP_UP_EXPIRED,
];
