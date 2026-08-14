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
import { buildUserProfileUpdates } from '../../utils/userProfile.js';
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

export const sendOtp = async ({ phone, channel }) => {
  if (!phone || !phone.trim()) {
    throw new AppError('Phone number is required', 400);
  }

  const formattedPhone = formatPhone(phone);

  if (!isValidKenyanPhone(formattedPhone)) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }

  let user = await User.findOne({ phone: formattedPhone }).select(
    '+otpCode +otpExpiresAt'
  );

  if (!user) {
    user = await User.create({
      phone: formattedPhone,
      status: 'unverified',
      isPhoneVerified: false,
    });
  }

  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, channel);

  return {
    otpRequired: true,
    message: `OTP sent successfully via ${usedChannel} to ${
      usedChannel === 'email' ? user.email : formattedPhone
    }`,
    phone: formattedPhone,
    channel: usedChannel,
    availableChannels: getAvailableOtpChannels(user),
    expiresInMinutes: expiryMinutes,
  };
};

// ========================================
// LIST OTP CHANNELS AVAILABLE FOR A PHONE NUMBER
// ========================================
//
// Lets the frontend render channel choices (SMS / Email / WhatsApp)
// before the user commits to requesting a code - Email only shows up
// once the account has an email on file.
//
// ========================================

export const getOtpChannelsForPhone = async ({ phone }) => {
  if (!phone || !phone.trim()) {
    throw new AppError('Phone number is required', 400);
  }

  const formattedPhone = formatPhone(phone);

  if (!isValidKenyanPhone(formattedPhone)) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }

  const user = await User.findOne({ phone: formattedPhone });

  // Even for a not-yet-registered phone, SMS/WhatsApp are still viable
  // (a fresh user record gets created when the OTP is actually sent).
  const channels = getAvailableOtpChannels(user || { phone: formattedPhone });

  return { phone: formattedPhone, availableChannels: channels };
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

  // 3. Check duplicate user
  const existingUser = await User.findOne({ phone: formattedPhone });

  if (existingUser && existingUser.status !== 'unverified') {
    throw new AppError('A user with this phone number already exists', 409);
  }

  // 4. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 5. Create/Update user in 'unverified' status
  // Email is optional at registration, but needs to be on file up front
  // if the person wants to receive their OTP by email.
  const trimmedEmail = email && email.trim() ? email.trim() : undefined;

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
      email: trimmedEmail,
      status: 'unverified',
      isPhoneVerified: false,
    });
  }

  // 6. Generate & send OTP via the chosen channel (DO NOT issue tokens here)
  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, channel);

  return {
    otpRequired: true,
    phone: formattedPhone,
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

export const loginUser = async ({ phone, password, channel }) => {
  // 1. Input validations
  if (!phone || !phone.trim()) {
    throw new AppError('Phone number is required', 400);
  }

  if (!password) {
    throw new AppError('Password is required', 400);
  }

  // 2. Phone format validation
  const formattedPhone = formatPhone(phone);

  if (!isValidKenyanPhone(formattedPhone)) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }

  // 3. Find User with Password & OTP fields
  const user = await User.findOne({ phone: formattedPhone }).select(
    '+password +otpCode +otpExpiresAt'
  );

  if (!user) {
    throw new AppError('Invalid phone number or password', 401);
  }

  // 4. Check account status
  if (user.status === 'inactive') {
    throw new AppError('This user account is inactive', 403);
  }

  if (user.status === 'suspended') {
    throw new AppError('This user account has been suspended', 403);
  }

  // 5. Compare password
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    throw new AppError('Invalid phone number or password', 401);
  }

  // 6. Password verified -> Send Security OTP via chosen channel (DO NOT issue tokens here)
  const { expiryMinutes, channel: usedChannel } = await generateAndSendOtp(user, channel);

  return {
    otpRequired: true,
    phone: formattedPhone,
    channel: usedChannel,
    availableChannels: getAvailableOtpChannels(user),
    message: `Password verified. Security OTP code sent via ${usedChannel} to ${
      usedChannel === 'email' ? user.email : formattedPhone
    }`,
    expiresInMinutes: expiryMinutes,
  };
};

// ========================================
// VERIFY OTP AND ISSUE TOKENS (Gatekeeper)
// ========================================

export const verifyOtp = async ({ phone, otpCode }) => {
  if (!phone || !phone.trim()) {
    throw new AppError('Phone number is required', 400);
  }

  if (!otpCode || !otpCode.trim()) {
    throw new AppError('OTP code is required', 400);
  }

  const formattedPhone = formatPhone(phone);

  // Find User with OTP fields
  const user = await User.findOne({ phone: formattedPhone }).select(
    '+otpCode +otpExpiresAt +refreshToken'
  );

  if (!user || !user.otpCode) {
    throw new AppError('No pending OTP request found for this phone number', 400);
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