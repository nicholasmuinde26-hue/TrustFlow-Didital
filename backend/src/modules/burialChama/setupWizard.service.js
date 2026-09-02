import BurialChamaProfile from '../../models/BurialChamaProfile.js';
import BenefitPlan from '../../models/BenefitPlan.js';
import Chama from '../../models/Chama.js';

// ======================================================
// BURIAL CHAMA SETUP WIZARD SERVICE
// ======================================================
// This service provides a step-by-step configuration wizard
// for setting up burial chama profiles with validation at each step.
// ======================================================

class BurialChamaSetupWizardService {
  /**
   * Get setup wizard template
   */
  static getWizardTemplate() {
    return {
      wizard_id: 'burial_chama_setup',
      version: '1.0',
      total_steps: 10,
      steps: [
        {
          step_number: 1,
          name: 'group_information',
          title: 'Group Information',
          description: 'Basic information about your burial chama',
          required_fields: [
            'name',
            'registration_number',
            'physical_address',
            'county',
            'contact_phone'
          ],
          optional_fields: [
            'sub_county',
            'ward',
            'village',
            'contact_email'
          ]
        },
        {
          step_number: 2,
          name: 'membership_model',
          title: 'Membership Model',
          description: 'How contributions are organized',
          required_fields: [
            'membership_model'
          ],
          options: {
            membership_model: ['individual', 'household', 'hybrid']
          }
        },
        {
          step_number: 3,
          name: 'membership_classes',
          title: 'Membership Classes',
          description: 'Different types of members with different contribution rules',
          required_fields: [
            'membership_classes'
          ],
          options: {
            membership_classes: [
              {
                name: 'ordinary',
                description: 'Standard member',
                default_contribution: 200
              },
              {
                name: 'senior',
                description: 'Senior member (60+)',
                default_contribution: 100
              },
              {
                name: 'youth',
                description: 'Youth member (18-25)',
                default_contribution: 100
              },
              {
                name: 'family',
                description: 'Family membership',
                default_contribution: 500
              }
            ]
          }
        },
        {
          step_number: 4,
          name: 'contributions',
          title: 'Contribution Structure',
          description: 'Define contribution components and amounts',
          required_fields: [
            'contribution_components'
          ],
          options: {
            contribution_components: [
              {
                name: 'Welfare',
                description: 'Main welfare contribution',
                default_amount: 200,
                frequency: 'monthly'
              },
              {
                name: 'Emergency',
                description: 'Emergency fund contribution',
                default_amount: 50,
                frequency: 'monthly'
              },
              {
                name: 'Meeting',
                description: 'Meeting contribution',
                default_amount: 20,
                frequency: 'monthly'
              }
            ]
          }
        },
        {
          step_number: 5,
          name: 'beneficiaries',
          title: 'Beneficiary Categories',
          description: 'Who is covered under the burial scheme',
          required_fields: [
            'beneficiary_categories'
          ],
          options: {
            beneficiary_categories: [
              {
                relationship: 'self',
                display_name: 'Member',
                required: true
              },
              {
                relationship: 'spouse',
                display_name: 'Spouse',
                required: true
              },
              {
                relationship: 'child',
                display_name: 'Children',
                max_age: 25,
                required: true
              },
              {
                relationship: 'parent',
                display_name: 'Parents',
                required: false
              }
            ]
          }
        },
        {
          step_number: 6,
          name: 'waiting_period',
          title: 'Waiting Period',
          description: 'Waiting period before new members are eligible for benefits',
          required_fields: [
            'waiting_period_days'
          ],
          options: {
            waiting_period_days: [0, 30, 60, 90, 180]
          }
        },
        {
          step_number: 7,
          name: 'benefits',
          title: 'Benefit Structure',
          description: 'Define benefit amounts for different beneficiaries',
          required_fields: [
            'benefit_rules'
          ],
          options: {
            benefit_rules: [
              {
                relationship: 'self',
                calculation_method: 'fixed_amount',
                default_amount: 50000
              },
              {
                relationship: 'spouse',
                calculation_method: 'fixed_amount',
                default_amount: 30000
              },
              {
                relationship: 'child',
                calculation_method: 'fixed_amount',
                default_amount: 20000
              }
            ]
          }
        },
        {
          step_number: 8,
          name: 'approvals',
          title: 'Approval Workflow',
          description: 'Define who approves claims and benefits',
          required_fields: [
            'approval_rules'
          ],
          options: {
            approval_rules: {
              claim_approval: {
                required_roles: ['chairperson', 'treasurer'],
                minimum_approvals: 2
              },
              benefit_thresholds: [
                {
                  max_amount: 50000,
                  required_roles: ['chairperson', 'treasurer'],
                  minimum_approvals: 2
                },
                {
                  max_amount: 100000,
                  required_roles: ['chairperson', 'treasurer', 'secretary'],
                  minimum_approvals: 3
                }
              ]
            }
          }
        },
        {
          step_number: 9,
          name: 'payments',
          title: 'Payment Methods',
          description: 'Configure accepted payment methods',
          required_fields: [
            'payment_methods'
          ],
          options: {
            payment_methods: ['mpesa', 'bank', 'cash'],
            mpesa_config: {
              paybill_number: '',
              till_number: ''
            }
          }
        },
        {
          step_number: 10,
          name: 'communication',
          title: 'Communication Settings',
          description: 'Configure how members are contacted',
          required_fields: [
            'communication_rules'
          ],
          options: {
            communication_rules: {
              primary_channel: 'sms',
              enabled_channels: ['sms', 'whatsapp', 'app'],
              supported_languages: ['en', 'sw'],
              default_language: 'sw'
            }
          }
        }
      ]
    };
  }

  /**
   * Validate wizard step
   */
  static validateStep(stepNumber, stepData) {
    const template = this.getWizardTemplate();
    const step = template.steps.find(s => s.step_number === stepNumber);

    if (!step) {
      return {
        valid: false,
        errors: [`Invalid step number: ${stepNumber}`]
      };
    }

    const errors = [];

    // Check required fields
    step.required_fields.forEach(field => {
      if (!stepData[field]) {
        errors.push(`${field} is required`);
      }
    });

    // Step-specific validation
    switch (step.name) {
      case 'group_information':
        if (stepData.contact_phone && !this.validatePhone(stepData.contact_phone)) {
          errors.push('Invalid phone number format');
        }
        if (stepData.contact_email && !this.validateEmail(stepData.contact_email)) {
          errors.push('Invalid email format');
        }
        break;

      case 'membership_classes':
        if (stepData.membership_classes && stepData.membership_classes.length === 0) {
          errors.push('At least one membership class is required');
        }
        stepData.membership_classes?.forEach((mc, index) => {
          if (!mc.name || !mc.contribution_amount) {
            errors.push(`Membership class ${index + 1} is missing name or contribution amount`);
          }
        });
        break;

      case 'contributions':
        if (stepData.contribution_components && stepData.contribution_components.length === 0) {
          errors.push('At least one contribution component is required');
        }
        stepData.contribution_components?.forEach((cc, index) => {
          if (!cc.name || !cc.amount) {
            errors.push(`Contribution component ${index + 1} is missing name or amount`);
          }
        });
        break;

      case 'beneficiaries':
        if (stepData.beneficiary_categories && stepData.beneficiary_categories.length === 0) {
          errors.push('At least one beneficiary category is required');
        }
        break;

      case 'waiting_period':
        if (stepData.waiting_period_days < 0) {
          errors.push('Waiting period cannot be negative');
        }
        break;

      case 'benefits':
        if (stepData.benefit_rules && stepData.benefit_rules.length === 0) {
          errors.push('At least one benefit rule is required');
        }
        stepData.benefit_rules?.forEach((br, index) => {
          if (!br.relationship || !br.calculation_method) {
            errors.push(`Benefit rule ${index + 1} is missing relationship or calculation method`);
          }
        });
        break;

      case 'payments':
        if (stepData.payment_methods && stepData.payment_methods.length === 0) {
          errors.push('At least one payment method is required');
        }
        if (stepData.payment_methods?.includes('mpesa') && !stepData.mpesa_config?.paybill_number) {
          errors.push('M-Pesa PayBill number is required when M-Pesa is enabled');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Complete wizard and create profile
   */
  static async completeWizard(chamaId, wizardData, userId) {
    try {
      // Validate all steps
      const validationResults = [];
      for (let i = 1; i <= 10; i++) {
        const stepKey = `step_${i}`;
        if (wizardData[stepKey]) {
          const validation = this.validateStep(i, wizardData[stepKey]);
          validationResults.push({
            step: i,
            ...validation
          });
        }
      }

      const hasErrors = validationResults.some(r => !r.valid);
      if (hasErrors) {
        return {
          success: false,
          validation_results: validationResults
        };
      }

      // Build profile data from wizard data
      const profileData = this.buildProfileFromWizardData(wizardData);

      // Create profile
      const profile = await BurialChamaProfile.createOrUpdateProfile(
        chamaId,
        profileData,
        userId
      );

      // Create benefit plan
      const benefitPlanData = this.buildBenefitPlanFromWizardData(wizardData, profile._id);
      const benefitPlan = new BenefitPlan(benefitPlanData);
      await benefitPlan.save();

      return {
        success: true,
        profile,
        benefit_plan,
        validation_results: validationResults
      };
    } catch (error) {
      throw new Error(`Failed to complete wizard: ${error.message}`);
    }
  }

  /**
   * Build profile data from wizard data
   */
  static buildProfileFromWizardData(wizardData) {
    const step1 = wizardData.step_1 || {};
    const step2 = wizardData.step_2 || {};
    const step3 = wizardData.step_3 || {};
    const step4 = wizardData.step_4 || {};
    const step5 = wizardData.step_5 || {};
    const step6 = wizardData.step_6 || {};
    const step8 = wizardData.step_8 || {};
    const step9 = wizardData.step_9 || {};
    const step10 = wizardData.step_10 || {};

    return {
      chama_info: {
        registration_number: step1.registration_number,
        physical_address: step1.physical_address,
        county: step1.county,
        sub_county: step1.sub_county,
        ward: step1.ward,
        village: step1.village,
        contact_phone: step1.contact_phone,
        contact_email: step1.contact_email
      },
      membership_model: step2.membership_model,
      membership_classes: step3.membership_classes || [],
      contribution_components: step4.contribution_components || [],
      beneficiary_categories: step5.beneficiary_categories || [],
      waiting_period_rules: {
        waiting_period_days: step6.waiting_period_days || 90
      },
      approval_rules: step8.approval_rules || {},
      payment_rules: {
        accepted_methods: step9.payment_methods || ['mpesa', 'cash'],
        mpesa_config: step9.mpesa_config || {},
        ussd_enabled: true
      },
      communication_rules: step10.communication_rules || {},
      status: 'draft'
    };
  }

  /**
   * Build benefit plan data from wizard data
   */
  static buildBenefitPlanFromWizardData(wizardData, profileId) {
    const step7 = wizardData.step_7 || {};

    return {
      burial_chama_profile_id: profileId,
      benefit_rules: step7.benefit_rules || [],
      approval_requirements: {
        auto_approve_below_amount: 10000,
        committee_approval_required: true,
        minimum_committee_members: 3
      },
      payout_config: {
        default_payout_method: 'mpesa',
        payout_timing: 'within_48h',
        require_funeral_notice: true
      }
    };
  }

  /**
   * Get preset configurations
   */
  static getPresetConfigurations() {
    return {
      small_rural: {
        name: 'Small Rural Chama',
        description: 'Simple setup for small village groups',
        config: {
          membership_model: 'individual',
          membership_classes: [
            {
              name: 'ordinary',
              contribution_amount: 200,
              frequency: 'monthly'
            }
          ],
          contribution_components: [
            {
              name: 'Welfare',
              amount: 200,
              frequency: 'monthly'
            }
          ],
          beneficiary_categories: [
            { relationship: 'self' },
            { relationship: 'spouse' },
            { relationship: 'child', max_age: 18 }
          ],
          waiting_period_days: 90,
          benefit_rules: [
            {
              relationship: 'self',
              calculation_method: 'fixed_amount',
              fixed_amount: 30000
            },
            {
              relationship: 'spouse',
              calculation_method: 'fixed_amount',
              fixed_amount: 20000
            },
            {
              relationship: 'child',
              calculation_method: 'fixed_amount',
              fixed_amount: 10000
            }
          ]
        }
      },
      urban_professional: {
        name: 'Urban Professional Chama',
        description: 'Advanced setup for urban professional groups',
        config: {
          membership_model: 'individual',
          membership_classes: [
            {
              name: 'ordinary',
              contribution_amount: 500,
              frequency: 'monthly'
            },
            {
              name: 'senior',
              contribution_amount: 300,
              frequency: 'monthly'
            }
          ],
          contribution_components: [
            {
              name: 'Welfare',
              amount: 300,
              frequency: 'monthly'
            },
            {
              name: 'Emergency',
              amount: 100,
              frequency: 'monthly'
            },
            {
              name: 'Development',
              amount: 100,
              frequency: 'monthly'
            }
          ],
          beneficiary_categories: [
            { relationship: 'self' },
            { relationship: 'spouse' },
            { relationship: 'child', max_age: 25 },
            { relationship: 'parent' }
          ],
          waiting_period_days: 60,
          benefit_rules: [
            {
              relationship: 'self',
              calculation_method: 'contribution_multiple',
              contribution_multiple: { multiple: 60 }
            },
            {
              relationship: 'spouse',
              calculation_method: 'contribution_multiple',
              contribution_multiple: { multiple: 40 }
            },
            {
              relationship: 'child',
              calculation_method: 'contribution_multiple',
              contribution_multiple: { multiple: 20 }
            }
          ]
        }
      },
      family_based: {
        name: 'Family-Based Chama',
        description: 'Setup for family-oriented groups',
        config: {
          membership_model: 'household',
          membership_classes: [
            {
              name: 'family',
              contribution_amount: 500,
              frequency: 'monthly'
            }
          ],
          contribution_components: [
            {
              name: 'Welfare',
              amount: 500,
              frequency: 'monthly'
            }
          ],
          beneficiary_categories: [
            { relationship: 'self' },
            { relationship: 'spouse' },
            { relationship: 'child', max_age: 25 },
            { relationship: 'parent' },
            { relationship: 'dependant' }
          ],
          waiting_period_days: 30,
          benefit_rules: [
            {
              relationship: 'self',
              calculation_method: 'fixed_amount',
              fixed_amount: 50000
            },
            {
              relationship: 'spouse',
              calculation_method: 'fixed_amount',
              fixed_amount: 40000
            },
            {
              relationship: 'child',
              calculation_method: 'tiered_amount',
              tiered_benefits: [
                { min_amount: 0, max_amount: 18, benefit: 25000 },
                { min_amount: 18, max_amount: 25, benefit: 15000 }
              ]
            }
          ]
        }
      }
    };
  }

  /**
   * Save wizard progress
   */
  static async saveProgress(chamaId, stepNumber, stepData, userId) {
    // This would integrate with a WizardProgress model
    // For now, return success
    return {
      success: true,
      step_number: stepNumber,
      saved_at: new Date()
    };
  }

  /**
   * Load wizard progress
   */
  static async loadProgress(chamaId) {
    // This would integrate with a WizardProgress model
    // For now, return empty progress
    return {
      chama_id: chamaId,
      completed_steps: [],
      current_step: 1,
      saved_data: {}
    };
  }

  // Helper validation methods
  static validatePhone(phone) {
    const phoneRegex = /^(\+254|0)?[7]\d{8}$/;
    return phoneRegex.test(phone);
  }

  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default BurialChamaSetupWizardService;