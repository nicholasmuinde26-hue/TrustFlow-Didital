import express from 'express';
import {
  getMyAdminProfileController,
  listAdminCategoriesController,
  suspendSubAdminController,
  reinstateSubAdminController,
  getOverviewStatsController,
  getExecutiveOverviewController,
  listUsersController,
  listSubAdminsController,
  promoteSubAdminController,
  updateSubAdminPermissionsController,
  demoteSubAdminController,
  listWorkspaceRequestsController,
  getWorkspaceRequestController,
  updateWorkspaceRequestController,
  approveWorkspaceRequestController,
  rejectWorkspaceRequestController,
  getEntityDetailController,
  updateChamaMemberController,
  searchPeopleController,
  listAdminActivityController,
  createAdminStepUpController,
  listMyAdminSessionsController,
  revokeMyAdminSessionController,
} from './admin.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireSuperAdmin, requireAdminPermission, requireAdminStepUp } from '../../middleware/admin.middleware.js';

const router = express.Router();

// All routes require authentication and at least Sub-Admin role
router.use(protect, requireAdmin);

// Every admin can identify themselves and see the category catalog — the
// frontend uses this to build a permission-aware nav instead of trusting
// the client to know which workspaces it should render.
router.get('/me', getMyAdminProfileController);
router.get('/categories', listAdminCategoriesController);
router.post('/step-up', createAdminStepUpController);
router.get('/sessions', listMyAdminSessionsController);
router.delete('/sessions/:sessionId', revokeMyAdminSessionController);

// Overview statistics — coarse, non-sensitive counts every admin sees
// regardless of category, for situational awareness on the landing screen.
router.get('/overview', getOverviewStatsController);

// Executive (cross-workspace) overview — Screen 1 of the platform:
// groups, members, transactions, money processed, verified %, risk
// alerts, pending approvals across the whole platform
router.get('/overview/executive', getExecutiveOverviewController);

// Immutable admin activity trail. Historically Super-Admin-only; now also
// open to any category whose profile grants `auditLogs` (Security and
// Compliance do by default) so a Security Admin can actually "inspect the
// system wholly" as intended — reading it never allows changing it, since
// PlatformAdminAuditLog rejects every update/delete at the schema level.
router.get('/activity', requireAdminPermission('auditLogs'), listAdminActivityController);

// User management
router.get('/users', requireAdminPermission('users'), listUsersController);

// Global people search — "who is who where" across every chama, business
// and contribution group
router.get('/people', requireAdminPermission('users'), searchPeopleController);

// Workspace directory drill-down — full detail (members, roles, finance)
// for a single chama / business / contribution group
router.get('/entities/:type/:id', getEntityDetailController);

// Admin override of a chama membership — used to fix a role assignment
// or hand over the chairperson seat when a term ends
router.patch('/chamas/:chamaId/members/:membershipId', requireAdminPermission('chamas'), updateChamaMemberController);

// Sub-admin management — appointing, rescoping, suspending and demoting
// sub-admins is Super Admin exclusive, full stop. A sub-admin can see the
// roster (so they know who else is on the team / who appointed them) but
// cannot act on it.
router.get('/sub-admins', listSubAdminsController);
router.post('/sub-admins', requireSuperAdmin, requireAdminStepUp, promoteSubAdminController);
router.patch('/sub-admins/:userId', requireSuperAdmin, requireAdminStepUp, updateSubAdminPermissionsController);
router.post('/sub-admins/:userId/suspend', requireSuperAdmin, requireAdminStepUp, suspendSubAdminController);
router.post('/sub-admins/:userId/reinstate', requireSuperAdmin, requireAdminStepUp, reinstateSubAdminController);
router.delete('/sub-admins/:userId', requireSuperAdmin, requireAdminStepUp, demoteSubAdminController);

// Workspace Requests — the Onboarding console. Viewing the queue and
// deciding on it both require the `onboarding` permission (Onboarding and
// Operations categories carry it by default; Super Admin always does).
router.get('/workspace-requests', requireAdminPermission('onboarding'), listWorkspaceRequestsController);
router.get('/workspace-requests/:requestId', requireAdminPermission('onboarding'), getWorkspaceRequestController);
router.patch('/workspace-requests/:requestId', requireAdminPermission('onboarding'), updateWorkspaceRequestController);
router.post('/workspace-requests/:requestId/approve', requireAdminPermission('onboarding'), approveWorkspaceRequestController);
router.post('/workspace-requests/:requestId/reject', requireAdminPermission('onboarding'), rejectWorkspaceRequestController);

export default router;
