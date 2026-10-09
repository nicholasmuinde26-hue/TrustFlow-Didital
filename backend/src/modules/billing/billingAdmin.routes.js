import express from 'express';

import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireSuperAdmin } from '../../middleware/admin.middleware.js';
import * as admin from './billingAdmin.service.js';

// Base route: /api/v1/admin/billing
// Platform revenue is the owner's business: Super Admin only.
const router = express.Router();
router.use(protect, requireAdmin, requireSuperAdmin);

const wrap = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) { next(error); }
};

router.get('/metrics', wrap((req) => admin.getRevenueMetrics({ months: req.query.months })));
router.get('/subscriptions', wrap((req) => admin.listSubscriptions(req.query)));
router.patch('/subscriptions/:chamaId/price', wrap((req) => admin.setGroupPrice(req.params.chamaId, req.body || {})));
router.get('/invoices', wrap((req) => admin.listInvoices(req.query)));
router.get('/plans', wrap(() => admin.listAllPlans()));
router.patch('/plans/:code', wrap((req) => admin.updatePlan(String(req.params.code).toLowerCase(), req.body || {})));

export default router;
