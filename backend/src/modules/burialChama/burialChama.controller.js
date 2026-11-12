import BurialChamaService from './burialChama.service.js';
import BurialChamaRulesEngine from './burialChamaRules.service.js';
import MemberStatementService from './memberStatement.service.js';
import UssdService from './ussd.service.js';
import BurialChamaSetupWizardService from './setupWizard.service.js';
import BurialOperationsService from './burialOperations.service.js';

// ======================================================
// BURIAL CHAMA CONTROLLER
// ======================================================
// This controller handles HTTP requests for burial chama operations.
// ======================================================

class BurialChamaController {
  static async listFundraisingCampaigns(req, res) {
    try { res.json({ success: true, data: await BurialOperationsService.listCampaigns(req.membership.chama_id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async createFundraisingCampaign(req, res) {
    try { res.status(201).json({ success: true, data: await BurialOperationsService.createCampaign(req.membership.chama_id, req.user.id, req.body) }); }
    catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
  }
  static async recordFundraisingContribution(req, res) {
    try { res.status(201).json({ success: true, data: await BurialOperationsService.recordCampaignContribution(req.membership.chama_id, req.params.campaignId, req.user.id, req.body) }); }
    catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
  }
  static async listBurialEquipment(req, res) {
    try { res.json({ success: true, data: await BurialOperationsService.listEquipment(req.membership.chama_id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async createBurialEquipment(req, res) {
    try { res.status(201).json({ success: true, data: await BurialOperationsService.createEquipment(req.membership.chama_id, req.user.id, req.body) }); }
    catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
  }
  static async listBurialEquipmentBookings(req, res) {
    try { res.json({ success: true, data: await BurialOperationsService.listEquipmentBookings(req.membership.chama_id, req.membership.role) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async createBurialEquipmentBooking(req, res) {
    try { res.status(201).json({ success: true, data: await BurialOperationsService.createEquipmentBooking(req.membership.chama_id, req.user.id, req.body) }); }
    catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
  }
  static async returnBurialEquipmentBooking(req, res) {
    try { res.json({ success: true, data: await BurialOperationsService.returnEquipment(req.membership.chama_id, req.params.bookingId, req.body) }); }
    catch (error) { res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
  }
  static async listBurialCases(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.listBurialCases(req.membership.chama_id, req.membership._id, req.membership.role) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async getBurialCase(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.getBurialCase(req.params.caseId, req.membership.chama_id, req.membership._id, req.membership.role) }); }
    catch (error) { res.status(404).json({ success: false, message: error.message }); }
  }
  static async addCaseDocuments(req, res) {
    try { res.status(201).json({ success: true, data: await BurialChamaService.addCaseDocuments(req.params.caseId, req.membership.chama_id, req.user.id, req.body.documents) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async verifyCaseDocument(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.verifyCaseDocument(req.params.caseId, req.params.documentId, req.membership.chama_id, req.user.id, req.membership, req.body.verified !== false) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async recordHomeVisit(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.recordHomeVisit(req.params.caseId, req.membership.chama_id, req.membership, req.user.id, req.body.completed, req.body.notes) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async resolveFraudFlag(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.resolveFraudFlag(req.params.caseId, req.params.flagId, req.membership.chama_id, req.membership, req.user.id, req.body.reason) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async getNextOfKin(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.getNextOfKin(req.params.membershipId, req.membership.chama_id, req.user.id, req.membership?.role) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async replaceNextOfKin(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.replaceNextOfKin(req.params.membershipId, req.membership.chama_id, req.body.contacts, req.user.id, req.membership?.role) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async requestBurialPayoutApproval(req, res) {
    try { res.status(201).json({ success: true, data: await BurialChamaService.requestBurialPayoutApproval(req.params.caseId, req.membership.chama_id, req.membership, req.user.id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async disburseBurialBenefit(req, res) {
    try { res.status(202).json({ success: true, data: await BurialChamaService.disburseBurialBenefit(req.params.caseId, req.membership.chama_id, req.membership, req.user.id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async listChamaBeneficiaries(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.listChamaBeneficiaries(req.params.chamaId) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async listHouseholds(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.listHouseholds(req.membership.chama_id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async getHousehold(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.getHousehold(req.params.householdId, req.membership.chama_id) }); }
    catch (error) { res.status(404).json({ success: false, message: error.message }); }
  }
  static async updateHousehold(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.updateHousehold(req.params.householdId, req.membership.chama_id, req.body, req.user.id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async removeHouseholdMember(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.removeHouseholdMember(req.params.householdId, req.membership.chama_id, req.params.membershipId) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async dissolveHousehold(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.dissolveHousehold(req.params.householdId, req.membership.chama_id, req.user.id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async listPenaltyWaivers(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.listPenaltyWaivers(req.params.chamaId) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async listMeetingRecords(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.listMeetingRecords(req.params.chamaId) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  static async getMyCoverage(req, res) {
    try { res.json({ success: true, data: await BurialChamaService.getMemberCoverage(req.membership._id) }); }
    catch (error) { res.status(400).json({ success: false, message: error.message }); }
  }
  /**
   * Create or update burial chama profile
   */
  static async createOrUpdateProfile(req, res) {
    try {
      const { chamaId } = req.params;
      const profileData = req.body;
      const userId = req.user.id;

      const profile = await BurialChamaService.createOrUpdateProfile(
        chamaId,
        profileData,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Burial chama profile created/updated successfully',
        data: profile
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get burial chama profile
   */
  static async getProfile(req, res) {
    try {
      const { chamaId } = req.params;

      const profile = await BurialChamaService.getProfile(chamaId);

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Activate burial chama profile
   */
  static async activateProfile(req, res) {
    try {
      const { chamaId } = req.params;
      const userId = req.user.id;

      const profile = await BurialChamaService.activateProfile(chamaId, userId);

      res.status(200).json({
        success: true,
        message: 'Burial chama profile activated successfully',
        data: profile
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Add beneficiary
   */
  static async addBeneficiary(req, res) {
    try {
      const { membershipId } = req.params;
      const beneficiaryData = req.body;
      const userId = req.user.id;

      const beneficiary = await BurialChamaService.addBeneficiary(
        membershipId,
        beneficiaryData,
        userId,
        req.membership?.role,
        req.membership?.chama_id
      );

      res.status(201).json({
        success: true,
        message: 'Beneficiary added successfully',
        data: beneficiary
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update beneficiary
   */
  static async updateBeneficiary(req, res) {
    try {
      const { beneficiaryId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const beneficiary = await BurialChamaService.updateBeneficiary(
        beneficiaryId,
        updateData,
        userId,
        req.membership?.role,
        req.membership?.chama_id
      );

      res.status(200).json({
        success: true,
        message: 'Beneficiary updated successfully',
        data: beneficiary
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get member beneficiaries
   */
  static async getMemberBeneficiaries(req, res) {
    try {
      const { membershipId } = req.params;

      const beneficiaries = await BurialChamaService.getMemberBeneficiaries(membershipId, req.user.id, req.membership?.role, req.membership?.chama_id);

      res.status(200).json({
        success: true,
        data: beneficiaries
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create household
   */
  static async createHousehold(req, res) {
    try {
      const { chamaId } = req.params;
      const householdData = req.body;
      const userId = req.user.id;

      const household = await BurialChamaService.createHousehold(
        chamaId,
        householdData,
        userId
      );

      res.status(201).json({
        success: true,
        message: 'Household created successfully',
        data: household
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Add member to household
   */
  static async addMemberToHousehold(req, res) {
    try {
      const { householdId, membershipId } = req.params;
      const roleData = req.body;

      const household = await BurialChamaService.addMemberToHousehold(
        householdId,
        membershipId,
        roleData
      );

      res.status(200).json({
        success: true,
        message: 'Member added to household successfully',
        data: household
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create burial case
   */
  static async createBurialCase(req, res) {
    try {
      const caseData = req.body;
      const userId = req.user.id;

      const burialCase = await BurialChamaService.createBurialCase(caseData, userId, req.membership);

      res.status(201).json({
        success: true,
        message: 'Burial case created successfully',
        data: burialCase
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update burial case status
   */
  static async updateBurialCaseStatus(req, res) {
    try {
      const { caseId } = req.params;
      const { status, ...updateData } = req.body;
      const userId = req.user.id;

      const burialCase = await BurialChamaService.updateBurialCaseStatus(
        caseId,
        req.membership.chama_id,
        status,
        updateData,
        userId,
        req.membership
      );

      res.status(200).json({
        success: true,
        message: 'Burial case status updated successfully',
        data: burialCase
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Calculate case benefit
   */
  static async calculateCaseBenefit(req, res) {
    try {
      const { caseId } = req.params;

      const burialCase = await BurialChamaService.calculateCaseBenefit(caseId, req.membership.chama_id, req.user.id, req.body?.ex_gratia === true, req.membership);

      res.status(200).json({
        success: true,
        message: 'Benefit calculated successfully',
        data: burialCase
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Submit committee vote
   */
  static async submitCommitteeVote(req, res) {
    try {
      const { caseId } = req.params;
      const voteData = req.body;
      const userId = req.user.id;

      const burialCase = await BurialChamaService.submitCommitteeVote(
        caseId,
        voteData,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Committee vote submitted successfully',
        data: burialCase
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Request penalty waiver
   */
  static async requestPenaltyWaiver(req, res) {
    try {
      const waiverData = req.body;
      const userId = req.user.id;

      const waiver = await BurialChamaService.requestPenaltyWaiver(waiverData, userId);

      res.status(201).json({
        success: true,
        message: 'Penalty waiver requested successfully',
        data: waiver
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Approve penalty waiver
   */
  static async approvePenaltyWaiver(req, res) {
    try {
      const { waiverId } = req.params;
      const approvalData = req.body;
      const userId = req.user.id;

      const waiver = await BurialChamaService.approvePenaltyWaiver(
        waiverId,
        req.membership.chama_id,
        approvalData,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Penalty waiver processed successfully',
        data: waiver
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create meeting record
   */
  static async createMeetingRecord(req, res) {
    try {
      const meetingData = req.body;
      const userId = req.user.id;

      const meeting = await BurialChamaService.createMeetingRecord(meetingData, userId);

      res.status(201).json({
        success: true,
        message: 'Meeting record created successfully',
        data: meeting
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update communication preferences
   */
  static async updateCommunicationPreferences(req, res) {
    try {
      const { membershipId } = req.params;
      const preferencesData = req.body;
      const userId = req.user.id;

      const preferences = await BurialChamaService.updateCommunicationPreferences(
        membershipId,
        preferencesData,
        userId
      );

      res.status(200).json({
        success: true,
        message: 'Communication preferences updated successfully',
        data: preferences
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get chama statistics
   */
  static async getChamaStatistics(req, res) {
    try {
      const { chamaId } = req.params;

      const statistics = await BurialChamaService.getChamaStatistics(chamaId);

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  static async assignMembershipClass(req, res) {
    try {
      const membership = await BurialChamaService.assignMembershipClass(
        req.params.chamaId,
        req.params.membershipId,
        req.body.class_name,
        req.membership?._id
      );
      res.json({ success: true, data: membership });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  /**
   * Check eligibility
   */
  static async checkEligibility(req, res) {
    try {
      const { membershipId, beneficiaryId, burialChamaProfileId } = req.params;

      const eligibility = await BurialChamaRulesEngine.checkEligibility(
        membershipId,
        beneficiaryId,
        burialChamaProfileId
      );

      res.status(200).json({
        success: true,
        data: eligibility
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Calculate contribution obligation
   */
  static async calculateContributionObligation(req, res) {
    try {
      const { membershipId } = req.params;

      const profile = await BurialChamaRulesEngine.getProfile(req.body.chamaId);
      const obligation = await BurialChamaRulesEngine.calculateContributionObligation(
        membershipId,
        profile
      );

      res.status(200).json({
        success: true,
        data: obligation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Check arrears
   */
  static async checkArrears(req, res) {
    try {
      const { membershipId } = req.params;
      const { chamaId } = req.body;

      const profile = await BurialChamaRulesEngine.getProfile(chamaId);
      const arrears = await BurialChamaRulesEngine.checkArrears(membershipId, profile);

      res.status(200).json({
        success: true,
        data: arrears
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Generate member statement
   */
  static async generateMemberStatement(req, res) {
    try {
      const { membershipId } = req.params;
      const { format, language, period_start, period_end } = req.body;

      const statement = await MemberStatementService.generateFormattedStatement(
        membershipId,
        format || 'app',
        {
          language,
          period_start: period_start ? new Date(period_start) : undefined,
          period_end: period_end ? new Date(period_end) : undefined
        }
      );

      res.status(200).json({
        success: true,
        data: statement
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get quick balance for USSD
   */
  static async getQuickBalance(req, res) {
    try {
      const { membershipId } = req.params;
      const { language } = req.query;

      const balance = await MemberStatementService.getQuickBalance(
        membershipId,
        language || 'sw'
      );
      const coverage = await BurialChamaService.getMemberCoverage(membershipId);

      res.status(200).json({
        success: true,
        data: { ...balance, coverage }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Initialize USSD session
   */
  static async initializeUssdSession(req, res) {
    try {
      const { phoneNumber, sessionId, networkInfo } = req.body;

      const session = await UssdService.initializeSession(
        phoneNumber,
        sessionId,
        networkInfo
      );

      res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Process USSD request
   */
  static async processUssdRequest(req, res) {
    try {
      const { sessionId, userInput } = req.body;

      const response = await UssdService.processRequest(sessionId, userInput);

      res.status(200).json({
        success: true,
        data: response
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Cleanup expired USSD sessions
   */
  static async cleanupUssdSessions(req, res) {
    try {
      const result = await UssdService.cleanupExpiredSessions();

      res.status(200).json({
        success: true,
        message: `Cleaned up ${result} expired sessions`,
        data: { cleaned_count: result }
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get setup wizard template
   */
  static async getWizardTemplate(req, res) {
    try {
      const template = BurialChamaSetupWizardService.getWizardTemplate();

      res.status(200).json({
        success: true,
        data: template
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Validate wizard step
   */
  static async validateWizardStep(req, res) {
    try {
      const { stepNumber } = req.params;
      const stepData = req.body;

      const validation = BurialChamaSetupWizardService.validateStep(
        parseInt(stepNumber),
        stepData
      );

      res.status(200).json({
        success: true,
        data: validation
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Complete wizard
   */
  static async completeWizard(req, res) {
    try {
      const { chamaId } = req.params;
      const wizardData = req.body;
      const userId = req.user.id;

      const result = await BurialChamaSetupWizardService.completeWizard(
        chamaId,
        wizardData,
        userId
      );

      res.status(200).json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get preset configurations
   */
  static async getPresetConfigurations(req, res) {
    try {
      const presets = BurialChamaSetupWizardService.getPresetConfigurations();

      res.status(200).json({
        success: true,
        data: presets
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Save wizard progress
   */
  static async saveWizardProgress(req, res) {
    try {
      const { chamaId, stepNumber } = req.params;
      const stepData = req.body;
      const userId = req.user.id;

      const result = await BurialChamaSetupWizardService.saveProgress(
        chamaId,
        parseInt(stepNumber),
        stepData,
        userId
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Load wizard progress
   */
  static async loadWizardProgress(req, res) {
    try {
      const { chamaId } = req.params;

      const progress = await BurialChamaSetupWizardService.loadProgress(chamaId);

      res.status(200).json({
        success: true,
        data: progress
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default BurialChamaController;
