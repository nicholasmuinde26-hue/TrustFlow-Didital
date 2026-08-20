import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env.js';

// Safe fallbacks to prevent runtime errors if env keys are missing
const JWT_ACCESS_SECRET =
  env?.jwtAccessSecret || env?.jwtSecret || 'default_access_secret_change_in_prod';

const JWT_REFRESH_SECRET =
  env?.jwtRefreshSecret || 'default_refresh_secret_change_in_prod';

const ACCESS_EXPIRES_IN = env?.jwtAccessExpiresIn || '15m';
const REFRESH_EXPIRES_IN = env?.jwtRefreshExpiresIn || '7d';

const DEFAULT_OTP_LENGTH = Number(env?.otpLength) || 6;
const OTP_EXPIRES_IN_MINUTES = Number(env?.otpExpiresInMinutes) || 5;

// ========================================
// ACCESS & REFRESH TOKENS
// ========================================

/**
 * Generates a short-lived access token for API requests (default: 15 minutes)
 */
export const generateAccessToken = (userId, extraClaims = {}) => {
  return jwt.sign(
    { id: userId, ...extraClaims },
    JWT_ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
};

/**
 * Generates a long-lived refresh token for renewing access tokens (default: 7 days)
 */
export const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, JWT_REFRESH_SECRET);
};

// ========================================
// OTP HELPERS
// ========================================

/**
 * Generates a cryptographically secure numeric OTP code (default: 6 digits)
 */
export const generateOtpCode = (length = DEFAULT_OTP_LENGTH) => {
  const targetLength = Number(length) || 6;
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(targetLength);

  for (let i = 0; i < targetLength; i++) {
    otp += digits[randomBytes[i] % 10];
  }

  return otp;
};

/**
 * Generates a short-lived signed JWT specifically for temporary OTP verification state
 */
export const generateOtpToken = (payload) => {
  return jwt.sign(
    payload,
    JWT_ACCESS_SECRET,
    { expiresIn: `${OTP_EXPIRES_IN_MINUTES}m` }
  );
};

export const verifyOtpToken = (token) => {
  return jwt.verify(token, JWT_ACCESS_SECRET);
};

// ========================================
// BACKWARD COMPATIBILITY ALIASES
// ========================================

export const generateToken = generateAccessToken;
export const verifyToken = verifyAccessToken;