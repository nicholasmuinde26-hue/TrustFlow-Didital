import express from 'express';
import crypto from 'node:crypto';
import { rateLimit } from '../../middleware/rateLimit.middleware.js';
import {
  createPublicDonation,
  getGivingPreview,
  getPublicDonationStatus,
  reportPublicCause,
  handleGivingMpesaCallback,
} from './publicGiving.controller.js';

const router = express.Router();

const donationLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_PUBLIC_DONATION_MAX) || 10,
  distributed: true,
  keyGenerator: (req) => {
    const phone = String(req.body?.phone_number || '').replace(/\D/g, '');
    const phoneKey = phone ? crypto.createHash('sha256').update(phone).digest('hex').slice(0, 16) : 'missing-phone';
    return `${req.ip || 'unknown'}:${phoneKey}`;
  },
  message: 'Too many donation attempts. Please wait before trying again.',
});
const reportLimiter = rateLimit({
  windowMs: 24 * 60 * 60_000,
  max: 10,
  distributed: true,
  message: 'Too many reports from this device. Please try again later.',
});

router.get('/:joinCode', getGivingPreview);
router.post('/:joinCode/donations', donationLimiter, createPublicDonation);
router.post('/:joinCode/reports', reportLimiter, reportPublicCause);
router.get('/payments/:statusToken', getPublicDonationStatus);
router.post('/mpesa/callback', handleGivingMpesaCallback);

export default router;
