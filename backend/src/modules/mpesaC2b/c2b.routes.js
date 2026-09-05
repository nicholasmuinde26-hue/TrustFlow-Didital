import express from 'express';
import {
  handleC2bValidation,
  handleC2bConfirmation,
  getUnmatchedPayments,
  matchPayment,
  registerUrls,
} from './c2b.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

// ============================================================
// SAFARICOM WEBHOOKS — PUBLIC, NO AUTH
// ============================================================
// Register these exact paths as ValidationURL/ConfirmationURL for your
// Paybill shortcode (via POST /register-urls below, or the Daraja portal).
router.post('/validation', express.json({ limit: '1mb' }), handleC2bValidation);
router.post('/confirmation', express.json({ limit: '1mb' }), handleC2bConfirmation);

// ============================================================
// ADMIN — UNMATCHED PAYMENTS QUEUE
// ============================================================
router.get('/unmatched', protect, getUnmatchedPayments);
router.post('/:id/match', protect, matchPayment);

// ============================================================
// ADMIN — ONE-TIME URL REGISTRATION WITH SAFARICOM
// ============================================================
router.post('/register-urls', protect, registerUrls);

export default router;
