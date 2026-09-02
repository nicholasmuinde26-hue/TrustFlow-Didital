import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import BenefitPlan from '../../models/BenefitPlan.js';
import Beneficiary from '../../models/Beneficiary.js';
import BurialCase from '../../models/BurialCase.js';
import Household from '../../models/Household.js';
import PenaltyWaiver from '../../models/PenaltyWaiver.js';
import MeetingRecord from '../../models/MeetingRecord.js';
import MemberCommunicationPreferences from '../../models/MemberCommunicationPreferences.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import BurialChamaRulesEngine from './burialChamaRules.service.js';
import { Decimal } from 'decimal.js';

// ======================================================
// BURIAL CHAMA SERVICE
// ======================================================
// This service handles all burial chama operations
// including setup, configuration, and management.
// ======================================================

class BurialChamaService {
  /**
   * Create or update burial chama profile
   */
  static async createOrUpdateProfile(chamaId, profileData, userId) {
    try {
      let profile;
      
      const existingProfile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      
      if (existingProfile) {
        // Update existing profile
        profile = await BurialChamaProfile.findByIdAndUpdate(
          existingProfile._id,
          {
            ...profileData,
            updated_by: userId,
            version: existingProfile.version + 1
          },
          { new: true, runValidators: true }
        );
      } else {
        // Create new profile
        profile = new BurialChamaProfile({
          chama_id: chamaId,
          ...profileData,
          created_by: userId
        });
        await profile.save();
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to create/update burial chama profile: ${error.message}`);
    }
  }

  /**
   * Get burial chama profile
   */
  static async getProfile(chamaId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }
      return profile;
    } catch (error) {
      throw new Error(`Failed to get burial chama profile: ${error.message}`);
    }
  }

  /**
   * Activate burial chama profile
   */
  static async activateProfile(chamaId, userId) {
    try {
      const profile = await BurialChamaProfile.findOneAndUpdate(
        { chama_id: chamaId },
        {
          status: 'active',
          activated_at: new Date(),
          activated_by: userId
        },
        { new: true }
      );

      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      return profile;
    } catch (error) {
      throw new Error(`Failed to activate burial chama profile: ${error.message}`);
    }
  }

  /**
   * Add beneficiary to a member
   */
  static async addBeneficiary(membershipId, beneficiaryData, userId) {
    try {
      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      const profile = await BurialChamaProfile.findOne({ chama_id: membership.chama_id });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      // Validate beneficiary relationship
      const validation = BurialChamaRulesEngine.validateBeneficiaryRelationship(
        beneficiaryData.relationship,
        profile
      );

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      const beneficiary = new Beneficiary({
        membership_id: membershipId,
        chama_id: membership.chama_id,
        ...beneficiaryData,
        changed_by: userId
      });

      await beneficiary.save();
      return beneficiary;
    } catch (error) {
      throw new Error(`Failed to add beneficiary: ${error.message}`);
    }
  }

  /**
   * Update beneficiary information
   */
  static async updateBeneficiary(beneficiaryId, updateData, userId) {
    try {
      const beneficiary = await Beneficiary.findById(beneficiaryId);
      if (!beneficiary) {
        throw new Error('Beneficiary not found');
      }

      // Store previous record for history
      const previousBeneficiary = new Beneficiary({
        ...beneficiary.toObject(),
        _id: undefined,
        effective_to: new Date(),
        previous_beneficiary_id: beneficiary._id
      });
      await previousBeneficiary.save();

      // Update current beneficiary
      const updatedBeneficiary = await Beneficiary.findByIdAndUpdate(
        beneficiaryId,
        {
          ...updateData,
          changed_by: userId,
          effective_from: new Date()
        },
        { new: true, runValidators: true }
      );

      return updatedBeneficiary;
    } catch (error) {
      throw new Error(`Failed to update beneficiary: ${error.message}`);
    }
  }

  /**
   * Get member beneficiaries
   */
  static async getMemberBeneficiaries(membershipId) {
    try {
      const beneficiaries = await Beneficiary.find({
        membership_id: membershipId,
        eligibility_status: 'eligible',
        $or: [
          { effective_to: null },
          { effective_to: { $gt: new Date() } }
        ]
      }).sort({ relationship: 1, first_name: 1 });

      return beneficiaries;
    } catch (error) {
      throw new Error(`Failed to get member beneficiaries: ${error.message}`);
    }
  }

  /**
   * Create household
   */
  static async createHousehold(chamaId, householdData, userId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      if (profile.membership_model !== 'household' && profile.membership_model !== 'hybrid') {
        throw new Error('Households can only be created for household or hybrid membership models');
      }

      const household = new Household({
        chama_id: chamaId,
        ...householdData,
        created_by: userId
      });

      await household.save();
      return household;
    } catch (error) {
      throw new Error(`Failed to create household: ${error.message}`);
    }
  }

  /**
   * Add member to household
   */
  static async addMemberToHousehold(householdId, membershipId, roleData) {
    try {
      const household = await Household.findById(householdId);
      if (!household) {
        throw new Error('Household not found');
      }

      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      if (membership.chama_id.toString() !== household.chama_id.toString()) {
        throw new Error('Membership does not belong to the same chama');
      }

      // Check if member already in household
      const existingMember = household.members.find(
        m => m.membership_id.toString() === membershipId.toString()
      );

      if (existingMember) {
        throw new Error('Member already in household');
      }

      household.members.push({
        membership_id: membershipId,
        ...roleData
      });

      await household.save();
      return household;
    } catch (error) {
      throw new Error(`Failed to add member to household: ${error.message}`);
    }
  }

  /**
   * Create burial case
   */
  static async createBurialCase(caseData, userId) {
    try {
      const profile = await BurialChamaProfile.findById(caseData.burial_chama_profile_id);
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      // Generate case number
      const caseNumber = await this.generateCaseNumber(profile.chama_id);

      const burialCase = new BurialCase({
        ...caseData,
        case_number: caseNumber,
        chama_id: profile.chama_id,
        created_by: userId,
        reported_by: userId
      });

      await burialCase.save();
      return burialCase;
    } catch (error) {
      throw new Error(`Failed to create burial case: ${error.message}`);
    }
  }

  /**
   * Update burial case status
   */
  static async updateBurialCaseStatus(caseId, status, updateData, userId) {
    try {
      const burialCase = await BurialCase.findById(caseId);
      if (!burialCase) {
        throw new Error('Burial case not found');
      }

      const updateFields = {
        status,
        updated_by: userId
      };

      // Add status-specific timestamps and fields
      switch (status) {
        case 'under_review':
          updateFields.under_review_at = new Date();
          break;
        case 'verified':
          updateFields.verified_at = new Date();
          updateFields.verified_by = userId;
          break;
        case 'approved':
          updateFields.approved_at = new Date();
          updateFields.approved_by = userId;
          break;
        case 'rejected':
          updateFields.rejected_at = new Date();
          updateFields.rejected_by = userId;
          if (updateData.rejection_reason) {
            updateFields.rejection_reason = updateData.rejection_reason;
          }
          break;
        case 'closed':
          updateFields.closed_at = new Date();
          updateFields.closed_by = userId;
          break;
      }

      const updatedCase = await BurialCase.findByIdAndUpdate(
        caseId,
        { ...updateFields, ...updateData },
        { new: true, runValidators: true }
      );

      return updatedCase;
    } catch (error) {
      throw new Error(`Failed to update burial case status: ${error.message}`);
    }
  }

  /**
   * Calculate and set benefit for burial case
   */
  static async calculateCaseBenefit(caseId) {
    try {
      const benefitCalculation = await BurialChamaRulesEngine.calculateBenefit(caseId);

      const updatedCase = await BurialCase.findByIdAndUpdate(
        caseId,
        {
          benefit: {
            calculated_amount: benefitCalculation.calculated_amount,
            approved_amount: benefitCalculation.calculated_amount,
            currency: benefitCalculation.currency,
            calculation_method: benefitCalculation.calculation_method,
            calculation_details: benefitCalculation.calculation_details
          },
          status: 'benefit_calculated'
        },
        { new: true }
      );

      return updatedCase;
    } catch (error) {
      throw new Error(`Failed to calculate case benefit: ${error.message}`);
    }
  }

  /**
   * Submit committee vote for burial case
   */
  static async submitCommitteeVote(caseId, voteData, userId) {
    try {
      const burialCase = await BurialCase.findById(caseId);
      if (!burialCase) {
        throw new Error('Burial case not found');
      }

      const membership = await ChamaMembership.findOne({
        user_id: userId,
        chama_id: burialCase.chama_id
      });

      if (!membership) {
        throw new Error('User is not a member of this chama');
      }

      // Check if already voted
      const existingVote = burialCase.committee_review.votes.find(
        v => v.committee_member_id.toString() === membership._id.toString()
      );

      if (existingVote) {
        throw new Error('Member has already voted');
      }

      burialCase.committee_review.votes.push({
        committee_member_id: membership._id,
        vote: voteData.vote,
        comments: voteData.comments
      });

      // Check if quorum is met and determine approval
      const totalVotes = burialCase.committee_review.votes.length;
      const yesVotes = burialCase.committee_review.votes.filter(v => v.vote === 'yes').length;
      const noVotes = burialCase.committee_review.votes.filter(v => v.vote === 'no').length;

      // Simple majority for now
      if (yesVotes > noVotes) {
        burialCase.committee_review.approved = true;
      } else if (noVotes > yesVotes) {
        burialCase.committee_review.approved = false;
      }

      await burialCase.save();
      return burialCase;
    } catch (error) {
      throw new Error(`Failed to submit committee vote: ${error.message}`);
    }
  }

  /**
   * Request penalty waiver
   */
  static async requestPenaltyWaiver(waiverData, userId) {
    try {
      const waiver = new PenaltyWaiver({
        ...waiverData,
        approval: {
          ...waiverData.approval,
          requested_by: userId,
          requested_at: new Date()
        },
        created_by: userId
      });

      await waiver.save();
      return waiver;
    } catch (error) {
      throw new Error(`Failed to request penalty waiver: ${error.message}`);
    }
  }

  /**
   * Approve penalty waiver
   */
  static async approvePenaltyWaiver(waiverId, approvalData, userId) {
    try {
      const waiver = await PenaltyWaiver.findById(waiverId);
      if (!waiver) {
        throw new Error('Penalty waiver not found');
      }

      if (waiver.approval.status !== 'pending') {
        throw new Error('Waiver is not in pending status');
      }

      const updatedWaiver = await PenaltyWaiver.findByIdAndUpdate(
        waiverId,
        {
          'approval.status': approvalData.status,
          'approval.approved_by': userId,
          'approval.approved_at': new Date(),
          'approval.approval_role': approvalData.approval_role,
          'approval.rejection_reason': approvalData.rejection_reason
        },
        { new: true }
      );

      return updatedWaiver;
    } catch (error) {
      throw new Error(`Failed to approve penalty waiver: ${error.message}`);
    }
  }

  /**
   * Create meeting record
   */
  static async createMeetingRecord(meetingData, userId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: meetingData.chama_id });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      // Generate meeting number
      const meetingNumber = await this.generateMeetingNumber(meetingData.chama_id);

      const meeting = new MeetingRecord({
        ...meetingData,
        meeting_number: meetingNumber,
        called_by: userId,
        created_by: userId
      });

      await meeting.save();
      return meeting;
    } catch (error) {
      throw new Error(`Failed to create meeting record: ${error.message}`);
    }
  }

  /**
   * Update member communication preferences
   */
  static async updateCommunicationPreferences(membershipId, preferencesData, userId) {
    try {
      let preferences;

      const existing = await MemberCommunicationPreferences.findOne({ membership_id: membershipId });

      if (existing) {
        preferences = await MemberCommunicationPreferences.findByIdAndUpdate(
          membershipId,
          {
            ...preferencesData,
            last_updated_by: userId,
            preferences_confirmed_at: new Date()
          },
          { new: true, runValidators: true }
        );
      } else {
        const membership = await ChamaMembership.findById(membershipId);
        if (!membership) {
          throw new Error('Membership not found');
        }

        preferences = new MemberCommunicationPreferences({
          membership_id: membershipId,
          chama_id: membership.chama_id,
          user_id: membership.user_id,
          ...preferencesData,
          last_updated_by: userId,
          preferences_confirmed_at: new Date()
        });

        await preferences.save();
      }

      return preferences;
    } catch (error) {
      throw new Error(`Failed to update communication preferences: ${error.message}`);
    }
  }

  /**
   * Get chama statistics
   */
  static async getChamaStatistics(chamaId) {
    try {
      const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
      if (!profile) {
        throw new Error('Burial chama profile not found');
      }

      const totalMembers = await ChamaMembership.countDocuments({
        chama_id: chamaId,
        status: 'active'
      });

      const totalBeneficiaries = await Beneficiary.countDocuments({
        chama_id: chamaId,
        eligibility_status: 'eligible'
      });

      const activeCases = await BurialCase.countDocuments({
        chama_id: chamaId,
        status: { $in: ['reported', 'under_review', 'verified', 'benefit_calculated', 'committee_review'] }
      });

      const completedCases = await BurialCase.countDocuments({
        chama_id: chamaId,
        status: 'closed'
      });

      const totalHouseholds = await Household.countDocuments({
        chama_id: chamaId,
        status: 'active'
      });

      return {
        total_members: totalMembers,
        total_beneficiaries: totalBeneficiaries,
        active_cases: activeCases,
        completed_cases: completedCases,
        total_households: totalHouseholds,
        membership_model: profile.membership_model,
        profile_status: profile.status
      };
    } catch (error) {
      throw new Error(`Failed to get chama statistics: ${error.message}`);
    }
  }

  /**
   * Helper: Generate case number
   */
  static async generateCaseNumber(chamaId) {
    const count = await BurialCase.countDocuments({ chama_id: chamaId });
    const year = new Date().getFullYear();
    return `BC-${chamaId.toString().slice(-4)}-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  /**
   * Helper: Generate meeting number
   */
  static async generateMeetingNumber(chamaId) {
    const count = await MeetingRecord.countDocuments({ chama_id: chamaId });
    const year = new Date().getFullYear();
    return `MT-${chamaId.toString().slice(-4)}-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

export default BurialChamaService;