import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { requireChamaMember } from '../middleware/chama.middleware.js';
import {
  assessActionRisk,
  generateConfirmationDialog,
  validateConfirmationResponse,
  revalidateAction,
  getWarningExplanation
} from '../controllers/actionSafety.controller.js';

const router = express.Router();

// ========================================
// ACTION SAFETY ENGINE ENDPOINTS
// ========================================

/**
 * POST /api/v1/actions/:action/assess-risk
 * Assess action risk before confirmation
 */
router.post('/:action/assess-risk', protect, requireChamaMember, assessActionRisk);

/**
 * POST /api/v1/actions/:action/confirmation-dialog
 * Generate confirmation dialog for action
 */
router.post('/:action/confirmation-dialog', protect, requireChamaMember, generateConfirmationDialog);

/**
 * POST /api/v1/actions/:action/validate-confirmation
 * Validate confirmation response
 */
router.post('/:action/validate-confirmation', protect, validateConfirmationResponse);

/**
 * POST /api/v1/actions/:action/revalidate
 * Re-validate action before execution
 */
router.post('/:action/revalidate', protect, requireChamaMember, revalidateAction);

/**
 * GET /api/v1/actions/warnings/:warningType/explanation
 * Get warning explanation
 */
router.get('/warnings/:warningType/explanation', protect, getWarningExplanation);

export default router;