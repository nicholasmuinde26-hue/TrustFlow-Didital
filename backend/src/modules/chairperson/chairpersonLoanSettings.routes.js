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

// NOTE: intentionally NOT `router.use(protect); router.use(requireChamaMember);`
// here. This router is mounted in app.js as a plain
// `app.use("/api/v1/chamas", chairpersonLoanSettingsRoutes)` — a path-less
// `router.use(...)` therefore runs for EVERY request under "/api/v1/chamas",
// including ones this file doesn't own (e.g. /trust-timeline), and at that
// point in the stack there's no ":chamaId" captured yet (neither the mount
// nor this generic middleware has one), so requireChamaMember has nothing
// to resolve and throws "Invalid Chama ID" before the request ever reaches
// the router that actually owns that path. Attaching the guard per-route
// instead means it only runs once one of *this file's* own ":chamaId"
// routes has actually matched.
const guard = [protect, requireChamaMember];

// ========================================
// GET CHAIRPERSON LOAN SETTINGS
// ========================================
// Requires: settings.view permission

router.get(
  '/:chamaId/chairperson-loan-settings',
  ...guard,
  requirePermission('settings.view'),
  getChairpersonLoanSettingsController
);

// ========================================
// UPDATE CHAIRPERSON LOAN SETTINGS
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings',
  ...guard,
  requirePermission('settings.manage'),
  updateChairpersonLoanSettingsController
);

// ========================================
// RESET CHAIRPERSON LOAN SETTINGS TO DEFAULTS
// ========================================
// Requires: settings.manage permission

router.post(
  '/:chamaId/chairperson-loan-settings/reset',
  ...guard,
  requirePermission('settings.manage'),
  resetChairpersonLoanSettingsController
);

// ========================================
// GET SETTINGS CHANGE HISTORY
// ========================================
// Requires: audit.view permission

router.get(
  '/:chamaId/chairperson-loan-settings/history',
  ...guard,
  requirePermission('audit.view'),
  getSettingsHistoryController
);

// ========================================
// CHECK IF CHAIRPERSON CAN APPROVE LOAN
// ========================================
// Requires: loans.approve permission (typically chairperson)

router.get(
  '/:chamaId/chairperson-loan-settings/can-approve/:loanId',
  ...guard,
  requirePermission('loans.approve'),
  canApproveLoanController
);

// ========================================
// CHECK IF SETTINGS CAN BE CHANGED
// ========================================
// Requires: settings.view permission

router.post(
  '/:chamaId/chairperson-loan-settings/can-change',
  ...guard,
  requirePermission('settings.view'),
  canChangeSettingsController
);

// ========================================
// GET LOAN TYPE CONFIGURATION
// ========================================
// Requires: settings.view permission

router.get(
  '/:chamaId/chairperson-loan-settings/loan-types',
  ...guard,
  requirePermission('settings.view'),
  getLoanTypesController
);

// ========================================
// ADD LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.post(
  '/:chamaId/chairperson-loan-settings/loan-types',
  ...guard,
  requirePermission('settings.manage'),
  addLoanTypeController
);

// ========================================
// UPDATE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName',
  ...guard,
  requirePermission('settings.manage'),
  updateLoanTypeController
);

// ========================================
// ENABLE/DISABLE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.patch(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName/toggle',
  ...guard,
  requirePermission('settings.manage'),
  toggleLoanTypeController
);

// ========================================
// DELETE LOAN TYPE
// ========================================
// Requires: settings.manage permission

router.delete(
  '/:chamaId/chairperson-loan-settings/loan-types/:typeName',
  ...guard,
  requirePermission('settings.manage'),
  deleteLoanTypeController
);

export default router;