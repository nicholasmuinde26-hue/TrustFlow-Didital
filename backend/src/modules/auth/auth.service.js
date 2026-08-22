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
const generateAndSendOtp = async (user, requestedChannel) => {
  const channel = resolveOtpChannel(requestedChannel, user);

  const otpCode = generateOtpCode(6);
  const expiryMinutes = env?.otpExpiresInMinutes || 5;

  user.otpCode = otpCode;
  user.otpExpiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);
  user.otpChannel = channel;
  await user.save();

  await deliverOtp({ channel, user, otpCode, expiryMinutes });

  return { expiryMinutes, channel };
};

// ========================================
// SEND STANDALONE OTP
// ========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email) => Boolean(email && EMAIL_REGEX.test(String(email).trim().toLowerCase()));

// ========================================
// SEND STANDALONE OTP
// ========================================

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
    user = await User.findOne({ email: cleanEmail }).select('+otpCode +otpExpiresAt');
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
      '+otpCode +otpExpiresAt'
    );

    if (!user) {
      user = await User.create({
        phone: formattedPhone,
        status: 'unverified',
        isPhoneVerified: false,
      });
    }
  }

  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, channel);

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
    user = await User.create({
      name: name.trim(),
      phone: formattedPhone,
      password: hashedPassword,
      email: trimmedEmail || null,
      status: 'unverified',
      isPhoneVerified: false,
    });
  }

  // 7. Generate & send OTP via the chosen channel (DO NOT issue tokens here)
  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, channel);

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
  };
};

// ========================================
// LOGIN USER (Password + Mandatory OTP)
// ========================================

export const loginUser = async ({ phone, email, identifier, password, channel }) => {
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
      '+password +otpCode +otpExpiresAt'
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
      '+password +otpCode +otpExpiresAt'
    );
  }

  if (!user) {
    throw new AppError('Invalid login credentials', 401);
  }

  // Check account status
  if (user.status === 'inactive') {
    throw new AppError('This user account is inactive', 403);
  }

  if (user.status === 'suspended') {
    throw new AppError('This user account has been suspended', 403);
  }

  // Compare password
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    throw new AppError('Invalid login credentials', 401);
  }

  // If user entered email to log in, default channel to email if channel not explicitly set
  const requestedChannel = channel || (isEmailInput ? 'email' : undefined);

  // Send Security OTP via chosen channel
  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, requestedChannel);

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
  };
};

// ========================================
// VERIFY OTP AND ISSUE TOKENS (Gatekeeper)
// ========================================

export const verifyOtp = async ({ phone, email, identifier, otpCode }) => {
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
      '+otpCode +otpExpiresAt +refreshToken'
    );
  } else {
    const formattedPhone = formatPhone(term);
    user = await User.findOne({ phone: formattedPhone }).select(
      '+otpCode +otpExpiresAt +refreshToken'
    );
  }

  if (!user || !user.otpCode) {
    throw new AppError('No pending OTP request found for this account', 400);
  }

  // Check OTP expiration
  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new AppError('OTP code has expired. Please log in again to receive a new code.', 400);
  }

  // Check OTP match
  if (user.otpCode !== otpCode.trim()) {
    throw new AppError('Invalid OTP code. Please try again.', 400);
  }

  // Clear OTP fields & activate status
  user.otpCode = undefined;
  user.otpExpiresAt = undefined;
  user.otpChannel = undefined;
  user.isPhoneVerified = true;

  if (user.status === 'unverified') {
    user.status = 'active';
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