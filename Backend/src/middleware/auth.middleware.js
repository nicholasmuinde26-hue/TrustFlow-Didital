import User from '../models/User.js';
import { verifyAccessToken, verifyToken } from '../utils/jwt.js';

// ========================================
// PROTECT ROUTES (Access Token + OTP Guard)
// ========================================

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1. EXTRACT TOKEN FROM AUTHORIZATION HEADER
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_MISSING',
        message: 'Authentication token required',
      });
    }

    // 2. VERIFY SHORT-LIVED ACCESS TOKEN & HANDLE EXPIRATION
    const verifyFn = verifyAccessToken || verifyToken;
    let decoded;

    try {
      decoded = verifyFn(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          code: 'TOKEN_EXPIRED',
          message: 'Access token expired. Use refresh token to obtain a new token.',
        });
      }
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Invalid authentication token',
      });
    }

    // 3. REJECT TEMPORARY OTP / PENDING-VERIFICATION TOKENS
    if (decoded.type === 'otp_pending' || decoded.isOtpPending) {
      return res.status(403).json({
        success: false,
        code: 'OTP_REQUIRED',
        message: 'OTP verification incomplete. Complete OTP verification to continue.',
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_INVALID',
        message: 'Invalid authentication token payload',
      });
    }

    // 4. FIND USER
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'User no longer exists',
      });
    }

    // 5. CHECK USER ACCOUNT STATUS
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_INACTIVE',
        message: 'User account is inactive',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: 'User account has been suspended',
      });
    }

    // 6. CHECK OTP / PHONE VERIFICATION STATUS
    if (
      user.status === 'unverified' ||
      (user.isPhoneVerified === false && user.isEmailVerified === false)
    ) {
      return res.status(403).json({
        success: false,
        code: 'OTP_UNVERIFIED',
        message: 'Account phone/email is unverified. Please complete OTP verification.',
      });
    }

    // 7. ATTACH AUTHENTICATED USER & PAYLOAD
    req.user = user;
    req.tokenPayload = decoded;

    next();
  } catch (error) {
    console.error('AUTH MIDDLEWARE ERROR:', error.message);

    return res.status(401).json({
      success: false,
      code: 'AUTH_FAILED',
      message: 'Authentication failed',
    });
  }
};