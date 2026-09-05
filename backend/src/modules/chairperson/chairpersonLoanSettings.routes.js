import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember } from '../../middleware/chama.middleware.js';
import { requirePermission } from '../../middleware/permission.middleware.js';
import {
  getChairpersonLoanSettingsController,
  updateChairpersonLoanSettingsController,
  resetChairpersonLoanSettingsController,
  getSettingsHistoryController,
  canApproveLoanController,
  canChangeSettingsController,
  getLoanTypesController,
  addLoanTypeController,
  updateLoanTypeController,
  toggleLoanTypeController,
  deleteLoanTypeController
} from './chairpersonLoanSettings.controller.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);
router.use(requireChamaMember);

// ========================================
// GET CHAIRPERSON LOAN SETTINGS
// ========================================
// Requires: settings.view permission

router.get(
  '/:chamaId/chairperson-loan-settings',
  requirePermission('settings.view'),
  getChairpersonLoanSettingsController
);

// ========================================
// UPDATE CHAIRPERSON LOAN SETTINGS
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings',
  requirePermission('settings.manage'),
  updateChairpersonLoanSettingsController
);

// ========================================
// RESET CHAIRPERSON LOAN SETTINGS TO DEFAULTS
// ========================================
// Requires: settings.manage permission

router.post(
  '/:chamaId/chairperson-loan-settings/reset',
  requirePermission('settings.manage'),
  resetChairpersonLoanSettingsController
);

// ========================================
// GET SETTINGS CHANGE HISTORY
// ========================================
// Requires: audit.view permission

router.get(
  '/:chamaId/chairperson-loan-settings/history',
  requirePermission('audit.view'),
  getSettingsHistoryController
);

// ========================================
// CHECK IF CHAIRPERSON CAN APPROVE LOAN
// ========================================
// Requires: loans.approve permission (typically chairperson)

router.get(
  '/:chamaId/chairperson-loan-settings/can-approve/:loanId',
  requirePermission('loans.approve'),
  canApproveLoanController
);

// ========================================
// CHECK IF SETTINGS CAN BE CHANGED
// ========================================
// Requires: settings.view permission

router.post(
  '/:chamaId/chairperson-loan-settings/can-change',
  requirePermission('settings.view'),
  canChangeSettingsController
);

// ========================================
// GET LOAN TYPE CONFIGURATION
// ========================================
// Requires: settings.view permission

router.get(
  '/:chamaId/chairperson-loan-settings/loan-types',
  requirePermission('settings.view'),
  getLoanTypesController
);

// ========================================
// ADD LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.post(
  '/:chamaId/chairperson-loan-settings/loan-types',
  requirePermission('settings.manage'),
  addLoanTypeController
);

// ========================================
// UPDATE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName',
  requirePermission('settings.manage'),
  updateLoanTypeController
);

// ========================================
// ENABLE/DISABLE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName/toggle',
  requirePermission('settings.manage'),
  toggleLoanTypeController
);

// ========================================
// DELETE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.delete(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName',
  requirePermission('settings.manage'),
  deleteLoanTypeController
);

export default router;