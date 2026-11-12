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
    const activeClasses = (profile.membership_classes || []).filter((item) => item.is_active !== false);
    const assignedClass = membership.burial_membership_class
      ? activeClasses.find((item) => item.name.toLowerCase() === membership.burial_membership_class)
      : null;
    const membershipClass = assignedClass
      || activeClasses.find((item) => item.name.toLowerCase() === 'ordinary')
      || activeClasses[0];

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

    const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: profile.chama_id });
    if (!membership) {
      throw new Error('Membership not found');
    }

    const beneficiary = beneficiaryId ? await Beneficiary.findOne({ _id: beneficiaryId, membership_id: membership._id, chama_id: profile.chama_id }) : null;
    if (beneficiaryId && !beneficiary) {
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
    const waitingPeriodDays = Math.max(Number(profile.waiting_period_rules?.waiting_period_days || 0), Number(profile.eligibility_rules?.minimum_membership_months || 0) * 30);
    const joinedAt = membership.joined_at ? new Date(membership.joined_at) : null;
    const membershipDays = joinedAt && !Number.isNaN(joinedAt.getTime())
      ? Math.floor((Date.now() - joinedAt.getTime()) / 86400000)
      : -1;

    if (membershipDays < waitingPeriodDays) {
      eligibility.waiting_period_satisfied = false;
      
      eligibility.is_eligible = false;
      eligibility.reasons.push(`Waiting period not satisfied (${membershipDays}/${waitingPeriodDays} days)`);
    }

    // Check contribution status and arrears
    const arrearsInfo = await this.checkArrears(membershipId, profile);
    eligibility.contribution_status = arrearsInfo.status;
    eligibility.arrears_amount = arrearsInfo.arrears_amount;
    eligibility.arrears_months = arrearsInfo.arrears_months;
    const configuredThreshold = profile.arrears_policy?.arrears_threshold;
    const amountThreshold = profile.arrears_policy?.arrears_threshold_type === 'amount' && configuredThreshold != null
      ? new Decimal(configuredThreshold.toString()) : null;
    const amountExceeded = amountThreshold ? new Decimal(arrearsInfo.arrears_amount).gt(amountThreshold) : false;
    eligibility.good_standing = !amountExceeded && (!profile.eligibility_rules?.good_standing_required || !arrearsInfo.has_arrears || profile.eligibility_rules?.good_standing_definition === 'below_threshold');
    if (amountExceeded) {
      eligibility.good_standing = false;
      eligibility.is_eligible = false;
      eligibility.reasons.push(`Arrears exceed the configured limit of ${amountThreshold.toFixed(2)}`);
    }
    const coverageStatus = membership.status !== 'active'
      ? 'lapsed'
      : !eligibility.waiting_period_satisfied
        ? 'waiting_period'
        : amountExceeded
          ? 'out_of_good_standing'
          : arrearsInfo.has_arrears
            ? 'at_risk'
            : 'covered';
    membership.burial_coverage = {
      ...(membership.burial_coverage?.toObject?.() || membership.burial_coverage || {}),
      status: coverageStatus,
      covered_since: membership.burial_coverage?.covered_since || (eligibility.waiting_period_satisfied ? membership.joined_at : null),
      waiting_period_ends_at: membership.joined_at ? new Date(new Date(membership.joined_at).getTime() + waitingPeriodDays * 86400000) : null,
      last_assessed_at: new Date(),
      lapse_reason: amountExceeded ? `Arrears exceed ${amountThreshold.toFixed(2)}` : membership.status !== 'active' ? `Membership is ${membership.status}` : null,
      reinstated_at: membership.burial_coverage?.reinstated_at || null
    };
    await membership.save();

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
          if (amountExceeded || ((!amountThreshold) && arrearsInfo.arrears_months >= profile.arrears_policy.suspension_threshold_months)) {
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
    if (beneficiary && beneficiary.eligibility_status !== 'eligible') {
      eligibility.is_eligible = false;
      eligibility.reasons.push(`Beneficiary status is ${beneficiary.eligibility_status}`);
    }

    // Check beneficiary effective date range
    const now = new Date();
    if (beneficiary && beneficiary.effective_from > now) {
      eligibility.is_eligible = false;
      eligibility.reasons.push('Beneficiary coverage has not yet started');
    }

    if (beneficiary && beneficiary.effective_to && beneficiary.effective_to < now) {
      eligibility.is_eligible = false;
      eligibility.reasons.push('Beneficiary coverage has expired');
    }

    // Check beneficiary age limits if applicable
    const beneficiaryCategory = beneficiary && profile.beneficiary_categories.find(
      bc => bc.relationship === beneficiary.relationship
    );

    if (beneficiaryCategory && beneficiary) {
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
    if (beneficiary && ['child', 'adopted_child'].includes(beneficiary.relationship)) {
      const ageLimit = beneficiary.education_status === 'college'
        ? Number(profile.family_rules?.college_child_age_limit ?? 24)
        : Number(profile.family_rules?.child_age_limit ?? 18);
      if (Number(beneficiary.age) > ageLimit) {
        eligibility.is_eligible = false;
        eligibility.reasons.push(`Child dependant exceeds the age limit of ${ageLimit}`);
      }
    }

    return eligibility;
  }

  /**
   * Check member arrears status
   */
  static async checkArrears(membershipId, profile) {
    const membership = await ChamaMembership.findOne({ _id: membershipId, chama_id: profile.chama_id }).select('_id chama_id');
    if (!membership) throw new Error('Membership does not belong to this burial chama');
    const obligations = await ContributionObligation.find({
      owner_type: 'Chama',
      owner_id: membership.chama_id,
      participant_type: 'ChamaMembership',
      participant_id: membershipId,
      status: { $in: ['pending', 'partially_paid', 'overdue'] }
    }).sort({ due_date: 1 });

    let totalArrears = new Decimal(0);
    let overdueMonths = new Set();
    const now = new Date();
    const graceDays = Number(profile.grace_period_rules?.default_grace_days || 0);
    const graceCutoff = new Date(now.getTime() - graceDays * 86400000);

    for (const obligation of obligations) {
      const expected = new Decimal(obligation.expected_amount.toString());
      const paid = new Decimal(obligation.paid_amount.toString());
      const balance = expected.minus(paid);

      if (balance.gt(0)) {
        totalArrears = totalArrears.plus(balance);

        // Calculate overdue months
        if (obligation.due_date < graceCutoff) {
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
      has_arrears: hasArrears,
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
      beneficiary?._id || null,
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

    const familyRelationships = ['spouse', 'child', 'adopted_child', 'parent', 'parent_in_law'];
    if (!category && profile.family_rules?.enabled !== false && familyRelationships.includes(relationship)) {
      return { valid: true, category: { relationship, required_documents: [] } };
    }
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

  static async validateFamilyLimit(membershipId, relationship, profile, { excludeId = null, age = null, educationStatus = 'not_applicable' } = {}) {
    if (profile.family_rules?.enabled === false) return { valid: true };
    const limits = profile.family_rules || {};
    const normalized = relationship === 'adopted_child' ? 'child' : relationship;
    const limitByRelationship = {
      spouse: Number(limits.max_spouses ?? 1), child: Number(limits.max_children ?? 6),
      parent: Number(limits.max_parents ?? 2), parent_in_law: Number(limits.max_parents_in_law ?? 2)
    };
    if (normalized === 'child' && age != null) {
      const maxAge = educationStatus === 'college' ? Number(limits.college_child_age_limit ?? 24) : Number(limits.child_age_limit ?? 18);
      if (Number(age) > maxAge) return { valid: false, reason: `Children are covered up to age ${maxAge}${educationStatus === 'college' ? ' while in college' : ''}` };
    }
    if (limitByRelationship[normalized] === undefined) return { valid: true };
    const currentCount = await Beneficiary.countDocuments({
      membership_id: membershipId, chama_id: profile.chama_id,
      relationship: normalized === 'child' ? { $in: ['child', 'adopted_child'] } : normalized,
      eligibility_status: { $in: ['eligible', 'pending_verification'] },
      $or: [{ effective_to: null }, { effective_to: { $gt: new Date() } }],
      ...(excludeId ? { _id: { $ne: excludeId } } : {})
    });
    if (currentCount >= limitByRelationship[normalized]) return { valid: false, reason: `This membership has reached its limit of ${limitByRelationship[normalized]} ${normalized.replace('_', ' ')} dependants` };
    return { valid: true };
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
