import express from 'express';
import { handleUssdRequest, cleanupUssdSessions } from './ussd.controller.js';
import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();

// ============================================================
// AFRICA'S TALKING WEBHOOK — PUBLIC, NO AUTH
// ============================================================
// Configure this exact path as the callback URL for the *XXX# service
// code in the Africa's Talking dashboard.
router.post(
  '/callback',
  express.urlencoded({ extended: true }),
  handleUssdRequest
);

// ============================================================
// ADMIN — manual trigger for the session cleanup sweep
// ============================================================
router.post('/cleanup', protect, cleanupUssdSessions);

export default router;
