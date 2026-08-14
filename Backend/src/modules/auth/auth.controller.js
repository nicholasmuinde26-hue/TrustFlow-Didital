import {
  sendOtp,
  verifyOtp,
  refreshAccessToken,
  registerUser,
  loginUser,
  getCurrentUser,
  updateCurrentUser,
  getOtpChannelsForPhone,
} from './auth.service.js';

import AppError from '../../utils/AppError.js';
import { PROFILE_UPDATE_FIELDS } from '../../utils/userProfile.js';

// ========================================
// REQUEST OTP (USER-CHOSEN CHANNEL: SMS / EMAIL / WHATSAPP)
// ========================================

export const sendOtpController = async (req, res, next) => {
  try {
    const { phone, channel } = req.body;

    const result = await sendOtp({ phone, channel });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// LIST AVAILABLE OTP CHANNELS FOR A PHONE NUMBER
// ========================================
//
// Frontend calls this before showing the channel picker so it only
// offers Email when the account actually has one on file.
//
// ========================================

export const getOtpChannelsController = async (req, res, next) => {
  try {
    const { phone } = req.query;

    const result = await getOtpChannelsForPhone({ phone });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// VERIFY OTP (COMPLETES AUTH & ISSUES TOKENS)
// ========================================

export const verifyOtpController = async (req, res, next) => {
  try {
    const { phone, otpCode } = req.body;

    const result = await verifyOtp({ phone, otpCode });

    res.status(200).json({
      success: true,
      message: 'OTP verification successful',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// REFRESH ACCESS TOKEN
// ========================================

export const refreshTokenController = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    const result = await refreshAccessToken(refreshToken);

    res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// REGISTER USER (PASSWORD + REQUIRES OTP)
// ========================================

export const registerController = async (req, res, next) => {
  try {
    // ----------------------------------------
    // Only accept public registration fields
    // ----------------------------------------
    const { name, phone, password, email, channel } = req.body;

    // ----------------------------------------
    // Register User (Creates unverified user & sends OTP via chosen channel)
    // ----------------------------------------
    const result = await registerUser({
      name,
      phone,
      password,
      email,
      channel,
    });

    res.status(201).json({
      success: true,
      message: result.message || 'Registration initiated. OTP code sent.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// LOGIN USER (PASSWORD + REQUIRES OTP)
// ========================================

export const loginController = async (req, res, next) => {
  try {
    const { phone, password, channel } = req.body;

    // ----------------------------------------
    // Verify Password & Trigger OTP via chosen channel
    // ----------------------------------------
    const result = await loginUser({
      phone,
      password,
      channel,
    });

    res.status(200).json({
      success: true,
      message: result.message || 'Password verified. Security OTP code sent.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// GET CURRENT USER
// ========================================

export const getMeController = async (req, res, next) => {
  try {
    // auth.middleware.js attaches authenticated user ID to req.user._id
    const user = await getCurrentUser(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================================
// UPDATE CURRENT USER PROFILE
// ========================================

export const updateMeController = async (req, res, next) => {
  try {
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      throw new AppError('Request body is required', 400);
    }

    const receivedFields = Object.keys(req.body);
    const unexpectedFields = receivedFields.filter(
      (field) => !PROFILE_UPDATE_FIELDS.includes(field)
    );

    if (unexpectedFields.length > 0) {
      throw new AppError(
        `Unexpected field(s): ${unexpectedFields.join(', ')}`,
        400
      );
    }

    const user = await updateCurrentUser(req.user._id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user,
      },
    });
  } catch (error) {
    next(error);
  }
};