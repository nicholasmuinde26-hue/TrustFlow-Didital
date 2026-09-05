import ChamaMembership from '../models/ChamaMembership.js';
import Chama from '../models/Chama.js';
import ChamaLoan from '../models/ChamaLoan.js';
import permissionService from './permission.service.js';
import { LOAN_STATUS } from '../modules/loans/Loan.constants.js';

// ========================================
// ACTION SAFETY ENGINE
// ========================================
//
// Centralized system for validating, warning, and confirming
// sensitive actions in ChamaManager
//
// Follows 4-level interaction pattern:
// 1. Informational - no confirmation
// 2. Warning - one confirmation
// 3. Critical - deliberate re-confirmation
// 4. High-risk - step-up confirmation
//
// ========================================

const ACTION_LEVELS = {
  INFORMATIONAL: 'informational',
  WARNING: 'warning',
  CRITICAL: 'critical',
  HIGH_RISK: 'high_risk'
};

const ACTION_CATEGORIES = {
  LOAN: 'loan',
  CONTRIBUTION: 'contribution',
  PAYMENT: 'payment',
  WITHDRAWAL: 'withdrawal',
  BURIAL: 'burial',
  FINE: 'fine',
  MEMBER: 'member',
  ROLE: 'role',
  FINANCIAL: 'financial',
  GOVERNANCE: 'governance'
};

class ActionSafetyEngine {
  /**
   * Pre-action validation and risk assessment
   * Returns: { allowed, warnings, confirmationLevel, requiredApprovals, riskFactors }
   */
  async assessActionRisk({ action, membershipId, chamaId, actionData }) {
    const membership = await ChamaMembership.findById(membershipId).populate('user_id');
    if (!membership) {
      return { allowed: false, reason: 'Membership not found' };
    }

    const chama = await Chama.findById(chamaId);
    if (!chama) {
      return { allowed: false, reason: 'Chama not found' };
    }

    // 1. Permission check
    const permissionCheck = await this.checkPermission(action, membership, chamaId);
    if (!permissionCheck.allowed) {
      return permissionCheck;
    }

    // 2. Role check
    const roleCheck = await this.checkRoleAccess(action, membership, chama);
    if (!roleCheck.allowed) {
      return roleCheck;
    }

    // 3. Policy check
    const policyCheck = await this.checkPolicy(action, membership, chama, actionData);
    if (!policyCheck.allowed) {
      return policyCheck;
    }

    // 4. Financial limit check
    const limitCheck = await this.checkFinancialLimits(action, membership, chama, actionData);
    if (!limitCheck.allowed) {
      return limitCheck;
    }

    // 5. Approval requirement check
    const approvalCheck = await this.checkApprovalRequirements(action, membership, chama, actionData);
    
    // 6. Risk assessment
    const riskAssessment = await this.assessRisk(action, membership, chama, actionData);

    // 7. Warning generation
    const warnings = await this.generateWarnings(action, membership, chama, actionData, riskAssessment);

    // 8. Confirmation level determination
    const confirmationLevel = this.determineConfirmationLevel(action, riskAssessment, warnings);

    return {
      allowed: true,
      warnings,
      confirmationLevel,
      requiredApprovals: approvalCheck.requiredApprovals,
      riskFactors: riskAssessment,
      permissionCheck,
      roleCheck,
      policyCheck,
      limitCheck
    };
  }

  /**
   * Check if user has permission for action
   */
  async checkPermission(action, membership, chamaId) {
    const permissionKey = this.getActionPermissionKey(action);
    
    try {
      const hasPermission = await permissionService.checkPermission({
        userId: membership.user_id._id,
        chamaId,
        permission: permissionKey,
        resourceId: membership._id
      });

      if (!hasPermission) {
        return {
          allowed: false,
          reason: 'INSUFFICIENT_PERMISSION',
          message: `You do not have permission to perform this action (${permissionKey})`
        };
      }

      return { allowed: true };
    } catch (error) {
      return {
        allowed: false,
        reason: 'PERMISSION_CHECK_FAILED',
        message: 'Permission check failed'
      };
    }
  }

  /**
   * Check if user's role allows this action
   */
  async checkRoleAccess(action, membership, chama) {
    const requiredRoles = this.getRequiredRolesForAction(action);
    
    if (requiredRoles.length === 0) {
      return { allowed: true };
    }

    if (!requiredRoles.includes(membership.role)) {
      return {
        allowed: false,
        reason: 'INSUFFICIENT_ROLE',
        message: `This action requires one of these roles: ${requiredRoles.join(', ')}`
      };
    }

    return { allowed: true };
  }

  /**
   * Check chama policies for action
   */
  async checkPolicy(action, membership, chama, actionData) {
    switch (action) {
      case 'loan.approve':
        return this.checkLoanApprovalPolicy(membership, chama, actionData);
      
      case 'loan.disburse':
        return this.checkLoanDisbursementPolicy(membership, chama, actionData);
      
      case 'payment.reverse':
        return this.checkPaymentReversalPolicy(membership, chama, actionData);
      
      case 'member.remove':
        return this.checkMemberRemovalPolicy(membership, chama, actionData);
      
      case 'contribution.change_amount':
        return this.checkContributionChangePolicy(membership, chama, actionData);
      
      default:
        return { allowed: true };
    }
  }

  /**
   * Check financial limits
   */
  async checkFinancialLimits(action, membership, chama, actionData) {
    switch (action) {
      case 'loan.approve':
        return this.checkLoanApprovalLimits(membership, chama, actionData);
      
      case 'payment.reverse':
        return this.checkPaymentReversalLimits(membership, chama, actionData);
      
      case 'withdrawal.approve':
        return this.checkWithdrawalLimits(membership, chama, actionData);
      
      default:
        return { allowed: true };
    }
  }

  /**
   * Check approval requirements
   */
  async checkApprovalRequirements(action, membership, chama, actionData) {
    switch (action) {
      case 'loan.approve':
        return this.checkLoanApprovalRequirements(membership, chama, actionData);
      
      case 'withdrawal.approve':
        return this.checkWithdrawalApprovalRequirements(membership, chama, actionData);
      
      default:
        return { requiredApprovals: [] };
    }
  }

  /**
   * Assess action risk
   */
  async assessRisk(action, membership, chama, actionData) {
    const riskFactors = [];

    switch (action) {
      case 'loan.approve':
        return this.assessLoanApprovalRisk(membership, chama, actionData);
      
      case 'loan.disburse':
        return this.assessLoanDisbursementRisk(membership, chama, actionData);
      
      case 'payment.reverse':
        return this.assessPaymentReversalRisk(membership, chama, actionData);
      
      case 'member.remove':
        return this.assessMemberRemovalRisk(membership, chama, actionData);
      
      default:
        return { riskLevel: 'low', riskFactors };
    }
  }

  /**
   * Generate role-aware warnings
   */
  async generateWarnings(action, membership, chama, actionData, riskAssessment) {
    const warnings = [];
    const role = membership.role;

    switch (action) {
      case 'loan.approve':
        return this.generateLoanApprovalWarnings(membership, chama, actionData, riskAssessment, role);
      
      case 'loan.disburse':
        return this.generateLoanDisbursementWarnings(membership, chama, actionData, riskAssessment, role);
      
      case 'payment.reverse':
        return this.generatePaymentReversalWarnings(membership, chama, actionData, riskAssessment, role);
      
      case 'contribution.change_amount':
        return this.generateContributionChangeWarnings(membership, chama, actionData, riskAssessment, role);
      
      default:
        return warnings;
    }
  }

  /**
   * Determine confirmation level based on risk
   */
  determineConfirmationLevel(action, riskAssessment, warnings) {
    const { riskLevel } = riskAssessment;

    switch (action) {
      case 'payment.reverse':
        if (riskLevel === 'high') return ACTION_LEVELS.HIGH_RISK;
        return ACTION_LEVELS.CRITICAL;
      
      case 'loan.approve':
      case 'loan.disburse':
      case 'withdrawal.approve':
      case 'burial.benefit.disburse':
        return ACTION_LEVELS.CRITICAL;
      
      case 'contribution.change_amount':
      case 'fine.apply':
      case 'role.change':
        return ACTION_LEVELS.WARNING;
      
      case 'member.remove':
      case 'member.suspend':
        return ACTION_LEVELS.CRITICAL;
      
      default:
        return ACTION_LEVELS.INFORMATIONAL;
    }
  }

  /**
   * Re-validate action before execution (after confirmation)
   */
  async revalidateAction({ action, membershipId, chamaId, actionData, versionToken }) {
    // Check if record has changed
    const hasChanged = await this.checkRecordChanged(action, chamaId, actionData, versionToken);
    
    if (hasChanged) {
      return {
        valid: false,
        reason: 'RECORD_CHANGED',
        message: 'The record has been modified since you opened it. Please review the changes.',
        currentData: hasChanged
      };
    }

    // Re-run full validation
    const reassessment = await this.assessActionRisk({ action, membershipId, chamaId, actionData });
    
    if (!reassessment.allowed) {
      return {
        valid: false,
        reason: 'VALIDATION_FAILED',
        message: reassessment.message || 'Action is no longer valid'
      };
    }

    return { valid: true };
  }

  // ========================================
  // ACTION-SPECIFIC VALIDATIONS
  // ========================================

  async checkLoanApprovalPolicy(membership, chama, actionData) {
    const loan = await ChamaLoan.findById(actionData.loanId);
    if (!loan) {
      return { allowed: false, reason: 'LOAN_NOT_FOUND', message: 'Loan not found' };
    }

    if (loan.status !== LOAN_STATUS.PENDING_APPROVAL) {
      return { allowed: false, reason: 'INVALID_LOAN_STATUS', message: `Loan is ${loan.status}, cannot approve` };
    }

    // Self-approval prevention
    if (String(loan.membership_id) === String(membership._id)) {
      return { allowed: false, reason: 'SELF_APPROVAL', message: 'You cannot approve your own loan' };
    }

    return { allowed: true };
  }

  async checkLoanApprovalLimits(membership, chama, actionData) {
    const loan = await ChamaLoan.findById(actionData.loanId);
    
    // Check against chama financial limits
    if (chama.max_loan_amount && loan.amount > chama.max_loan_amount) {
      return {
        allowed: false,
        reason: 'EXCEEDS_MAX_LOAN',
        message: `Loan amount exceeds chama maximum of KSh ${chama.max_loan_amount}`
      };
    }

    return { allowed: true };
  }

  async assessLoanApprovalRisk(membership, chama, actionData) {
    const riskFactors = [];
    const loan = await ChamaLoan.findById(actionData.loanId);
    
    // Check outstanding loans
    const outstandingLoans = await ChamaLoan.find({
      membership_id: loan.membership_id,
      status: { $in: [LOAN_STATUS.ACTIVE, LOAN_STATUS.PARTIALLY_REPAID] }
    });

    if (outstandingLoans.length > 0) {
      riskFactors.push({
        type: 'OUTSTANDING_LOAN',
        message: 'Member has outstanding loans',
        severity: 'medium'
      });
    }

    // Check contribution balance
    const contributionBalance = await this.getMemberContributionBalance(loan.membership_id, chama._id);
    if (contributionBalance < loan.amount * 0.5) {
      riskFactors.push({
        type: 'LOW_CONTRIBUTION_BALANCE',
        message: 'Member contribution balance is low relative to loan amount',
        severity: 'medium'
      });
    }

    const riskLevel = riskFactors.length >= 2 ? 'high' : riskFactors.length === 1 ? 'medium' : 'low';

    return { riskLevel, riskFactors };
  }

  async generateLoanApprovalWarnings(membership, chama, actionData, riskAssessment, role) {
    const warnings = [];
    const loan = await ChamaLoan.findById(actionData.loanId);

    // Role-specific warnings
    if (role === 'chairperson') {
      if (loan.amount > 50000) {
        warnings.push({
          type: 'COMMITTEE_APPROVAL_REQUIRED',
          message: 'This loan exceeds KSh 50,000 and requires committee approval',
          severity: 'high'
        });
      }
    }

    if (role === 'treasurer') {
      const chamaBalance = await this.getChamaBalance(chama._id);
      if (chamaBalance < loan.amount) {
        warnings.push({
          type: 'INSUFFICIENT_FUNDS',
          message: 'Chama balance may be insufficient for this disbursement',
          severity: 'high'
        });
      }
    }

    if (role === 'auditor') {
      const outstandingLoans = await ChamaLoan.find({
        membership_id: loan.membership_id,
        status: { $in: [LOAN_STATUS.ACTIVE, LOAN_STATUS.PARTIALLY_REPAID] }
      });

      if (outstandingLoans.length > 0) {
        warnings.push({
          type: 'MULTIPLE_OUTSTANDING_LOANS',
          message: 'Member has multiple outstanding loans',
          severity: 'medium'
        });
      }
    }

    // Add risk factor warnings
    riskAssessment.riskFactors.forEach(factor => {
      warnings.push({
        type: factor.type,
        message: factor.message,
        severity: factor.severity
      });
    });

    return warnings;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  getActionPermissionKey(action) {
    const permissionMap = {
      'loan.approve': 'loan.approve',
      'loan.reject': 'loan.reject',
      'loan.disburse': 'loan.disburse',
      'payment.reverse': 'payment.reverse',
      'member.remove': 'member.remove',
      'member.suspend': 'member.suspend',
      'role.change': 'role.change',
      'contribution.change_amount': 'contribution.change_amount',
      'withdrawal.approve': 'withdrawal.approve'
    };

    return permissionMap[action] || action;
  }

  getRequiredRolesForAction(action) {
    const roleMap = {
      'loan.approve': ['chairperson', 'treasurer', 'committee_member'],
      'loan.reject': ['chairperson', 'treasurer', 'committee_member'],
      'loan.disburse': ['treasurer'],
      'payment.reverse': ['treasurer', 'auditor'],
      'member.remove': ['chairperson', 'secretary'],
      'member.suspend': ['chairperson', 'secretary'],
      'role.change': ['chairperson'],
      'contribution.change_amount': ['chairperson', 'treasurer'],
      'withdrawal.approve': ['treasurer', 'chairperson']
    };

    return roleMap[action] || [];
  }

  async getMemberContributionBalance(membershipId, chamaId) {
    // Implementation would calculate member's contribution balance
    return 0;
  }

  async getChamaBalance(chamaId) {
    // Implementation would get chama's current balance
    return 0;
  }

  async checkRecordChanged(action, chamaId, actionData, versionToken) {
    // Implementation would check if record has changed using version token
    return false;
  }

  // Placeholder methods for other action validations
  async checkLoanDisbursementPolicy() { return { allowed: true }; }
  async checkPaymentReversalPolicy() { return { allowed: true }; }
  async checkMemberRemovalPolicy() { return { allowed: true }; }
  async checkContributionChangePolicy() { return { allowed: true }; }
  async checkLoanDisbursementLimits() { return { allowed: true }; }
  async checkPaymentReversalLimits() { return { allowed: true }; }
  async checkWithdrawalLimits() { return { allowed: true }; }
  async checkLoanApprovalRequirements() { return { requiredApprovals: [] }; }
  async checkWithdrawalApprovalRequirements() { return { requiredApprovals: [] }; }
  async assessLoanDisbursementRisk() { return { riskLevel: 'low', riskFactors: [] }; }
  async assessPaymentReversalRisk() { return { riskLevel: 'high', riskFactors: [] }; }
  async assessMemberRemovalRisk() { return { riskLevel: 'medium', riskFactors: [] }; }
  async generateLoanDisbursementWarnings() { return []; }
  async generatePaymentReversalWarnings() { return []; }
  async generateContributionChangeWarnings() { return []; }
}

export default new ActionSafetyEngine();
export { ACTION_LEVELS, ACTION_CATEGORIES };