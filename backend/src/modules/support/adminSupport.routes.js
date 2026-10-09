import express from 'express';

import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireAdminPermission, requireAdminStepUp } from '../../middleware/admin.middleware.js';
import PlatformAdmin from '../../models/PlatformAdmin.js';
import * as support from './adminSupport.service.js';

// Base route: /api/v1/admin/support
//
// Permissions (the Super Admin always passes):
//   look, add notes, work cases ... `support` OR `finance`
//   user tools, plan extend/comp/change ... `support`   (plan changes also need password step-up)
//   mark paid, resolve a flagged payment ... `finance`  (also needs password step-up)
const router = express.Router();
router.use(protect, requireAdmin);

const requireAnyPermission = (...keys) => async (req, res, next) => {
  if (req.user?.systemRole === 'super_admin') return next();
  const admin = req.platformAdmin || (await PlatformAdmin.findOne({ userId: req.user._id, status: 'ACTIVE' }));
  if (admin && keys.some((key) => admin.permissions?.[key] === true)) {
    req.platformAdmin = admin;
    return next();
  }
  return res.status(403).json({
    success: false,
    code: 'PERMISSION_DENIED',
    message: `Access denied: you need '${keys.join("' or '")}' administrative permission.`,
  });
};

const canSupport = requireAnyPermission('support', 'finance');
const supportOnly = requireAdminPermission('support');
const financeOnly = requireAdminPermission('finance');

const wrap = (fn) => async (req, res, next) => {
  try {
    res.json({ success: true, data: await fn(req) });
  } catch (error) { next(error); }
};

router.get('/overview', canSupport, wrap((req) => support.getSupportOverview(req.user)));
router.get('/assignees', canSupport, wrap(() => support.listAssignees()));

// 1. Billing support per chama
router.get('/chamas', canSupport, wrap((req) => support.searchChamas(req.query)));
router.get('/chamas/:chamaId/billing', canSupport, wrap((req) => support.getChamaBilling(req.params.chamaId)));
router.post('/chamas/:chamaId/billing/extend', supportOnly, requireAdminStepUp, wrap((req) => support.extendAccess(req.params.chamaId, req.body || {}, req.user)));
router.post('/chamas/:chamaId/billing/comp', supportOnly, requireAdminStepUp, wrap((req) => support.compPlan(req.params.chamaId, req.body || {}, req.user)));
router.post('/chamas/:chamaId/billing/change-plan', supportOnly, requireAdminStepUp, wrap((req) => support.changePlan(req.params.chamaId, req.body || {}, req.user)));

// 2. Payments needing review
router.get('/payments/review', canSupport, wrap((req) => support.listReviewQueue(req.query)));
router.post('/payments/:invoiceId/mark-paid', financeOnly, requireAdminStepUp, wrap((req) => support.markInvoicePaidByReceipt(req.params.invoiceId, req.body || {}, req.user)));
router.post('/payments/:invoiceId/resolve', financeOnly, requireAdminStepUp, wrap((req) => support.resolveReview(req.params.invoiceId, req.body || {}, req.user)));

// 3. User support tools
router.get('/users', canSupport, wrap((req) => support.searchUsers(req.query)));
router.get('/users/:userId', canSupport, wrap((req) => support.getUserSupportProfile(req.params.userId)));
router.post('/users/:userId/unlock', supportOnly, wrap((req) => support.unlockUser(req.params.userId, req.body || {}, req.user)));
router.post('/users/:userId/force-logout', supportOnly, wrap((req) => support.forceLogoutUser(req.params.userId, req.body || {}, req.user)));
router.post('/users/:userId/resend-verification', supportOnly, wrap((req) => support.resendVerification(req.params.userId, req.body || {}, req.user)));

// 4. Notes and cases
router.get('/notes', canSupport, wrap((req) => support.listNotes(req.query)));
router.post('/notes', canSupport, wrap((req) => support.addNote(req.body || {}, req.user)));
router.patch('/notes/:noteId/pin', canSupport, wrap((req) => support.setNotePinned(req.params.noteId, req.body?.pinned)));
router.get('/cases', canSupport, wrap((req) => support.listCases(req.query, req.user)));
router.post('/cases', canSupport, wrap((req) => support.createCase(req.body || {}, req.user)));
router.get('/cases/:caseId', canSupport, wrap((req) => support.getCase(req.params.caseId)));
router.patch('/cases/:caseId', canSupport, wrap((req) => support.updateCase(req.params.caseId, req.body || {}, req.user)));

export default router;
