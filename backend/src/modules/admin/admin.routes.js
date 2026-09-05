import express from 'express';
import {
  getOverviewStatsController,
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
} from './admin.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin, requireSuperAdmin } from '../../middleware/admin.middleware.js';

const router = express.Router();

// All routes require authentication and at least Sub-Admin role
router.use(protect, requireAdmin);

// Overview statistics
router.get('/overview', getOverviewStatsController);

// User management
router.get('/users', listUsersController);

// Sub-admin management (Super Admin only for promoting/demoting/modifying permissions)
router.get('/sub-admins', listSubAdminsController);
router.post('/sub-admins', requireSuperAdmin, promoteSubAdminController);
router.patch('/sub-admins/:userId', requireSuperAdmin, updateSubAdminPermissionsController);
router.delete('/sub-admins/:userId', requireSuperAdmin, demoteSubAdminController);

// Workspace Requests
router.get('/workspace-requests', listWorkspaceRequestsController);
router.get('/workspace-requests/:requestId', getWorkspaceRequestController);
router.patch('/workspace-requests/:requestId', updateWorkspaceRequestController);
router.post('/workspace-requests/:requestId/approve', approveWorkspaceRequestController);
router.post('/workspace-requests/:requestId/reject', rejectWorkspaceRequestController);

export default router;
