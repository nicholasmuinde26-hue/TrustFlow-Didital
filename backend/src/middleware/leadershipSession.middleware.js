import AppError from '../utils/AppError.js';
import ChamaMembership from '../models/ChamaMembership.js';
import {
  verifyLeadershipToken,
  STEP_UP_ACTIONS
} from '../utils/leadershipToken.js';

// ========================================
// LEADERSHIP SESSION MIDDLEWARE
// ========================================
//
// The point of these two guards: the Leadership Desk PIN must not be
// skippable by bypassing the UI. Without them, anyone holding a valid
// access token for a treasurer/chairperson could simply POST straight
// to the sensitive endpoint and never see a PIN screen — the PIN would
// be decoration.
//
// So sensitive routes require BOTH:
//
//   Authorization: Bearer <access token>   -> who you are
//   X-Leadership-Token: <leadership token> -> you re-proved it just now
//
// Run AFTER requireChamaMember (needs req.chama / req.membership) and
// after the relevant role gate. This is an additional factor, never a
// replacement for the role check.
//
// Both guards fail with a machine-readable `code` so the client can
// tell "show the PIN screen again" apart from "you aren't allowed here
// at all" — the two need very different UI.
//
// ========================================

const readToken = (req) =>
  req.headers['x-leadership-token'] ||
  req.headers['x-leadership-session'] ||
  null;

const deny = (message, code, status = 401) => {
  const error = new AppError(message, status);
  error.code = code;
  return error;
};

// Confirms the token was minted for THIS user, THIS chama, THIS
// membership — and against the PIN as it currently stands. Changing or
// resetting the PIN bumps leadership_pin_version, which is how every
// outstanding unlocked session dies the moment the PIN changes.
const assertTokenMatchesContext = async (payload, req) => {
  if (String(payload.sub) !== String(req.user._id)) {
    throw deny('Leadership session does not belong to you', 'LEADERSHIP_TOKEN_MISMATCH', 403);
  }

  if (String(payload.chama_id) !== String(req.chama._id)) {
    throw deny(
      'Leadership session was issued for a different Chama',
      'LEADERSHIP_TOKEN_WRONG_CHAMA',
      403
    );
  }

  if (String(payload.membership_id) !== String(req.membership._id)) {
    throw deny(
      'Leadership session does not match your membership',
      'LEADERSHIP_TOKEN_MISMATCH',
      403
    );
  }

  const current = await ChamaMembership.findById(req.membership._id)
    .select('role status leadership_pin_version')
    .lean();

  if (!current || current.status !== 'active') {
    throw deny('Your Chama membership is no longer active', 'MEMBERSHIP_INACTIVE', 403);
  }

  // Being demoted mid-session shouldn't leave a valid leadership token
  // floating around with the old role baked into it.
  if (current.role !== payload.role) {
    throw deny(
      'Your role changed since this Leadership session started. Unlock again.',
      'LEADERSHIP_ROLE_CHANGED',
      401
    );
  }

  if (Number(current.leadership_pin_version || 0) !== Number(payload.pin_version || 0)) {
    throw deny(
      'Your Leadership PIN changed since this session started. Unlock again.',
      'LEADERSHIP_PIN_ROTATED',
      401
    );
  }
};

// ========================================
// REQUIRE AN UNLOCKED DESK
// ========================================
//
// Use on ordinary Leadership Desk mutations: saving governance
// settings, approving a join request, sending an invite.
//
// ========================================

export const requireLeadershipSession = async (req, res, next) => {
  try {
    if (!req.user || !req.chama || !req.membership) {
      throw new AppError(
        'Leadership session check requires Chama membership context',
        500
      );
    }

    const token = readToken(req);

    if (!token) {
      throw deny(
        'Enter your Leadership Desk PIN to continue',
        'LEADERSHIP_PIN_REQUIRED'
      );
    }

    const payload = verifyLeadershipToken(token);

    if (!payload) {
      throw deny(
        'Your Leadership Desk session expired. Enter your PIN again.',
        'LEADERSHIP_SESSION_EXPIRED'
      );
    }

    // A step-up token is scoped to exactly one action and is not a
    // general pass into the desk, so it does not satisfy this guard.
    if (payload.scope !== 'desk') {
      throw deny(
        'That confirmation cannot be used as a Leadership Desk session',
        'LEADERSHIP_TOKEN_WRONG_SCOPE',
        403
      );
    }

    await assertTokenMatchesContext(payload, req);

    req.leadershipSession = payload;

    next();
  } catch (error) {
    next(error);
  }
};

// ========================================
// REQUIRE A FRESH PIN FOR ONE ACTION
// ========================================
//
// Use on the genuinely destructive endpoints. The desk being unlocked
// is not enough here: the leader must have re-entered the PIN seconds
// ago, specifically for this action.
//
// Binding the token to an action name is what stops a step-up minted
// for a harmless-looking confirmation being replayed against
// "delete chama".
//
// Usage:
//   requireLeadershipStepUp(STEP_UP_ACTIONS.DELETE_CHAMA)
//
// ========================================

export const requireLeadershipStepUp = (action) => {
  if (!Object.values(STEP_UP_ACTIONS).includes(action)) {
    throw new Error(`requireLeadershipStepUp: unknown action "${action}"`);
  }

  return async (req, res, next) => {
    try {
      if (!req.user || !req.chama || !req.membership) {
        throw new AppError(
          'Leadership step-up check requires Chama membership context',
          500
        );
      }

      const token = readToken(req);

      if (!token) {
        const error = deny(
          'Re-enter your Leadership Desk PIN to confirm this action',
          'LEADERSHIP_STEP_UP_REQUIRED'
        );
        error.stepUpAction = action;
        throw error;
      }

      const payload = verifyLeadershipToken(token);

      if (!payload) {
        const error = deny(
          'That confirmation expired. Re-enter your PIN.',
          'LEADERSHIP_STEP_UP_EXPIRED'
        );
        error.stepUpAction = action;
        throw error;
      }

      if (payload.scope !== 'step_up' || payload.action !== action) {
        const error = deny(
          'Re-enter your Leadership Desk PIN to confirm this action',
          'LEADERSHIP_STEP_UP_REQUIRED'
        );
        error.stepUpAction = action;
        throw error;
      }

      await assertTokenMatchesContext(payload, req);

      req.leadershipStepUp = payload;

      next();
    } catch (error) {
      next(error);
    }
  };
};

export { STEP_UP_ACTIONS };
