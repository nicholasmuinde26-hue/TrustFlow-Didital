import express from 'express';

import BurialChamaController from './burialChama.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';

const router = express.Router();

// ======================================================
// BURIAL CHAMA PROFILE ROUTES
// ======================================================

// Create / update burial chama profile
router.post(
  '/chama/:chamaId/profile',
  protect,
  requireChamaMember,
  BurialChamaController.createOrUpdateProfile
);

// Get burial chama profile
router.get(
  '/chama/:chamaId/profile',
  protect,
  requireChamaMember,
  BurialChamaController.getProfile
);

// Activate burial chama profile
// Restricted to treasurer or chairperson
router.post(
  '/chama/:chamaId/profile/activate',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.activateProfile
);

// ======================================================
// BENEFICIARY ROUTES
// ======================================================

// Add beneficiary
router.post(
  '/membership/:membershipId/beneficiaries',
  protect,
  requireChamaMember,
  BurialChamaController.addBeneficiary
);

// Update beneficiary
router.put(
  '/beneficiaries/:beneficiaryId',
  protect,
  requireChamaMember,
  BurialChamaController.updateBeneficiary
);

// Get member beneficiaries
router.get(
  '/membership/:membershipId/beneficiaries',
  protect,
  requireChamaMember,
  BurialChamaController.getMemberBeneficiaries
);

// ======================================================
// HOUSEHOLD ROUTES
// ======================================================

// Create household
router.post(
  '/chama/:chamaId/households',
  protect,
  requireChamaMember,
  BurialChamaController.createHousehold
);

// Add member to household
router.post(
  '/households/:householdId/members/:membershipId',
  protect,
  requireChamaMember,
  BurialChamaController.addMemberToHousehold
);

// ======================================================
// BURIAL CASE ROUTES
// ======================================================

// Create burial case
router.post(
  '/cases',
  protect,
  requireChamaMember,
  BurialChamaController.createBurialCase
);

// Update burial case status
router.put(
  '/cases/:caseId/status',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.updateBurialCaseStatus
);

// Calculate case benefit
router.post(
  '/cases/:caseId/calculate-benefit',
  protect,
  requireChamaMember,
  BurialChamaController.calculateCaseBenefit
);

// Submit committee vote
router.post(
  '/cases/:caseId/committee-vote',
  protect,
  requireChamaMember,
  BurialChamaController.submitCommitteeVote
);

// ======================================================
// PENALTY WAIVER ROUTES
// ======================================================

// Request penalty waiver
router.post(
  '/penalty-waivers',
  protect,
  requireChamaMember,
  BurialChamaController.requestPenaltyWaiver
);

// Approve penalty waiver
// Restricted to treasurer or chairperson
router.put(
  '/penalty-waivers/:waiverId/approve',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.approvePenaltyWaiver
);

// ======================================================
// MEETING ROUTES
// ======================================================

// Create meeting record
router.post(
  '/meetings',
  protect,
  requireChamaMember,
  BurialChamaController.createMeetingRecord
);

// ======================================================
// COMMUNICATION PREFERENCES ROUTES
// ======================================================

// Update member communication preferences
router.put(
  '/membership/:membershipId/communication-preferences',
  protect,
  requireChamaMember,
  BurialChamaController.updateCommunicationPreferences
);

// ======================================================
// STATISTICS ROUTES
// ======================================================

// Get chama statistics
router.get(
  '/chama/:chamaId/statistics',
  protect,
  requireChamaMember,
  BurialChamaController.getChamaStatistics
);

// ======================================================
// RULES ENGINE ROUTES
// ======================================================

// Check beneficiary eligibility
router.get(
  '/eligibility/:membershipId/:beneficiaryId/:burialChamaProfileId',
  protect,
  requireChamaMember,
  BurialChamaController.checkEligibility
);

// Calculate contribution obligation
router.post(
  '/contribution-obligation/:membershipId',
  protect,
  requireChamaMember,
  BurialChamaController.calculateContributionObligation
);

// Check member arrears
router.post(
  '/arrears/:membershipId',
  protect,
  requireChamaMember,
  BurialChamaController.checkArrears
);

// ======================================================
// MEMBER STATEMENT ROUTES
// ======================================================

// Generate member statement
router.post(
  '/membership/:membershipId/statement',
  protect,
  requireChamaMember,
  BurialChamaController.generateMemberStatement
);

// Get quick member balance
router.get(
  '/membership/:membershipId/balance',
  protect,
  requireChamaMember,
  BurialChamaController.getQuickBalance
);

// ======================================================
// USSD ROUTES
// ======================================================

// These are normally called by the USSD provider,
// therefore they intentionally do not use `protect`.
router.post(
  '/ussd/init',
  BurialChamaController.initializeUssdSession
);

router.post(
  '/ussd/process',
  BurialChamaController.processUssdRequest
);

router.post(
  '/ussd/cleanup',
  BurialChamaController.cleanupUssdSessions
);

// ======================================================
// SETUP WIZARD ROUTES
// ======================================================

// Get wizard template
router.get(
  '/wizard/template',
  protect,
  BurialChamaController.getWizardTemplate
);

// Validate wizard step
router.post(
  '/wizard/validate/:stepNumber',
  protect,
  BurialChamaController.validateWizardStep
);

// Complete chama wizard
// Restricted to treasurer or chairperson
router.post(
  '/chama/:chamaId/wizard/complete',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.completeWizard
);

// Get preset configurations
router.get(
  '/wizard/presets',
  protect,
  BurialChamaController.getPresetConfigurations
);

// Save wizard progress
router.post(
  '/chama/:chamaId/wizard/progress/:stepNumber',
  protect,
  requireChamaMember,
  BurialChamaController.saveWizardProgress
);

// Load wizard progress
router.get(
  '/chama/:chamaId/wizard/progress',
  protect,
  requireChamaMember,
  BurialChamaController.loadWizardProgress
);

// ======================================================
// EXPORT ROUTER
// ======================================================

export default router;