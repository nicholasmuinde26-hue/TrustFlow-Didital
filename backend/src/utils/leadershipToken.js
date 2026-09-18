import jwt from 'jsonwebtoken';

import env from '../config/env.js';

// ========================================
// LEADERSHIP SESSION TOKENS
// ========================================
//
// The Leadership Desk PIN cannot be a UI-only gate. If the only thing
// standing between a stolen/borrowed logged-in session and "delete this
// chama" is a React screen, the attacker just calls the API directly
// with the JWT they already have. So unlocking the desk mints a SECOND,
// separate token that sensitive routes demand in addition to the normal
// access token.
//
// Two scopes:
//
//   'desk'    — issued on a successful PIN unlock. Grants access to the
//               Leadership Desk's read endpoints and its ordinary
//               mutations. Short TTL (default 15m) as a hard ceiling;
//               the client additionally drops it from memory whenever
//               the user navigates away from the desk, so in practice
//               it usually dies much sooner.
//
//   'step_up' — issued on a PIN re-confirmation immediately before one
//               specific high-risk action (delete chama, loan policy
//               change, disbursement, role change). Very short TTL
//               (default 3m), single action, and bound to that action
//               name so a step-up minted for "change loan policy"
//               cannot be replayed against "delete chama".
//
// Both are signed with a dedicated secret so a leaked leadership token
// can never be mistaken for an access token (and vice versa), and both
// are bound to (user, chama, membership, pin_version). Bumping
// pin_version — which every PIN change/reset does — instantly kills all
// outstanding desk sessions.
//
// ========================================

const LEADERSHIP_SECRET =
  process.env.LEADERSHIP_PIN_SECRET ||
  `${env?.jwtAccessSecret || 'dev-access-secret-change-in-prod'}::leadership`;

export const DESK_TTL_SECONDS =
  Number(process.env.LEADERSHIP_DESK_TTL_SECONDS) || 15 * 60;

export const STEP_UP_TTL_SECONDS =
  Number(process.env.LEADERSHIP_STEP_UP_TTL_SECONDS) || 3 * 60;

// Actions that require a fresh PIN re-confirmation even when the desk
// is already unlocked. Keep this list short and genuinely destructive —
// prompting for the PIN on everything trains people to type it blindly,
// which is exactly the habit that makes a second factor worthless.
export const STEP_UP_ACTIONS = Object.freeze({
  DELETE_CHAMA: 'delete_chama',
  UPDATE_LOAN_POLICY: 'update_loan_policy',
  DISBURSE_FUNDS: 'disburse_funds',
  CHANGE_MEMBER_ROLE: 'change_member_role',
  UPDATE_PAYMENT_DETAILS: 'update_payment_details'
});

const isKnownStepUpAction = (action) =>
  Object.values(STEP_UP_ACTIONS).includes(action);

// ========================================
// SIGN DESK TOKEN
// ========================================

export const signDeskToken = ({
  userId,
  chamaId,
  membershipId,
  role,
  pinVersion
}) => {
  const expiresIn = DESK_TTL_SECONDS;

  const token = jwt.sign(
    {
      scope: 'desk',
      sub: String(userId),
      chama_id: String(chamaId),
      membership_id: String(membershipId),
      role,
      pin_version: Number(pinVersion) || 0
    },
    LEADERSHIP_SECRET,
    { expiresIn }
  );

  return {
    token,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
  };
};

// ========================================
// SIGN STEP-UP TOKEN
// ========================================

export const signStepUpToken = ({
  userId,
  chamaId,
  membershipId,
  role,
  pinVersion,
  action
}) => {
  if (!isKnownStepUpAction(action)) {
    throw new Error(`Unknown step-up action: ${action}`);
  }

  const expiresIn = STEP_UP_TTL_SECONDS;

  const token = jwt.sign(
    {
      scope: 'step_up',
      action,
      sub: String(userId),
      chama_id: String(chamaId),
      membership_id: String(membershipId),
      role,
      pin_version: Number(pinVersion) || 0
    },
    LEADERSHIP_SECRET,
    { expiresIn }
  );

  return {
    token,
    action,
    expiresIn,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
  };
};

// ========================================
// VERIFY
// ========================================
//
// Returns the decoded payload, or null for anything invalid/expired.
// Callers decide what a null means (usually a 401 with a code the
// client uses to re-prompt for the PIN).
//
// ========================================

export const verifyLeadershipToken = (token) => {
  if (!token || typeof token !== 'string') return null;

  try {
    return jwt.verify(token, LEADERSHIP_SECRET);
  } catch {
    return null;
  }
};

export default {
  signDeskToken,
  signStepUpToken,
  verifyLeadershipToken,
  STEP_UP_ACTIONS,
  DESK_TTL_SECONDS,
  STEP_UP_TTL_SECONDS
};
