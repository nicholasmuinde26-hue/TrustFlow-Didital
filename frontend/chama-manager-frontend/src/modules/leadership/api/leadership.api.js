import api from "@/app/services/api";

// ========================================
// LEADERSHIP DESK PIN API
// ========================================
//
// Every call here is about OBTAINING or rotating a leadership session —
// none of them require one, so they never carry X-Leadership-Token
// themselves (the request interceptor will attach the desk token if one
// happens to exist; the backend ignores it on these routes).
//
// All responses that mint a session return the same shape:
//   { token, expiresIn, expiresAt }
// plus `action` on a step-up.
//
// ========================================

const unwrap = (response) => response?.data?.data ?? response?.data;

const leadershipApi = {
  // Which PIN screen should the gate render?
  status(chamaId) {
    return api
      .get(`/chamas/${chamaId}/leadership/pin/status`)
      .then(unwrap);
  },

  // First-time PIN creation. Returns a desk session, so the leader isn't
  // made to immediately re-type the PIN they just chose.
  setPin(chamaId, pin) {
    return api
      .post(`/chamas/${chamaId}/leadership/pin`, { pin })
      .then(unwrap);
  },

  changePin(chamaId, { currentPin, newPin }) {
    return api
      .patch(`/chamas/${chamaId}/leadership/pin`, { currentPin, newPin })
      .then(unwrap);
  },

  unlock(chamaId, pin) {
    return api
      .post(`/chamas/${chamaId}/leadership/unlock`, { pin })
      .then(unwrap);
  },

  // Re-confirm the PIN for one named high-risk action.
  stepUp(chamaId, { pin, action }) {
    return api
      .post(`/chamas/${chamaId}/leadership/step-up`, { pin, action })
      .then(unwrap);
  },

  requestReset(chamaId, channel) {
    return api
      .post(`/chamas/${chamaId}/leadership/pin/reset/request`, { channel })
      .then(unwrap);
  },

  confirmReset(chamaId, { otpCode, newPin }) {
    return api
      .post(`/chamas/${chamaId}/leadership/pin/reset/confirm`, { otpCode, newPin })
      .then(unwrap);
  },
};

export default leadershipApi;

// Mirrors STEP_UP_ACTIONS in backend/src/utils/leadershipToken.js. The
// backend rejects anything outside this set, so keep the two in step.
export const STEP_UP_ACTIONS = Object.freeze({
  DELETE_CHAMA: "delete_chama",
  UPDATE_LOAN_POLICY: "update_loan_policy",
  DISBURSE_FUNDS: "disburse_funds",
  CHANGE_MEMBER_ROLE: "change_member_role",
  UPDATE_PAYMENT_DETAILS: "update_payment_details",
});

// Plain-language labels for the confirmation modal. A PIN prompt that
// just says "confirm this action" teaches people to type the PIN
// reflexively; naming the action is what makes the second factor
// actually protective.
export const STEP_UP_LABELS = Object.freeze({
  [STEP_UP_ACTIONS.DELETE_CHAMA]: {
    title: "Delete this Chama",
    detail:
      "This permanently removes the Chama and every member's association with it. It cannot be undone.",
  },
  [STEP_UP_ACTIONS.UPDATE_LOAN_POLICY]: {
    title: "Change the loan policy",
    detail:
      "Interest rate, multiplier, penalties and approval tiers apply to every member who borrows under them.",
  },
  [STEP_UP_ACTIONS.DISBURSE_FUNDS]: {
    title: "Send money out of the group account",
    detail:
      "Funds leave the Chama account once this completes. Confirm the recipient and amount before continuing.",
  },
  [STEP_UP_ACTIONS.CHANGE_MEMBER_ROLE]: {
    title: "Change a governance role",
    detail:
      "Governance roles decide who can approve, disburse and change the rules of this Chama.",
  },
  [STEP_UP_ACTIONS.UPDATE_PAYMENT_DETAILS]: {
    title: "Change the group's payment details",
    detail:
      "The M-Pesa shortcode and bank account are where the group's money is collected and sent.",
  },
});
