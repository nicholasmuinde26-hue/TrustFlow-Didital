import BurialChamaService from './burialChama.service.js';
import BurialChamaRulesEngine from './burialChamaRules.service.js';
import MemberStatementService from './memberStatement.service.js';
import UssdService from './ussd.service.js';
import BurialChamaSetupWizardService from './setupWizard.service.js';

// ======================================================
// BURIAL CHAMA CONTROLLER
// ======================================================
// This controller handles HTTP requests for burial chama operations.
// ======================================================

class BurialChamaController {
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
        userId
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
        userId
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

      const beneficiaries = await BurialChamaService.getMemberBeneficiaries(membershipId);

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

      const burialCase = await BurialChamaService.createBurialCase(caseData, userId);

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
        status,
        updateData,
        userId
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

      const burialCase = await BurialChamaService.calculateCaseBenefit(caseId);

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

      res.status(200).json({
        success: true,
        data: balance
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