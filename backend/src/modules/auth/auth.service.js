import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateOtpCode,
  generateToken,
} from '../../utils/jwt.js';
import AppError from '../../utils/AppError.js';
import { formatPhone, isValidKenyanPhone } from '../../utils/phone.js';
import { buildUserProfileUpdates } from '../../utils/Userprofile.js';
import env from '../../config/env.js';
import {
  getAvailableOtpChannels,
  resolveOtpChannel,
  deliverOtp,
} from '../../services/notifications/otpDelivery.service.js';
import { ingestEvent as ingestSecurityEvent } from '../security/security.service.js';

// ========================================
// SECURITY TELEMETRY (failed logins / OTP attempts)
// ========================================
//
// TrustOS observes authentication as it happens so the Security console's
// risk-signal dashboard has real failed-login and OTP-retry data to show,
// not just the transaction telemetry the payments/payouts modules emit.
// Same isolation pattern as payout.service.js: telemetry must never make
// a login attempt fail or succeed differently, so every call here is
// fire-and-forget and swallows its own errors.
const recordFailedLogin = async (reason, user, context) => {
  try {
    await ingestSecurityEvent({
      eventType: 'AUTH.LOGIN_FAILED',
      actor: user ? { userId: user._id, role: user.systemRole || user.role } : undefined,
      device: context?.deviceId ? { deviceId: context.deviceId } : undefined,
      network: context?.ip ? { ip: context.ip } : undefined,
      metadata: { reason, userAgent: context?.userAgent },
    });
  } catch (telemetryError) {
    console.error('TrustOS telemetry failed for login attempt', telemetryError.message);
  }
};

const recordFailedOtp = async (reason, user, context) => {
  try {
    await ingestSecurityEvent({
      eventType: 'AUTH.OTP_FAILED',
      actor: user ? { userId: user._id, role: user.systemRole || user.role } : undefined,
      device: context?.deviceId ? { deviceId: context.deviceId } : undefined,
      network: context?.ip ? { ip: context.ip } : undefined,
      metadata: { reason, userAgent: context?.userAgent },
    });
  } catch (telemetryError) {
    console.error('TrustOS telemetry failed for OTP attempt', telemetryError.message);
  }
};

// ========================================
// OTP HASHING
// ========================================
//
// OTPs were stored in plaintext, so any read access to the users
// collection yielded live, usable login codes. They're hashed now.
//
// A plain SHA-256 is the right tool here rather than bcrypt: the input
// is a 6-digit code with only a million possibilities, so no amount of
// work factor makes it resistant to offline brute force. The keyed
// HMAC is what actually protects it - an attacker with the database
// but not JWT_ACCESS_SECRET cannot build the lookup table. The real
// defence against online guessing is the attempt cap in verifyOtp().
export const hashOtp = (code) =>
  crypto
    .createHmac('sha256', env.jwtAccessSecret)
    .update(String(code).trim())
    .digest('hex');

// Constant-time compare so verification time doesn't leak how much of
// the code was correct.
export const otpMatches = (provided, storedHash) => {
  if (!provided || !storedHash) return false;

  const a = Buffer.from(hashOtp(provided), 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

// ========================================
// INTERNAL HELPERS
// ========================================

// Issue both Access and Refresh tokens upon successful OTP verification
const issueTokens = async (user) => {
  const tokenGen = generateAccessToken || generateToken;
  const accessToken = tokenGen(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};

// Generate 6-digit OTP, attach to user document, save, and dispatch via the
// user's chosen delivery channel (sms | email | whatsapp)
export const generateAndSendOtp = async (user, requestedChannel) => {
  const channel = resolveOtpChannel(requestedChannel, user);

  const otpCode = generateOtpCode(6);
  const expiryMinutes = env?.otpExpiresInMinutes || 5;

  // Persist only the hash. The plaintext lives in this function scope
  // just long enough to be delivered, and is never written anywhere.
  user.otpCodeHash = hashOtp(otpCode);
  user.otpExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  user.otpChannel = channel;
  user.otpAttempts = 0;
  await user.save();

  await deliverOtp({ channel, user, otpCode, expiryMinutes });

  // otpCode is returned so the caller can echo it under the demo
  // autofill flag (non-production only) without re-reading it from the
  // user document, which no longer holds it.
  return { expiryMinutes, channel, otpCode };
};

// ========================================
// SEND STANDALONE OTP
// ========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => Boolean(email && EMAIL_REGEX.test(String(email).trim().toLowerCase()));

// ========================================
// SEND STANDALONE OTP
// ========================================

const isDev = () =>
  process.env.NODE_ENV === 'development' || env?.nodeEnv === 'development';

export const sendOtp = async ({ phone, email, identifier, channel }) => {
  const term = (identifier || email || phone || '').trim();

  if (!term) {
    throw new AppError('Phone number or email address is required', 400);
  }

  let user;
  let formattedPhone;

  if (term.includes('@')) {
    if (!isValidEmail(term)) {
      throw new AppError('Invalid email address format', 400);
    }
    const cleanEmail = term.toLowerCase();
    user = await User.findOne({ email: cleanEmail }).select('+otpCodeHash +otpExpiresAt +otpAttempts');
    if (!user) {
      throw new AppError('No account found with this email address', 404);
    }
  } else {
    formattedPhone = formatPhone(term);
    if (!isValidKenyanPhone(formattedPhone)) {
      throw new AppError(
        'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
        400
      );
    }

    user = await User.findOne({ phone: formattedPhone }).select(
      '+otpCodeHash +otpExpiresAt +otpAttempts'
    );

    if (!user) {
      user = await User.create({
        phone: formattedPhone,
        status: 'unverified',
        isPhoneVerified: false,
      });
    }
  }

  const { expiryMinutes, channel: usedChannel, otpCode: issuedOtpCode } =
    await generateAndSendOtp(user, channel);
  const isDevEnv = isDev();

  return {
    otpRequired: true,
    message: `OTP sent successfully via ${usedChannel} to ${
      usedChannel === 'email' ? user.email : user.phone
    }`,
    phone: user.phone,
    email: user.email,
    identifier: usedChannel === 'email' ? user.email : user.phone,
    channel: usedChannel,
    availableChannels: getAvailableOtpChannels(user),
    expiresInMinutes: expiryMinutes,
    ...(env.demoOtpAutofill && usedChannel === 'sms'
      ? { devOtp: issuedOtpCode, demoAutofill: true }
      : {}),
  };
};

// ========================================
// LIST OTP CHANNELS AVAILABLE FOR AN IDENTIFIER (PHONE OR EMAIL)
// ========================================

export const getOtpChannelsForPhone = async ({ phone, email, identifier }) => {
  const term = (identifier || email || phone || '').trim();

  if (!term) {
    throw new AppError('Phone number or email address is required', 400);
  }

  let user;
  let identifierResult = term;

  if (term.includes('@')) {
    if (isValidEmail(term)) {
      const cleanEmail = term.toLowerCase();
      user = await User.findOne({ email: cleanEmail });
      identifierResult = cleanEmail;
    }
  } else {
    try {
      const formattedPhone = formatPhone(term);
      if (isValidKenyanPhone(formattedPhone)) {
        user = await User.findOne({ phone: formattedPhone });
        identifierResult = formattedPhone;
      }
    } catch {
      // Fallback
    }
  }

  const channels = getAvailableOtpChannels(user || (term.includes('@') ? { email: term.toLowerCase() } : { phone: term }));

  return { identifier: identifierResult, phone: user?.phone, email: user?.email, availableChannels: channels };
};

// ========================================
// REGISTER USER (Password + Mandatory OTP)
// ========================================

export const registerUser = async ({ name, phone, password, email, channel }) => {
  // 1. Input validations
  if (!name || !name.trim()) {
    throw new AppError('Name is required', 400);
  }

  if (!phone || !phone.trim()) {
    throw new AppError('Phone number is required', 400);
  }

  if (!password) {
    throw new AppError('Password is required', 400);
  }

  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  // 2. Phone format validation
  const formattedPhone = formatPhone(phone);

  if (!isValidKenyanPhone(formattedPhone)) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }

  // 3. Email validation & duplicate check
  const trimmedEmail = email && email.trim() ? email.trim().toLowerCase() : undefined;

  if (trimmedEmail && !isValidEmail(trimmedEmail)) {
    throw new AppError('Enter a valid email address', 400);
  }

  if (channel === 'email' && !trimmedEmail) {
    throw new AppError('Email address is required for Email OTP delivery.', 400);
  }

  if (trimmedEmail) {
    const existingEmailUser = await User.findOne({ email: trimmedEmail });
    if (existingEmailUser && existingEmailUser.status !== 'unverified' && existingEmailUser.phone !== formattedPhone) {
      throw new AppError('A user with this email address already exists', 409);
    }
  }

  // 4. Check duplicate user by phone
  const existingUser = await User.findOne({ phone: formattedPhone });

  if (existingUser && existingUser.status !== 'unverified') {
    throw new AppError('A user with this phone number already exists', 409);
  }

  // 5. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 6. Create/Update user in 'unverified' status
  let user;
  if (existingUser && existingUser.status === 'unverified') {
    existingUser.name = name.trim();
    existingUser.password = hashedPassword;
    if (trimmedEmail) existingUser.email = trimmedEmail;
    user = await existingUser.save();
  } else {
    const isSuperAdmin = Boolean(
      trimmedEmail &&
      env?.superAdminEmail &&
      trimmedEmail.toLowerCase() === env.superAdminEmail.toLowerCase()
    );

    user = await User.create({
      name: name.trim(),
      phone: formattedPhone,
      password: hashedPassword,
      email: trimmedEmail || null,
      status: 'unverified',
      isPhoneVerified: false,
      systemRole: isSuperAdmin ? 'super_admin' : 'user',
    });
  }

  // 7. Generate & send OTP via the chosen channel (DO NOT issue tokens here)
  const { expiryMinutes, channel: usedChannel, otpCode: issuedOtpCode } =
    await generateAndSendOtp(user, channel);
  const isDevEnv = isDev();

  return {
    otpRequired: true,
    phone: formattedPhone,
    email: user.email,
    identifier: usedChannel === 'email' ? user.email : formattedPhone,
    channel: usedChannel,
    availableChannels: getAvailableOtpChannels(user),
    message: `Account created. Security OTP code sent via ${usedChannel} to ${
      usedChannel === 'email' ? user.email : formattedPhone
    }`,
    expiresInMinutes: expiryMinutes,
    ...(env.demoOtpAutofill && usedChannel === 'sms'
      ? { devOtp: issuedOtpCode, demoAutofill: true }
      : {}),
  };
};

// ========================================
// LOGIN USER (Password + Mandatory OTP)
// ========================================

export const loginUser = async ({ phone, email, identifier, password, channel, context }) => {
  const term = (identifier || email || phone || '').trim();

  // 1. Input validations
  if (!term) {
    throw new AppError('Phone number or email address is required', 400);
  }

  if (!password) {
    throw new AppError('Password is required', 400);
  }

  let user;
  let isEmailInput = term.includes('@');

  if (isEmailInput) {
    if (!isValidEmail(term)) {
      throw new AppError('Enter a valid email address', 400);
    }
    user = await User.findOne({ email: term.toLowerCase() }).select(
      '+password +otpCodeHash +otpExpiresAt +otpAttempts'
    );
  } else {
    const formattedPhone = formatPhone(term);

    if (!isValidKenyanPhone(formattedPhone)) {
      throw new AppError(
        'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
        400
      );
    }

    user = await User.findOne({ phone: formattedPhone }).select(
      '+password +otpCodeHash +otpExpiresAt +otpAttempts'
    );
  }

  if (!user) {
    await recordFailedLogin('unknown_identifier', null, context);
    throw new AppError('Invalid login credentials', 401);
  }

  // Check account status
  if (user.status === 'inactive') {
    await recordFailedLogin('account_inactive', user, context);
    throw new AppError('This user account is inactive', 403);
  }

  if (user.status === 'suspended') {
    await recordFailedLogin('account_suspended', user, context);
    throw new AppError('This user account has been suspended', 403);
  }

  // Some accounts are created without a password at all — e.g. a
  // treasurer/chairperson adding a member by phone number
  // (chama.service.js), a business/contribution-group client
  // placeholder, an admin-created account, or a USSD registration.
  // Those are left in 'unverified' status with password unset until
  // the person completes registerUser() themselves. Calling
  // bcrypt.compare() with an undefined hash throws a raw "Illegal
  // arguments" error and 500s the request, so check for this case
  // explicitly first and point them at the actual fix.
  if (!user.password) {
    await recordFailedLogin('password_not_configured', user, context);
    throw new AppError(
      'This account has not set up a password yet. Please complete registration with this phone number or email to set one.',
      401
    );
  }

  // Compare password
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    await recordFailedLogin('invalid_password', user, context);
    throw new AppError('Invalid login credentials', 401);
  }

  // If user entered email to log in, default channel to email if channel not explicitly set
  const requestedChannel = channel || (isEmailInput ? 'email' : undefined);

  // Send Security OTP via chosen channel
  const { expiryMinutes, channel: usedChannel, otpCode: issuedOtpCode } =
    await generateAndSendOtp(user, requestedChannel);
  const isDevEnv = isDev();

  return {
    otpRequired: true,
    phone: user.phone,
    email: user.email,
    identifier: usedChannel === 'email' ? user.email : user.phone,
    channel: usedChannel,
    availableChannels: getAvailableOtpChannels(user),
    message: `Password verified. Security OTP code sent via ${usedChannel} to ${
      usedChannel === 'email' ? user.email : user.phone
    }`,
    expiresInMinutes: expiryMinutes,
    ...(env.demoOtpAutofill && usedChannel === 'sms'
      ? { devOtp: issuedOtpCode, demoAutofill: true }
      : {}),
  };
};

// ========================================
// VERIFY OTP AND ISSUE TOKENS (Gatekeeper)
// ========================================

export const verifyOtp = async ({ phone, email, identifier, otpCode, context }) => {
  const term = (identifier || email || phone || '').trim();

  if (!term) {
    throw new AppError('Phone number or email address is required', 400);
  }

  if (!otpCode || !otpCode.trim()) {
    throw new AppError('OTP code is required', 400);
  }

  let user;

  if (term.includes('@')) {
    user = await User.findOne({ email: term.toLowerCase() }).select(
      '+otpCodeHash +otpExpiresAt +otpAttempts +refreshToken'
    );
  } else {
    const formattedPhone = formatPhone(term);
    user = await User.findOne({ phone: formattedPhone }).select(
      '+otpCodeHash +otpExpiresAt +otpAttempts +refreshToken'
    );
  }

  if (!user || !user.otpCodeHash) {
    await recordFailedOtp('no_pending_otp', user, context);
    throw new AppError('No pending OTP request found for this account', 400);
  }

  // Check OTP expiration
  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    user.otpCodeHash = undefined;
    user.otpAttempts = 0;
    await user.save();
    await recordFailedOtp('expired_otp', user, context);
    throw new AppError('OTP code has expired. Please log in again to receive a new code.', 400);
  }

  // ----------------------------------------------------------
  // ATTEMPT CAP
  // ----------------------------------------------------------
  //
  // A 6-digit OTP is a 1,000,000-guess space. With no cap and no rate
  // limit, that is minutes of automated guessing against a code that
  // stays valid for ten of them. The cap burns the code once exceeded,
  // so an attacker gets env.otpMaxAttempts tries per DELIVERED code
  // rather than unlimited tries per code.
  //
  // The universal '123456' development bypass that used to sit here is
  // gone. It was gated on NODE_ENV, which defaulted to 'development' —
  // so an unset NODE_ENV on a live server turned '123456' into a valid
  // OTP for every account on the platform.
  const maxAttempts = env?.otpMaxAttempts || 5;
  const attemptsSoFar = Number(user.otpAttempts || 0);

  if (attemptsSoFar >= maxAttempts) {
    user.otpCodeHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpChannel = undefined;
    user.otpAttempts = 0;
    await user.save();

    await recordFailedOtp('too_many_attempts', user, context);
    throw new AppError(
      'Too many incorrect attempts. Request a new code to continue.',
      429
    );
  }

  if (!otpMatches(otpCode, user.otpCodeHash)) {
    user.otpAttempts = attemptsSoFar + 1;
    await user.save();

    await recordFailedOtp('invalid_otp', user, context);

    const remaining = Math.max(0, maxAttempts - user.otpAttempts);
    throw new AppError(
      remaining > 0
        ? `Invalid OTP code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Invalid OTP code. Request a new code to continue.',
      400
    );
  }

  // Clear OTP fields & activate status
  user.otpCodeHash = undefined;
  user.otpExpiresAt = undefined;
  user.otpChannel = undefined;
  user.otpAttempts = 0;
  user.isPhoneVerified = true;

  if (user.status === 'unverified') {
    user.status = 'active';
  }

  if (
    user.email &&
    env?.superAdminEmail &&
    user.email.toLowerCase() === env.superAdminEmail.toLowerCase() &&
    user.systemRole !== 'super_admin'
  ) {
    user.systemRole = 'super_admin';
  }

  // Issue Short-Lived Access + Refresh Tokens
  const { accessToken, refreshToken } = await issueTokens(user);

  const userResponse = user.toObject();

  return {
    user: userResponse,
    accessToken,
    refreshToken,
  };
};

// ========================================
// REFRESH ACCESS TOKEN
// ========================================

export const refreshAccessToken = async (providedRefreshToken) => {
  if (!providedRefreshToken) {
    throw new AppError('Refresh token is required', 401);
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(providedRefreshToken);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token. Please log in again.', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshToken');

  if (!user || user.refreshToken !== providedRefreshToken) {
    throw new AppError('Refresh token is invalid or has been revoked', 401);
  }

  const tokenGen = generateAccessToken || generateToken;
  const newAccessToken = tokenGen(user._id);

  return {
    accessToken: newAccessToken,
  };
};

// ========================================
// GET CURRENT USER
// ========================================

export const getCurrentUser = async (userId) => {
  const user = await User.findById(userId).select('-password');

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (
    user.email &&
    env?.superAdminEmail &&
    user.email.toLowerCase() === env.superAdminEmail.toLowerCase() &&
    user.systemRole !== 'super_admin'
  ) {
    user.systemRole = 'super_admin';
    await user.save();
  }

  if (user.status === 'inactive') {
    throw new AppError('This user account is inactive', 403);
  }

  if (user.status === 'suspended') {
    throw new AppError('This user account has been suspended', 403);
  }

  return user;
};

// ========================================
// UPDATE CURRENT USER PROFILE
// ========================================
//
// Self-service profile editing:
// name, phone, email, id_number, avatar_url.
//
// ========================================

export const updateCurrentUser = async (userId, updates) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.status === 'inactive') {
    throw new AppError('This user account is inactive', 403);
  }

  if (user.status === 'suspended') {
    throw new AppError('This user account has been suspended', 403);
  }

  const set = await buildUserProfileUpdates({
    targetUser: user,
    updates,
  });

  Object.assign(user, set);

  await user.save();

  return user;
};
