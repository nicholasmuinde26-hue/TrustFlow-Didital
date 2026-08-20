import express from 'express';

import {
  sendOtpController,
  verifyOtpController,
  refreshTokenController,
  registerController,
  loginController,
  getMeController,
  updateMeController,
  getOtpChannelsController,
} from './auth.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

// ========================================
// PUBLIC ROUTES
// ========================================

/**
 * @route   GET /api/auth/otp-channels?phone=07XXXXXXXX
 * @desc    List which OTP delivery channels (sms/email/whatsapp) are
 *          available for a given phone number, for the channel picker UI
 * @access  Public
 */
router.get('/otp-channels', getOtpChannelsController);

/**
 * @route   POST /api/auth/send-otp
 * @desc    Request a standalone OTP for phone authentication, delivered
 *          via the caller's chosen channel: { phone, channel? }
 *          channel: 'sms' | 'email' | 'whatsapp' (defaults to 'sms')
 * @access  Public
 */
router.post('/send-otp', sendOtpController);

/**
 * @route   POST /api/auth/verify-otp
 * @desc    Verify 6-digit OTP code & issue short-lived Access + Refresh Tokens
 * @access  Public (Final step for register, login, & standalone OTP)
 */
router.post('/verify-otp', verifyOtpController);

/**
 * @route   POST /api/auth/refresh
 * @desc    Exchange a valid Refresh Token for a new short-lived Access Token
 * @access  Public
 */
router.post('/refresh', refreshTokenController);

/**
 * @route   POST /api/auth/register
 * @desc    Validate registration details & send security OTP code (Step 1 of 2)
 * @access  Public
 */
router.post('/register', registerController);

/**
 * @route   POST /api/auth/login
 * @desc    Verify phone & password, then send security OTP code (Step 1 of 2)
 * @access  Public
 */
router.post('/login', loginController);

// ========================================
// PROTECTED ROUTES
// ========================================

/**
 * @route   GET /api/auth/me
 * @desc    Fetch authenticated user profile details
 * @access  Private (Requires valid Bearer Access Token)
 */
router.get('/me', protect, getMeController);

/**
 * @route   PATCH /api/auth/me
 * @desc    Update own profile: name, phone, email, id_number, avatar_url
 * @access  Private (Requires valid Bearer Access Token)
 */
router.patch('/me', protect, updateMeController);

export default router;