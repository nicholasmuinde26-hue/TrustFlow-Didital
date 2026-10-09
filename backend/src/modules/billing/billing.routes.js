import express from 'express';

import { protect } from '../../middleware/auth.middleware.js';
import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson,
} from '../../middleware/chama.middleware.js';
import {
  createInvoiceController,
  getInvoice,
  getPlans,
  getSummary,
  listInvoices,
  payInvoiceController,
  switchToFreeController,
} from './billing.controller.js';

// Base route: /api/v1/chamas/:chamaId/billing
const router = express.Router({ mergeParams: true });

router.use(protect, requireChamaMember);

// Any member can see the plan and how long it lasts (the banner needs it).
router.get('/', getSummary);
router.get('/plans', getPlans);

// Invoices are for the officials who handle the chama's money.
router.get('/invoices', requireChamaTreasurerOrChairperson, listInvoices);
router.post('/invoices', requireChamaTreasurerOrChairperson, createInvoiceController);
router.get('/invoices/:invoiceId', requireChamaTreasurerOrChairperson, getInvoice);

// Only the treasurer pays: the STK prompt goes to their phone.
router.post('/invoices/:invoiceId/pay', requireChamaTreasurer, payInvoiceController);

router.post('/switch-to-free', requireChamaTreasurerOrChairperson, switchToFreeController);

export default router;
