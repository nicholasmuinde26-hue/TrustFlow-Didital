import bcrypt from 'bcryptjs';

import ChamaMembership from '../../models/ChamaMembership.js';
import User from '../../models/User.js';
import AppError from '../../utils/AppError.js';
import { createAuditLog } from '../../services/audit.service.js';
import { sendOtp } from '../auth/auth.service.js';
import {
  signDeskToken,
  signStepUpToken,
  STEP_UP_ACTIONS
} from '../../utils/leadershipToken.js';

// ========================================
// LEADERSHIP PIN SERVICE
// ========================================
//
// Owns everything about the per-leader, per-chama PIN that guards the
// Leadership Desk. The PIN is a SECOND factor layered on top of the
// existing role check — it never replaces it. A treasurer with the
// right PIN is still only a treasurer.
//
// Storage lives on ChamaMembership (see the model), so:
//
//   - the same User can hold a different PIN in each Chama they lead
//   - a plain member has no PIN at all, and no way to set one
//   - losing the seat loses the PIN
//
// ========================================

const PIN_PATTERN = /^\d{4,6}$/;
const BCRYPT_ROUNDS = 10;

// Five wrong attempts, then a cooling-off period. Deliberately generous
// enough that a leader fumbling their PIN on a phone keypad doesn't get
// locked out of their own chama, and short enough that a brute-forcer
// gets roughly nowhere: 5 tries per 15 minutes against a 6-digit space
// is ~5.7 years of guessing.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Roles allowed to hold a Leadership Desk PIN at all. Mirrors
// isManager(role, 'chama') on the frontend and
// requireChamaTreasurerOrChairperson on the backend.
const LEADERSHIP_ROLES = ['treasurer', 'chairperson'];

// ========================================
// INTERNAL HELPERS
// ========================================

const assertLeadershipRole = (membership) => {
  if (!LEADERSHIP_ROLES.includes(membership?.role)) {
    throw new AppError(
      'Only the treasurer or chairperson holds a Leadership Desk PIN',
      403
    );
  }
};

// Load the membership WITH the normally-hidden PIN columns. Everything
// in this file goes through here so the select(...) can never be
// forgotten in one place and silently return null hashes.
const loadMembershipWithPin = async (membershipId) => {
  const membership = await ChamaMembership.findById(membershipId).select(
    '+leadership_pin_hash +leadership_pin_failed_attempts +leadership_pin_locked_until'
  );

  if (!membership) {
    throw new AppError('Chama membership not found', 404);
  }

  return membership;
};

const audit = async ({ actorUserId, chamaId, membershipId, action, metadata }) => {
  // An audit write must never be able to take down the action it is
  // recording — but a silent failure here would also hide exactly the
  // events we care most about, so it's logged loudly to the server.
  try {
    await createAuditLog({
      actorUserId,
      scopeType: 'CHAMA',
      chamaId,
      action,
      resourceType: 'LEADERSHIP_PIN',
      resourceId: membershipId,
      metadata: metadata || null
    });
  } catch (error) {
    console.error('LEADERSHIP PIN AUDIT WRITE FAILED:', action, error.message);
  }
};

const lockoutRemainingMs = (membership) => {
  const until = membership.leadership_pin_locked_until;
  if (!until) return 0;
  const remaining = new Date(until).getTime() - Date.now();
  return remaining > 0 ? remaining : 0;
};

const assertNotLockedOut = (membership) => {
  const remaining = lockoutRemainingMs(membership);

  if (remaining > 0) {
    const minutes = Math.ceil(remaining / 60000);
    throw new AppError(
      `Too many incorrect PIN attempts. Try again in ${minutes} minute${
        minutes === 1 ? '' : 's'
      }, or reset your PIN.`,
      429
    );
  }
};

// Rejects PINs whose only property is being four-to-six digits long.
// A leadership PIN protecting group savings shouldn't be 1234.
const assertPinIsNotTrivial = (pin) => {
  const allSameDigit = /^(\d)\1+$/.test(pin);

  const isSequential = (() => {
    const ascending = pin
      .split('')
      .every((digit, index, all) =>
        index === 0 ? true : Number(digit) === Number(all[index - 1]) + 1
      );

    const descending = pin
      .split('')
      .every((digit, index, all) =>
        index === 0 ? true : Number(digit) === Number(all[index - 1]) - 1
      );

    return ascending || descending;
  })();

  if (allSameDigit || isSequential) {
    throw new AppError(
      'Choose a less predictable PIN — avoid repeated digits (1111) and simple runs (1234).',
      400
    );
  }
};

const assertValidPinFormat = (pin) => {
  if (!PIN_PATTERN.test(String(pin || ''))) {
    throw new AppError('PIN must be 4 to 6 digits', 400);
  }
};

// ========================================
// STATUS
// ========================================
//
// Tells the client which screen to render before the desk loads:
// "create your PIN" vs "enter your PIN" vs "you're locked out".
//
// Deliberately does NOT reveal the failed-attempt count to anyone but
// the PIN's owner — this is only ever called for req.membership.
//
// ========================================

export const getPinStatus = async ({ membership }) => {
  assertLeadershipRole(membership);

  const record = await loadMembershipWithPin(membership._id);
  const remaining = lockoutRemainingMs(record);

  return {
    pinSet: Boolean(record.leadership_pin_hash),
    pinSetAt: record.leadership_pin_set_at || null,
    lockedOut: remaining > 0,
    lockedUntil: remaining > 0 ? record.leadership_pin_locked_until : null,
    attemptsRemaining: Math.max(
      0,
      MAX_FAILED_ATTEMPTS - (record.leadership_pin_failed_attempts || 0)
    ),
    role: record.role
  };
};

// ========================================
// SET PIN (FIRST TIME)
// ========================================

export const setPin = async ({ membership, chamaId, userId, pin }) => {
  assertLeadershipRole(membership);
  assertValidPinFormat(pin);
  assertPinIsNotTrivial(pin);

  const record = await loadMembershipWithPin(membership._id);

  if (record.leadership_pin_hash) {
    throw new AppError(
      'A Leadership Desk PIN is already set. Change it with your current PIN, or reset it by OTP.',
      409
    );
  }

  record.leadership_pin_hash = await bcrypt.hash(String(pin), BCRYPT_ROUNDS);
  record.leadership_pin_set_at = new Date();
  record.leadership_pin_failed_attempts = 0;
  record.leadership_pin_locked_until = null;
  record.leadership_pin_version = (record.leadership_pin_version || 0) + 1;

  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: 'LEADERSHIP_PIN_SET',
    metadata: { role: record.role }
  });

  // Setting the PIN also unlocks the desk — the person just proved they
  // chose it seconds ago; making them immediately type it again is
  // ceremony, not security.
  return signDeskToken({
    userId,
    chamaId,
    membershipId: record._id,
    role: record.role,
    pinVersion: record.leadership_pin_version
  });
};

// ========================================
// CHANGE PIN (KNOWS CURRENT PIN)
// ========================================

export const changePin = async ({ membership, chamaId, userId, currentPin, newPin }) => {
  assertLeadershipRole(membership);
  assertValidPinFormat(newPin);
  assertPinIsNotTrivial(newPin);

  const record = await loadMembershipWithPin(membership._id);

  if (!record.leadership_pin_hash) {
    throw new AppError('No Leadership Desk PIN has been set yet', 400);
  }

  assertNotLockedOut(record);

  const matches = await bcrypt.compare(String(currentPin || ''), record.leadership_pin_hash);

  if (!matches) {
    await registerFailedAttempt({ record, chamaId, userId, reason: 'change_pin' });
    throw new AppError('Current PIN is incorrect', 401);
  }

  record.leadership_pin_hash = await bcrypt.hash(String(newPin), BCRYPT_ROUNDS);
  record.leadership_pin_set_at = new Date();
  record.leadership_pin_failed_attempts = 0;
  record.leadership_pin_locked_until = null;
  record.leadership_pin_version = (record.leadership_pin_version || 0) + 1;

  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: 'LEADERSHIP_PIN_CHANGED',
    metadata: { role: record.role }
  });

  return signDeskToken({
    userId,
    chamaId,
    membershipId: record._id,
    role: record.role,
    pinVersion: record.leadership_pin_version
  });
};

// ========================================
// FAILED ATTEMPT BOOKKEEPING
// ========================================

const registerFailedAttempt = async ({ record, chamaId, userId, reason }) => {
  record.leadership_pin_failed_attempts =
    (record.leadership_pin_failed_attempts || 0) + 1;

  const lockedOut = record.leadership_pin_failed_attempts >= MAX_FAILED_ATTEMPTS;

  if (lockedOut) {
    record.leadership_pin_locked_until = new Date(
      Date.now() + LOCKOUT_MINUTES * 60 * 1000
    );
    record.leadership_pin_failed_attempts = 0;
  }

  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: lockedOut ? 'LEADERSHIP_PIN_LOCKED_OUT' : 'LEADERSHIP_PIN_FAILED',
    metadata: {
      reason,
      role: record.role,
      ...(lockedOut ? { locked_until: record.leadership_pin_locked_until } : {})
    }
  });

  return { lockedOut };
};

// ========================================
// UNLOCK THE DESK
// ========================================

export const unlockDesk = async ({ membership, chamaId, userId, pin }) => {
  assertLeadershipRole(membership);

  const record = await loadMembershipWithPin(membership._id);

  if (!record.leadership_pin_hash) {
    throw new AppError(
      'No Leadership Desk PIN has been set for this seat yet',
      409
    );
  }

  assertNotLockedOut(record);

  const matches = await bcrypt.compare(String(pin || ''), record.leadership_pin_hash);

  if (!matches) {
    const { lockedOut } = await registerFailedAttempt({
      record,
      chamaId,
      userId,
      reason: 'unlock'
    });

    if (lockedOut) {
      throw new AppError(
        `Too many incorrect PIN attempts. The Leadership Desk is locked for ${LOCKOUT_MINUTES} minutes.`,
        429
      );
    }

    throw new AppError(
      `Incorrect PIN. ${
        MAX_FAILED_ATTEMPTS - record.leadership_pin_failed_attempts
      } attempt(s) left before a temporary lockout.`,
      401
    );
  }

  record.leadership_pin_failed_attempts = 0;
  record.leadership_pin_locked_until = null;
  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: 'LEADERSHIP_DESK_UNLOCKED',
    metadata: { role: record.role }
  });

  return signDeskToken({
    userId,
    chamaId,
    membershipId: record._id,
    role: record.role,
    pinVersion: record.leadership_pin_version
  });
};

// ========================================
// STEP UP (RE-CONFIRM PIN FOR ONE ACTION)
// ========================================

export const stepUp = async ({ membership, chamaId, userId, pin, action }) => {
  assertLeadershipRole(membership);

  if (!Object.values(STEP_UP_ACTIONS).includes(action)) {
    throw new AppError('Unknown high-risk action', 400);
  }

  const record = await loadMembershipWithPin(membership._id);

  if (!record.leadership_pin_hash) {
    throw new AppError('No Leadership Desk PIN has been set for this seat', 409);
  }

  assertNotLockedOut(record);

  const matches = await bcrypt.compare(String(pin || ''), record.leadership_pin_hash);

  if (!matches) {
    const { lockedOut } = await registerFailedAttempt({
      record,
      chamaId,
      userId,
      reason: `step_up:${action}`
    });

    if (lockedOut) {
      throw new AppError(
        `Too many incorrect PIN attempts. The Leadership Desk is locked for ${LOCKOUT_MINUTES} minutes.`,
        429
      );
    }

    throw new AppError('Incorrect PIN', 401);
  }

  record.leadership_pin_failed_attempts = 0;
  record.leadership_pin_locked_until = null;
  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: 'LEADERSHIP_PIN_STEP_UP',
    metadata: { role: record.role, step_up_action: action }
  });

  return signStepUpToken({
    userId,
    chamaId,
    membershipId: record._id,
    role: record.role,
    pinVersion: record.leadership_pin_version,
    action
  });
};

// ========================================
// FORGOTTEN PIN — REQUEST OTP
// ========================================
//
// Reuses the existing phone/email OTP delivery the app already runs for
// login and phone verification, rather than inventing a second one-time
// code system. The OTP goes to the leader's own registered contact — an
// attacker holding a hijacked browser session still doesn't hold the
// phone.
//
// ========================================

export const requestPinReset = async ({ membership, chamaId, userId, channel }) => {
  assertLeadershipRole(membership);

  const user = await User.findById(userId).select('phone email');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const identifier = user.phone || user.email;

  if (!identifier) {
    throw new AppError(
      'No phone number or email on file to send a reset code to',
      400
    );
  }

  const result = await sendOtp({ identifier, channel });

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: membership._id,
    action: 'LEADERSHIP_PIN_RESET_REQUESTED',
    metadata: { channel: result.channel }
  });

  return {
    channel: result.channel,
    availableChannels: result.availableChannels,
    expiresInMinutes: result.expiresInMinutes,
    // Masked so the UI can say "sent to ...789" without the response
    // itself becoming a way to read back the leader's full contact.
    sentTo: maskIdentifier(result.identifier),
    ...(result.devOtp ? { devOtp: result.devOtp } : {})
  };
};

const maskIdentifier = (value) => {
  const str = String(value || '');
  if (str.includes('@')) {
    const [name, domain] = str.split('@');
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
  }
  return `${'*'.repeat(Math.max(0, str.length - 3))}${str.slice(-3)}`;
};

// ========================================
// FORGOTTEN PIN — CONFIRM OTP & SET NEW PIN
// ========================================

export const confirmPinReset = async ({ membership, chamaId, userId, otpCode, newPin }) => {
  assertLeadershipRole(membership);
  assertValidPinFormat(newPin);
  assertPinIsNotTrivial(newPin);

  const user = await User.findById(userId).select('+otpCode +otpExpiresAt');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  const expected = user.otpCode;
  const expiresAt = user.otpExpiresAt;

  if (!expected || !expiresAt) {
    throw new AppError('Request a reset code first', 400);
  }

  if (new Date(expiresAt).getTime() < Date.now()) {
    throw new AppError('That reset code has expired. Request a new one.', 400);
  }

  if (String(otpCode || '').trim() !== String(expected)) {
    await audit({
      actorUserId: userId,
      chamaId,
      membershipId: membership._id,
      action: 'LEADERSHIP_PIN_RESET_FAILED',
      metadata: { reason: 'bad_otp' }
    });

    throw new AppError('Incorrect reset code', 401);
  }

  // Burn the OTP whether or not anything downstream succeeds — a code
  // that has been presented once should never be reusable.
  user.otpCode = null;
  user.otpExpiresAt = null;
  await user.save();

  const record = await loadMembershipWithPin(membership._id);

  record.leadership_pin_hash = await bcrypt.hash(String(newPin), BCRYPT_ROUNDS);
  record.leadership_pin_set_at = new Date();
  record.leadership_pin_failed_attempts = 0;
  // A verified OTP clears an active lockout — the whole point of the
  // reset path is to be the way out of one.
  record.leadership_pin_locked_until = null;
  record.leadership_pin_version = (record.leadership_pin_version || 0) + 1;

  await record.save();

  await audit({
    actorUserId: userId,
    chamaId,
    membershipId: record._id,
    action: 'LEADERSHIP_PIN_RESET',
    metadata: { role: record.role }
  });

  return signDeskToken({
    userId,
    chamaId,
    membershipId: record._id,
    role: record.role,
    pinVersion: record.leadership_pin_version
  });
};

export default {
  getPinStatus,
  setPin,
  changePin,
  unlockDesk,
  stepUp,
  requestPinReset,
  confirmPinReset
};
