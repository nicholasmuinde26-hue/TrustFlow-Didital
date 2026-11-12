import express from 'express';

import BurialChamaController from './burialChama.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer,
  requireChamaTreasurerOrChairperson
} from '../../middleware/chama.middleware.js';

import { requireModule } from '../../middleware/module.middleware.js';
import { burialUssdRateLimit, verifyBurialUssdCleanup, verifyBurialUssdProvider } from './burialUssd.middleware.js';
const router = express.Router();

// Fundraising and equipment hire are burial-chama operations scoped to the
// authenticated chama membership. Financial records can only be entered by
// the chama's chairperson or treasurer.
router.get('/chama/:chamaId/fundraising-campaigns', protect, requireChamaMember, requireModule('fundraising'), BurialChamaController.listFundraisingCampaigns);
router.post('/chama/:chamaId/fundraising-campaigns', protect, requireChamaMember, requireChamaTreasurerOrChairperson, requireModule('fundraising'), BurialChamaController.createFundraisingCampaign);
router.post('/fundraising-campaigns/:campaignId/contributions', protect, requireChamaMember, requireChamaTreasurerOrChairperson, requireModule('fundraising'), BurialChamaController.recordFundraisingContribution);
router.get('/chama/:chamaId/equipment', protect, requireChamaMember, requireModule('equipment_hire'), BurialChamaController.listBurialEquipment);
router.post('/chama/:chamaId/equipment', protect, requireChamaMember, requireChamaTreasurerOrChairperson, requireModule('equipment_hire'), BurialChamaController.createBurialEquipment);
router.get('/chama/:chamaId/equipment-bookings', protect, requireChamaMember, requireModule('equipment_hire'), BurialChamaController.listBurialEquipmentBookings);
router.post('/chama/:chamaId/equipment-bookings', protect, requireChamaMember, requireChamaTreasurerOrChairperson, requireModule('equipment_hire'), BurialChamaController.createBurialEquipmentBooking);
router.post('/equipment-bookings/:bookingId/return', protect, requireChamaMember, requireChamaTreasurerOrChairperson, requireModule('equipment_hire'), BurialChamaController.returnBurialEquipmentBooking);

// ======================================================
// BURIAL CHAMA PROFILE ROUTES
// ======================================================

// Create / update burial chama profile — same governance-authoring
// authority as activate/complete below (treasurer or chairperson only).
// A plain member can still GET the profile once it's set, just not
// author it.
router.post(
  '/chama/:chamaId/profile',
  protect,
  requireChamaTreasurerOrChairperson,
  requireModule('burial_welfare'),
  BurialChamaController.createOrUpdateProfile
);

// Get burial chama profile
router.get(
  '/chama/:chamaId/profile',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.getProfile
);

// Activate burial chama profile
// Restricted to treasurer or chairperson
router.post(
  '/chama/:chamaId/profile/activate',
  protect,
  requireChamaTreasurerOrChairperson,
  requireModule('burial_welfare'),
  BurialChamaController.activateProfile
);

// ======================================================
// BENEFICIARY ROUTES
// ======================================================

// Add beneficiary
router.post(
  '/membership/:membershipId/beneficiaries',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.addBeneficiary
);

// Update beneficiary
router.put(
  '/beneficiaries/:beneficiaryId',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.updateBeneficiary
);

// Get member beneficiaries
router.get(
  '/membership/:membershipId/beneficiaries',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.getMemberBeneficiaries
);

router.get('/membership/:membershipId/next-of-kin', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.getNextOfKin);
router.put('/membership/:membershipId/next-of-kin', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.replaceNextOfKin);

// ======================================================
// HOUSEHOLD ROUTES
// ======================================================

// Create household
router.post(
  '/chama/:chamaId/households',
  protect,
  requireChamaTreasurerOrChairperson, requireModule('burial_welfare'),
  BurialChamaController.createHousehold
);
router.get('/households/:householdId', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.getHousehold);
router.patch('/households/:householdId', protect, requireChamaTreasurerOrChairperson, requireModule('burial_welfare'), BurialChamaController.updateHousehold);
router.delete('/households/:householdId/members/:membershipId', protect, requireChamaTreasurerOrChairperson, requireModule('burial_welfare'), BurialChamaController.removeHouseholdMember);
router.post('/households/:householdId/dissolve', protect, requireChamaTreasurerOrChairperson, requireModule('burial_welfare'), BurialChamaController.dissolveHousehold);

// Add member to household
router.post(
  '/households/:householdId/members/:membershipId',
  protect,
  requireChamaTreasurerOrChairperson, requireModule('burial_welfare'),
  BurialChamaController.addMemberToHousehold
);

// ======================================================
// BURIAL CASE ROUTES
// ======================================================

router.get('/chama/:chamaId/cases', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.listBurialCases);
router.get('/cases/:caseId', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.getBurialCase);
router.post('/cases/:caseId/documents', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.addCaseDocuments);
router.put('/cases/:caseId/documents/:documentId/verify', protect, requireChamaTreasurer, requireModule('burial_welfare'), BurialChamaController.verifyCaseDocument);
router.put('/cases/:caseId/home-visit', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.recordHomeVisit);
router.put('/cases/:caseId/fraud-flags/:flagId/resolve', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.resolveFraudFlag);
router.post('/cases/:caseId/payout/approval', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.requestBurialPayoutApproval);
router.post('/cases/:caseId/payout/disburse', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.disburseBurialBenefit);
router.get('/chama/:chamaId/beneficiaries', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.listChamaBeneficiaries);
router.get('/chama/:chamaId/households', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.listHouseholds);
router.get('/chama/:chamaId/penalty-waivers', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.listPenaltyWaivers);
router.get('/chama/:chamaId/meetings', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.listMeetingRecords);
router.get('/chama/:chamaId/coverage/me', protect, requireChamaMember, requireModule('burial_welfare'), BurialChamaController.getMyCoverage);

// Create burial case
router.post(
  '/cases',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.createBurialCase
);

// Update burial case status
router.put(
  '/cases/:caseId/status',
  protect,
  requireChamaMember,
  requireModule('burial_welfare'),
  BurialChamaController.updateBurialCaseStatus
);

// Calculate case benefit
router.post(
  '/cases/:caseId/calculate-benefit',
  protect,
  requireChamaTreasurerOrChairperson, requireModule('burial_welfare'),
  BurialChamaController.calculateCaseBenefit
);

// Submit committee vote
router.post(
  '/cases/:caseId/committee-vote',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.submitCommitteeVote
);

// ======================================================
// PENALTY WAIVER ROUTES
// ======================================================

// Request penalty waiver
router.post(
  '/penalty-waivers',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.requestPenaltyWaiver
);

// Approve penalty waiver
// Restricted to treasurer or chairperson
router.put(
  '/penalty-waivers/:waiverId/approve',
  protect,
  requireChamaTreasurerOrChairperson,
  requireModule('burial_welfare'),
  BurialChamaController.approvePenaltyWaiver
);

// ======================================================
// MEETING ROUTES
// ======================================================

// Create meeting record
router.post(
  '/meetings',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.createMeetingRecord
);

// ======================================================
// COMMUNICATION PREFERENCES ROUTES
// ======================================================

// Update member communication preferences
router.put(
  '/membership/:membershipId/communication-preferences',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.updateCommunicationPreferences
);

// ======================================================
// STATISTICS ROUTES
// ======================================================

router.patch(
  '/chama/:chamaId/membership/:membershipId/class',
  protect,
  requireChamaMember,
  requireChamaTreasurerOrChairperson,
  requireModule('burial_welfare'),
  BurialChamaController.assignMembershipClass
);

// Get chama statistics
router.get(
  '/chama/:chamaId/statistics',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.getChamaStatistics
);

// ======================================================
// RULES ENGINE ROUTES
// ======================================================

// Check beneficiary eligibility
router.get(
  '/eligibility/:membershipId/:beneficiaryId/:burialChamaProfileId',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.checkEligibility
);

// Calculate contribution obligation
router.post(
  '/contribution-obligation/:membershipId',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.calculateContributionObligation
);

// Check member arrears
router.post(
  '/arrears/:membershipId',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.checkArrears
);

// ======================================================
// MEMBER STATEMENT ROUTES
// ======================================================

// Generate member statement
router.post(
  '/membership/:membershipId/statement',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.generateMemberStatement
);

// Get quick member balance
router.get(
  '/membership/:membershipId/balance',
  protect,
  requireChamaMember, requireModule('burial_welfare'),
  BurialChamaController.getQuickBalance
);

// ======================================================
// USSD ROUTES
// ======================================================

// These are normally called by the USSD provider,
// therefore they intentionally do not use `protect`.
router.post(
  '/ussd/init',
  burialUssdRateLimit,
  verifyBurialUssdProvider,
  BurialChamaController.initializeUssdSession
);

router.post(
  '/ussd/process',
  burialUssdRateLimit,
  verifyBurialUssdProvider,
  BurialChamaController.processUssdRequest
);

router.post(
  '/ussd/cleanup',
  burialUssdRateLimit,
  verifyBurialUssdCleanup,
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

// Save wizard progress — same authoring authority as the profile
// create/update route above; only the officials running the wizard
// should be able to write to it.
router.post(
  '/chama/:chamaId/wizard/progress/:stepNumber',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.saveWizardProgress
);

// Load wizard progress
router.get(
  '/chama/:chamaId/wizard/progress',
  protect,
  requireChamaTreasurerOrChairperson,
  BurialChamaController.loadWizardProgress
);

// ======================================================
// EXPORT ROUTER
// ======================================================

export default router;
