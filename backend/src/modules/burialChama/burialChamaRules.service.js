import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import BenefitPlan from '../../models/BenefitPlan.js';
import Beneficiary from '../../models/Beneficiary.js';
import BurialCase from '../../models/BurialCase.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import { Decimal } from 'decimal.js';

// ======================================================
// BURIAL CHAMA RULES ENGINE
// ======================================================
// This service provides the core business logic for
// evaluating and applying burial chama rules at runtime.
// ======================================================

class BurialChamaRulesEngine {
  /**
   * Get burial chama profile for a chama
   */
  static async getProfile(chamaId) {
    const profile = await BurialChamaProfile.findOne({ chama_id: chamaId });
    if (!profile) {
      throw new Error('Burial chama profile not found');
    }
    return profile;
  }

  /**
   * Calculate contribution obligation for a member
   */
  static async calculateContributionObligation(membershipId, profile) {
    const membership = await ChamaMembership.findById(membershipId)
      .populate('user_id');
    
    if (!membership) {
      throw new Error('Membership not found');
    }

    // Determine membership class
    let membershipClass = profile.membership_classes.find(
      mc => mc.name === 'ordinary' // Default to ordinary
    );

    // Could be enhanced to check member's actual class
    // For now, we'll use the first active class
    if (profile.membership_classes.length > 0) {
      membershipClass = profile.membership_classes.find(mc => mc.is_active) || membershipClass;
    }

    if (!membershipClass) {
      throw new Error('No active membership class found');
    }

    // Calculate total contribution from components
    let totalAmount = new Decimal(0);
    const componentBreakdown = [];

    for (const component of profile.contribution_components) {
      if (component.is_active) {
        const componentAmount = new Decimal(component.amount.toString());
        totalAmount = totalAmount.plus(componentAmount);
        
        componentBreakdown.push({
          name: component.name,
          code: component.code,
          amount: componentAmount.toString(),
          currency: component.currency,
          frequency: component.frequency
        });
      }
    }

    return {
      total_amount: totalAmount.toString(),
      currency: membershipClass.currency || 'KES',
      frequency: membershipClass.frequency,
      membership_class: membershipClass.name,
      components: componentBreakdown,
      household_based: profile.membership_model === 'household'
    };
  }

  /**
   * Check member eligibility for benefits
   */
  static async checkEligibility(membershipId, beneficiaryId, burialChamaProfileId) {
    const profile = await BurialChamaProfile.findById(burialChamaProfileId);
    if (!profile) {
      throw new Error('Burial chama profile not found');
    }

    const membership = await ChamaMembership.findById(membershipId);
    if (!membership) {
      throw new Error('Membership not found');
    }

    const beneficiary = await Beneficiary.findById(beneficiaryId);
    if (!beneficiary) {
      throw new Error('Beneficiary not found');
    }

    const eligibility = {
      is_eligible: true,
      reasons: [],
      checked_at: new Date(),
      membership_status: membership.status,
      waiting_period_satisfied: true,
      contribution_status: 'good_standing',
      arrears_impact: 'none'
    };

    // Check membership status
    if (membership.status !== 'active') {
      eligibility.is_eligible = false;
      eligibility.reasons.push(`Membership is ${membership.status}`);
    }

    // Check waiting period
    const waitingPeriodDays = profile.waiting_period_rules.waiting_period_days;
    const membershipDays = Math.floor(
      (new Date() - new Date(membership.joined_at)) / (1000 * 60 * 60 * 24)
    );

    if (membershipDays < waitingPeriodDays) {
      eligibility.waiting_period_satisfied = false;
      
      if (!profile.waiting_period_rules.partial_coverage_during_waiting) {
        eligibility.is_eligible = false;
        eligibility.reasons.push(
          `Waiting period not satisfied (${membershipDays}/${waitingPeriodDays} days)`
        );
      } else {
        eligibility.partial_coverage = true;
        eligibility.partial_coverage_percentage = 
          profile.waiting_period_rules.partial_coverage_percentage;
      }
    }

    // Check contribution status and arrears
    const arrearsInfo = await this.checkArrears(membershipId, profile);
    eligibility.contribution_status = arrearsInfo.status;
    eligibility.arrears_amount = arrearsInfo.arrears_amount;
    eligibility.arrears_months = arrearsInfo.arrears_months;

    // Apply arrears policy
    if (arrearsInfo.has_arrears) {
      switch (profile.arrears_policy.effect) {
        case 'no_effect':
          eligibility.arrears_impact = 'none';
          break;
        case 'deduct_arrears':
          eligibility.arrears_impact = 'deduct';
          eligibility.arrears_deduction = arrearsInfo.arrears_amount;
          break;
        case 'reduce_benefit':
          eligibility.arrears_impact = 'reduce';
          // Reduction formula would be applied during benefit calculation
          break;
        case 'suspend':
          if (arrearsInfo.arrears_months >= profile.arrears_policy.suspension_threshold_months) {
            eligibility.is_eligible = false;
            eligibility.reasons.push(
              `Eligibility suspended due to arrears (${arrearsInfo.arrears_months} months)`
            );
          }
          eligibility.arrears_impact = 'suspend_if_threshold_met';
          break;
        case 'committee_review':
          eligibility.arrears_impact = 'committee_review_required';
          eligibility.requires_committee_review = true;
          break;
        default:
          eligibility.arrears_impact = 'none';
      }
    }

    // Check beneficiary eligibility status
    if (beneficiary.eligibility_status !== 'eligible') {
      eligibility.is_eligible = false;
      eligibility.reasons.push(`Beneficiary status is ${beneficiary.eligibility_status}`);
    }

    // Check beneficiary effective date range
    const now = new Date();
    if (beneficiary.effective_from > now) {
      eligibility.is_eligible = false;
      eligibility.reasons.push('Beneficiary coverage has not yet started');
    }

    if (beneficiary.effective_to && beneficiary.effective_to < now) {
      eligibility.is_eligible = false;
      eligibility.reasons.push('Beneficiary coverage has expired');
    }

    // Check beneficiary age limits if applicable
    const beneficiaryCategory = profile.beneficiary_categories.find(
      bc => bc.relationship === beneficiary.relationship
    );

    if (beneficiaryCategory) {
      if (beneficiaryCategory.max_age && beneficiary.age > beneficiaryCategory.max_age) {
        eligibility.is_eligible = false;
        eligibility.reasons.push(
          `Beneficiary age (${beneficiary.age}) exceeds maximum (${beneficiaryCategory.max_age})`
        );
      }

      if (beneficiaryCategory.min_age && beneficiary.age < beneficiaryCategory.min_age) {
        eligibility.is_eligible = false;
        eligibility.reasons.push(
          `Beneficiary age (${beneficiary.age}) below minimum (${beneficiaryCategory.min_age})`
        );
      }
    }

    return eligibility;
  }

  /**
   * Check member arrears status
   */
  static async checkArrears(membershipId, profile) {
    const obligations = await ContributionObligation.find({
      participant_type: 'ChamaMembership',
      participant_id: membershipId,
      status: { $in: ['pending', 'partially_paid', 'overdue'] }
    }).sort({ due_date: 1 });

    let totalArrears = new Decimal(0);
    let overdueMonths = new Set();
    const now = new Date();

    for (const obligation of obligations) {
      const expected = new Decimal(obligation.expected_amount.toString());
      const paid = new Decimal(obligation.paid_amount.toString());
      const balance = expected.minus(paid);

      if (balance.gt(0)) {
        totalArrears = totalArrears.plus(balance);

        // Calculate overdue months
        if (obligation.due_date < now) {
          const monthKey = `${obligation.due_date.getFullYear()}-${obligation.due_date.getMonth()}`;
          overdueMonths.add(monthKey);
        }
      }
    }

    const arrearsMonths = overdueMonths.size;
    const hasArrears = totalArrears.gt(0);

    let status = 'good_standing';
    if (hasArrears) {
      if (arrearsMonths >= 3) {
        status = 'significant_arrears';
      } else if (arrearsMonths >= 1) {
        status = 'minor_arrears';
      }
    }

    return {
      has_arrears,
      arrears_amount: totalArrears.toString(),
      arrears_months: arrearsMonths,
      status,
      overdue_obligations: obligations.length
    };
  }

  /**
   * Calculate benefit amount for a burial case
   */
  static async calculateBenefit(burialCaseId) {
    const burialCase = await BurialCase.findById(burialCaseId)
      .populate('burial_chama_profile_id')
      .populate('deceased.beneficiary_id')
      .populate('member.membership_id');

    if (!burialCase) {
      throw new Error('Burial case not found');
    }

    const profile = burialCase.burial_chama_profile_id;
    const benefitPlan = await BenefitPlan.findOne({
      burial_chama_profile_id: profile._id
    });

    if (!benefitPlan) {
      throw new Error('Benefit plan not found');
    }

    const beneficiary = burialCase.deceased.beneficiary_id;
    const relationship = beneficiary ? beneficiary.relationship : burialCase.deceased.relationship_to_member;

    // Find applicable benefit rule
    let benefitRule = benefitPlan.benefit_rules.find(
      rule => rule.relationship === relationship
    );

    // If no exact match, try to find a general rule
    if (!benefitRule) {
      benefitRule = benefitPlan.benefit_rules.find(
        rule => rule.relationship === 'custom' || rule.age_group === 'any'
      );
    }

    if (!benefitRule) {
      throw new Error('No applicable benefit rule found');
    }

    let benefitAmount = new Decimal(0);
    let calculationDetails = {};

    // Apply calculation method
    switch (benefitRule.calculation_method) {
      case 'fixed_amount':
        benefitAmount = new Decimal(benefitRule.fixed_amount.toString());
        calculationDetails = {
          method: 'fixed_amount',
          base_amount: benefitRule.fixed_amount.toString()
        };
        break;

      case 'contribution_multiple':
        const contributionObligation = await this.calculateContributionObligation(
          burialCase.member.membership_id._id,
          profile
        );
        const monthlyContribution = new Decimal(contributionObligation.total_amount);
        benefitAmount = monthlyContribution.times(benefitRule.contribution_multiple.multiple);
        calculationDetails = {
          method: 'contribution_multiple',
          monthly_contribution: monthlyContribution.toString(),
          multiple: benefitRule.contribution_multiple.multiple
        };
        break;

      case 'percentage':
        // This would require calculating the base (welfare fund, etc.)
        // For now, we'll use a placeholder
        calculationDetails = {
          method: 'percentage',
          note: 'Base calculation requires welfare fund balance'
        };
        break;

      case 'tiered_amount':
        // Find applicable tier
        const applicableTier = benefitRule.tiered_benefits.find(tier => {
          const min = new Decimal(tier.min_amount.toString());
          const max = tier.max_amount ? new Decimal(tier.max_amount.toString()) : Infinity;
          // This would need actual input amount
          return true; // Placeholder
        });
        
        if (applicableTier) {
          benefitAmount = new Decimal(applicableTier.benefit.toString());
          calculationDetails = {
            method: 'tiered_amount',
            tier: applicableTier
          };
        }
        break;

      case 'custom_formula':
        // Evaluate custom formula (would need formula parser)
        calculationDetails = {
          method: 'custom_formula',
          formula: benefitRule.custom_formula,
          note: 'Custom formula evaluation requires parser implementation'
        };
        break;

      default:
        throw new Error(`Unsupported calculation method: ${benefitRule.calculation_method}`);
    }

    // Apply age-based conditions if applicable
    if (benefitRule.age_condition && beneficiary) {
      if (benefitRule.age_condition.age_group === 'under_18' && beneficiary.age >= 18) {
        // Apply different benefit amount for adults
        calculationDetails.age_adjustment = 'beneficiary is adult, child benefit rate not applicable';
      }
    }

    // Apply special conditions
    if (benefitRule.conditions && beneficiary) {
      if (beneficiary.is_dependant && benefitRule.conditions.disabled_dependant_multiplier > 1) {
        benefitAmount = benefitAmount.times(benefitRule.conditions.disabled_dependant_multiplier);
        calculationDetails.dependant_multiplier = benefitRule.conditions.disabled_dependant_multiplier;
      }
    }

    // Apply maximum benefit cap
    if (benefitRule.maximum_benefit) {
      const maxBenefit = new Decimal(benefitRule.maximum_benefit.toString());
      if (benefitAmount.gt(maxBenefit)) {
        calculationDetails.cap_applied = {
          original: benefitAmount.toString(),
          capped: maxBenefit.toString()
        };
        benefitAmount = maxBenefit;
      }
    }

    // Apply minimum benefit guarantee
    if (benefitRule.minimum_benefit) {
      const minBenefit = new Decimal(benefitRule.minimum_benefit.toString());
      if (benefitAmount.lt(minBenefit)) {
        calculationDetails.minimum_applied = {
          original: benefitAmount.toString(),
          guaranteed: minBenefit.toString()
        };
        benefitAmount = minBenefit;
      }
    }

    // Apply arrears deduction if policy requires
    const eligibility = await this.checkEligibility(
      burialCase.member.membership_id._id,
      beneficiary._id,
      profile._id
    );

    if (eligibility.arrears_impact === 'deduct' && eligibility.arrears_deduction) {
      const arrearsDeduction = new Decimal(eligibility.arrears_deduction);
      const finalAmount = benefitAmount.minus(arrearsDeduction);
      
      if (finalAmount.lt(0)) {
        calculationDetails.arrears_deduction = {
          original: benefitAmount.toString(),
          arrears: arrearsDeduction.toString(),
          final: '0',
          note: 'Arrears exceed benefit amount'
        };
        benefitAmount = new Decimal(0);
      } else {
        calculationDetails.arrears_deduction = {
          original: benefitAmount.toString(),
          arrears: arrearsDeduction.toString(),
          final: finalAmount.toString()
        };
        benefitAmount = finalAmount;
      }
    }

    return {
      calculated_amount: benefitAmount.toString(),
      currency: benefitRule.currency || 'KES',
      calculation_method: benefitRule.calculation_method,
      calculation_details: calculationDetails,
      benefit_rule: {
        relationship: benefitRule.relationship,
        calculation_method: benefitRule.calculation_method
      },
      eligibility_summary: eligibility
    };
  }

  /**
   * Calculate penalty for late payment
   */
  static calculatePenalty(obligation, profile) {
    const now = new Date();
    const dueDate = new Date(obligation.due_date);
    const gracePeriodDays = profile.grace_period_rules.default_grace_days;
    
    // Calculate days overdue
    const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));
    
    if (daysOverdue <= gracePeriodDays) {
      return {
        penalty_amount: '0',
        currency: profile.penalty_policy.currency || 'KES',
        days_overdue: daysOverdue,
        grace_period_remaining: Math.max(0, gracePeriodDays - daysOverdue),
        penalty_applied: false
      };
    }

    const penaltyDays = daysOverdue - gracePeriodDays;
    let penaltyAmount = new Decimal(0);
    const expectedAmount = new Decimal(obligation.expected_amount.toString());

    switch (profile.penalty_policy.method) {
      case 'fixed':
        penaltyAmount = new Decimal(profile.penalty_policy.value.toString());
        break;

      case 'percentage':
        const percentage = new Decimal(profile.penalty_policy.value.toString()).div(100);
        penaltyAmount = expectedAmount.times(percentage);
        break;

      case 'per_day':
        const dailyPenalty = new Decimal(profile.penalty_policy.value.toString());
        penaltyAmount = dailyPenalty.times(penaltyDays);
        break;

      case 'per_missed':
        penaltyAmount = new Decimal(profile.penalty_policy.value.toString());
        break;

      case 'none':
        penaltyAmount = new Decimal(0);
        break;

      default:
        throw new Error(`Unsupported penalty method: ${profile.penalty_policy.method}`);
    }

    // Apply daily cap if configured
    if (profile.penalty_policy.daily_cap) {
      const dailyCap = new Decimal(profile.penalty_policy.daily_cap.toString());
      const maxPenalty = dailyCap.times(penaltyDays);
      if (penaltyAmount.gt(maxPenalty)) {
        penaltyAmount = maxPenalty;
      }
    }

    // Apply maximum percentage cap if configured
    if (profile.penalty_policy.max_penalty_percentage) {
      const maxPercentage = new Decimal(profile.penalty_policy.max_penalty_percentage).div(100);
      const maxPenalty = expectedAmount.times(maxPercentage);
      if (penaltyAmount.gt(maxPenalty)) {
        penaltyAmount = maxPenalty;
      }
    }

    return {
      penalty_amount: penaltyAmount.toString(),
      currency: profile.penalty_policy.currency || 'KES',
      days_overdue: daysOverdue,
      penalty_days: penaltyDays,
      penalty_applied: true,
      calculation_method: profile.penalty_policy.method
    };
  }

  /**
   * Validate beneficiary relationship eligibility
   */
  static validateBeneficiaryRelationship(relationship, profile) {
    const category = profile.beneficiary_categories.find(
      bc => bc.relationship === relationship
    );

    if (!category) {
      return {
        valid: false,
        reason: `Relationship '${relationship}' is not configured in beneficiary categories`
      };
    }

    if (!category.is_active) {
      return {
        valid: false,
        reason: `Relationship '${relationship}' is currently inactive`
      };
    }

    return {
      valid: true,
      category: {
        relationship: category.relationship,
        max_age: category.max_age,
        min_age: category.min_age,
        required_documents: category.required_documents
      }
    };
  }

  /**
   * Get communication channels for a member
   */
  static async getMemberCommunicationChannels(membershipId) {
    // This would integrate with MemberCommunicationPreferences model
    // For now, return default channels
    return {
      primary: 'sms',
      channels: ['sms', 'whatsapp', 'app'],
      language: 'sw'
    };
  }
}

export default BurialChamaRulesEngine;