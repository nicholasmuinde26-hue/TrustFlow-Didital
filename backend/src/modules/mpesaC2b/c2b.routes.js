import express from 'express';
import {
  handleC2bValidation,
  handleC2bConfirmation,
  getUnmatchedPayments,
  matchPayment,
  registerUrls,
} from './c2b.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';
import { verifyC2bWebhook } from '../../middleware/c2bWebhook.middleware.js';

const router = express.Router();

// ============================================================
// SAFARICOM WEBHOOKS
// ============================================================
//
// These endpoints create money: the confirmation handler records a
// C2bPayment and posts a real contribution to the ledger. They used to
// be fully public with no authentication of any kind, so a forged POST
// could credit any member for any amount.
//
// Daraja offers no request signing, so verifyC2bWebhook establishes
// authenticity two ways: a high-entropy secret embedded in the URL path
// (so the endpoint can't be found) and a Safaricom source-IP allowlist
// (so a leaked URL can't be replayed). The payload's BusinessShortCode
// is checked separately in the reconciliation service.
//
// Register these EXACT paths with Safaricom, secret included:
//   https://api.example.com/api/v1/mpesa/c2b/validation/<M_PESA_C2B_WEBHOOK_SECRET>
//   https://api.example.com/api/v1/mpesa/c2b/confirmation/<M_PESA_C2B_WEBHOOK_SECRET>
//
// Rotating the secret means re-running POST /register-urls.
// ============================================================
router.post(
  '/validation/:webhookSecret',
  express.json({ limit: '1mb' }),
  verifyC2bWebhook,
  handleC2bValidation
);

router.post(
  '/confirmation/:webhookSecret',
  express.json({ limit: '1mb' }),
  verifyC2bWebhook,
  handleC2bConfirmation
);

// ============================================================
// ADMIN — UNMATCHED PAYMENTS QUEUE
// ============================================================
//
// These were commented as admin-only but gated on `protect` alone, so
// ANY logged-in user could read every unmatched payment across every
// chama (payer names, phone numbers, amounts) and assign those payments
// to a chama and member of their choosing — i.e. credit themselves with
// somebody else's money.
//
// requireAdmin checks systemRole and is the same gate the rest of the
// admin surface uses.
// ============================================================
router.get('/unmatched', protect, requireAdmin, getUnmatchedPayments);
router.post('/:id/match', protect, requireAdmin, matchPayment);

// ============================================================
// ADMIN — ONE-TIME URL REGISTRATION WITH SAFARICOM
// ============================================================
// Registering URLs repoints where Safaricom delivers every future
// payment for the paybill, so this is super-admin only.
// ============================================================
router.post('/register-urls', protect, requireAdmin, registerUrls);

export default router;