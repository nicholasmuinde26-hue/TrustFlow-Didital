import express from 'express';
import {
  createInquiryController,
  getWorkspaceInquiriesController,
  replyToInquiryController,
  listAllInquiriesController,
  getInquiryByIdController,
  updateInquiryStatusController,
  getInquiryStatsController,
} from './inquiry.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireAdmin } from '../../middleware/admin.middleware.js';

const router = express.Router();

// ============================================================
// WORKSPACE-FACING ROUTES (CHAIRPERSON, OFFICIALS, MEMBERS)
// ============================================================

// Submit inquiry from a workspace
router.post('/', protect, createInquiryController);

// Get inquiries for a specific workspace
router.get('/workspace/:workspaceId', protect, getWorkspaceInquiriesController);

// User or official reply to an inquiry thread
router.post('/:inquiryId/reply', protect, replyToInquiryController);

// ============================================================
// ADMIN-FACING ROUTES (PLATFORM ADMINS LISTENING & MANAGING)
// ============================================================

export const adminInquiryRouter = express.Router();
adminInquiryRouter.use(protect, requireAdmin);

// Overview statistics (badge count of open / pending inquiries)
adminInquiryRouter.get('/stats', getInquiryStatsController);

// List all incoming inquiries from all Chamas & workspaces
adminInquiryRouter.get('/', listAllInquiriesController);

// Get inquiry details
adminInquiryRouter.get('/:inquiryId', getInquiryByIdController);

// Admin status update (e.g. OPEN -> IN_PROGRESS -> RESOLVED)
adminInquiryRouter.patch('/:inquiryId/status', updateInquiryStatusController);

// Admin reply to an inquiry
adminInquiryRouter.post('/:inquiryId/reply', replyToInquiryController);

export default router;
