import actionSafetyEngine from './actionSafety.service.js';
import { ACTION_LEVELS } from './actionSafety.service.js';

// ========================================
// CONFIRMATION DIALOG SERVICE
// ========================================
//
// Generates confirmation dialogs based on action risk level
// and role-aware warnings from the Action Safety Engine
//
// ========================================

class ConfirmationDialogService {
  /**
   * Generate confirmation dialog for an action
   */
  async generateConfirmationDialog({ action, membershipId, chamaId, actionData }) {
    // Assess action risk
    const riskAssessment = await actionSafetyEngine.assessActionRisk({
      action,
      membershipId,
      chamaId,
      actionData
    });

    if (!riskAssessment.allowed) {
      return {
        allowed: false,
        error: riskAssessment.reason,
        message: riskAssessment.message
      };
    }

    // Generate dialog based on confirmation level
    const dialog = this.buildDialog(action, riskAssessment, actionData);

    return {
      allowed: true,
      dialog,
      riskAssessment
    };
  }

  /**
   * Build confirmation dialog based on risk level
   */
  buildDialog(action, riskAssessment, actionData) {
    const { confirmationLevel, warnings, riskFactors } = riskAssessment;

    switch (confirmationLevel) {
      case ACTION_LEVELS.INFORMATIONAL:
        return this.buildInformationalDialog(action, actionData);
      
      case ACTION_LEVELS.WARNING:
        return this.buildWarningDialog(action, actionData, warnings);
      
      case ACTION_LEVELS.CRITICAL:
        return this.buildCriticalDialog(action, actionData, warnings, riskFactors);
      
      case ACTION_LEVELS.HIGH_RISK:
        return this.buildHighRiskDialog(action, actionData, warnings, riskFactors);
      
      default:
        return this.buildInformationalDialog(action, actionData);
    }
  }

  /**
   * Build informational dialog (no confirmation needed)
   */
  buildInformationalDialog(action, actionData) {
    return {
      type: 'informational',
      title: this.getActionTitle(action),
      message: this.getActionMessage(action, actionData),
      showConfirmation: false,
      autoProceed: true
    };
  }

  /**
   * Build warning dialog (one confirmation)
   */
  buildWarningDialog(action, actionData, warnings) {
    return {
      type: 'warning',
      icon: '⚠️',
      title: this.getActionTitle(action),
      message: this.getActionMessage(action, actionData),
      warnings: warnings.map(w => w.message),
      showConfirmation: true,
      confirmText: 'Continue',
      cancelText: 'Cancel',
      severity: 'warning'
    };
  }

  /**
   * Build critical dialog (deliberate re-confirmation)
   */
  buildCriticalDialog(action, actionData, warnings, riskFactors) {
    const details = this.getActionDetails(action, actionData);
    
    return {
      type: 'critical',
      icon: '⚠️',
      title: this.getActionTitle(action),
      message: this.getCriticalMessage(action, actionData),
      details,
      warnings: warnings.map(w => ({ type: w.type, message: w.message, severity: w.severity })),
      riskFactors: riskFactors.map(r => ({ type: r.type, message: r.message, severity: r.severity })),
      showConfirmation: true,
      confirmText: this.getConfirmText(action),
      cancelText: 'Cancel',
      severity: 'critical',
      requiresExplicitConfirmation: true
    };
  }

  /**
   * Build high-risk dialog (step-up confirmation)
   */
  buildHighRiskDialog(action, actionData, warnings, riskFactors) {
    const details = this.getActionDetails(action, actionData);
    
    return {
      type: 'high_risk',
      icon: '🚨',
      title: 'HIGH-RISK ACTION',
      message: this.getHighRiskMessage(action, actionData),
      details,
      warnings: warnings.map(w => ({ type: w.type, message: w.message, severity: w.severity })),
      riskFactors: riskFactors.map(r => ({ type: r.type, message: r.message, severity: r.severity })),
      showConfirmation: true,
      confirmText: this.getHighRiskConfirmText(action),
      cancelText: 'Cancel',
      severity: 'high_risk',
      requiresStepUpConfirmation: true,
      requiresTypeConfirmation: this.requiresTypeConfirmation(action),
      confirmationPhrase: this.getConfirmationPhrase(action)
    };
  }

  /**
   * Get action title
   */
  getActionTitle(action) {
    const titles = {
      'loan.approve': 'Confirm Loan Approval',
      'loan.reject': 'Confirm Loan Rejection',
      'loan.disburse': 'Confirm Loan Disbursement',
      'payment.reverse': 'Confirm Payment Reversal',
      'member.remove': 'Confirm Member Removal',
      'member.suspend': 'Confirm Member Suspension',
      'role.change': 'Confirm Role Change',
      'contribution.change_amount': 'Confirm Contribution Change',
      'withdrawal.approve': 'Confirm Withdrawal Approval',
      'burial.benefit.disburse': 'Confirm Benefit Disbursement',
      'fine.apply': 'Confirm Fine Application',
      'fine.waive': 'Confirm Fine Waiver'
    };

    return titles[action] || 'Confirm Action';
  }

  /**
   * Get action message
   */
  getActionMessage(action, actionData) {
    switch (action) {
      case 'contribution.change_amount':
        return `You're changing the monthly contribution from KSh ${actionData.oldAmount} → KSh ${actionData.newAmount}. This may affect upcoming member obligations.`;
      
      case 'fine.apply':
        return `You're applying a fine of KSh ${actionData.amount} to ${actionData.memberName}.`;
      
      case 'meeting.create':
        return 'You are creating a new meeting.';
      
      default:
        return 'Are you sure you want to proceed?';
    }
  }

  /**
   * Get critical message
   */
  getCriticalMessage(action, actionData) {
    switch (action) {
      case 'loan.approve':
        return `You are about to approve a loan of KSh ${actionData.amount} for ${actionData.memberName}. This will create a financial obligation and cannot be casually undone.`;
      
      case 'loan.disburse':
        return `You are about to disburse KSh ${actionData.amount} to ${actionData.memberName}. This will create a financial transaction and cannot be casually undone.`;
      
      case 'withdrawal.approve':
        return `You are about to approve a withdrawal of KSh ${actionData.amount} for ${actionData.memberName}. This will reduce the chama's available funds.`;
      
      case 'member.remove':
        return `You are about to remove ${actionData.memberName} from the chama. This action cannot be undone.`;
      
      case 'burial.benefit.disburse':
        return `You are about to disburse a burial benefit of KSh ${actionData.amount}. This will create a financial transaction.`;
      
      default:
        return 'This action will have significant consequences and cannot be casually undone.';
    }
  }

  /**
   * Get high-risk message
   */
  getHighRiskMessage(action, actionData) {
    switch (action) {
      case 'payment.reverse':
        return `You are about to reverse a payment of KSh ${actionData.amount}. This action will affect the chama ledger and will be recorded in the audit trail.`;
      
      default:
        return 'This is a high-risk action that will significantly impact the chama ledger and will be permanently recorded in the audit trail.';
    }
  }

  /**
   * Get action details for display
   */
  getActionDetails(action, actionData) {
    switch (action) {
      case 'loan.approve':
      case 'loan.disburse':
        return [
          { label: 'Member', value: actionData.memberName },
          { label: 'Amount', value: `KSh ${actionData.amount}` },
          { label: 'Loan Reference', value: actionData.loanReference }
        ];
      
      case 'payment.reverse':
        return [
          { label: 'Amount', value: `KSh ${actionData.amount}` },
          { label: 'Transaction', value: actionData.transactionId },
          { label: 'Reason', value: actionData.reason }
        ];
      
      case 'withdrawal.approve':
        return [
          { label: 'Member', value: actionData.memberName },
          { label: 'Amount', value: `KSh ${actionData.amount}` },
          { label: 'Withdrawal Reference', value: actionData.withdrawalReference }
        ];
      
      case 'member.remove':
        return [
          { label: 'Member', value: actionData.memberName },
          { label: 'Role', value: actionData.role },
          { label: 'Member Since', value: actionData.memberSince }
        ];
      
      default:
        return [];
    }
  }

  /**
   * Get confirm button text
   */
  getConfirmText(action) {
    const confirmTexts = {
      'loan.approve': 'Confirm Approval',
      'loan.reject': 'Confirm Rejection',
      'loan.disburse': 'Confirm Disbursement',
      'payment.reverse': 'Confirm Reverse',
      'member.remove': 'Confirm Removal',
      'member.suspend': 'Confirm Suspension',
      'withdrawal.approve': 'Confirm Approval',
      'burial.benefit.disburse': 'Confirm Disbursement'
    };

    return confirmTexts[action] || 'Confirm';
  }

  /**
   * Get high-risk confirm button text
   */
  getHighRiskConfirmText(action) {
    const confirmTexts = {
      'payment.reverse': 'Confirm Reverse'
    };

    return confirmTexts[action] || 'Confirm High-Risk Action';
  }

  /**
   * Check if action requires type confirmation
   */
  requiresTypeConfirmation(action) {
    const typeConfirmationActions = [
      'payment.reverse',
      'member.remove',
      'role.change'
    ];

    return typeConfirmationActions.includes(action);
  }

  /**
   * Get confirmation phrase for type confirmation
   */
  getConfirmationPhrase(action) {
    const phrases = {
      'payment.reverse': 'REVERSE',
      'member.remove': 'REMOVE',
      'role.change': 'CHANGE ROLE'
    };

    return phrases[action] || 'CONFIRM';
  }

  /**
   * Validate confirmation response
   */
  validateConfirmationResponse(action, dialog, response) {
    if (dialog.requiresStepUpConfirmation && dialog.requiresTypeConfirmation) {
      if (response.typedPhrase !== dialog.confirmationPhrase) {
        return {
          valid: false,
          reason: 'INCORRECT_PHRASE',
          message: `Please type "${dialog.confirmationPhrase}" to confirm`
        };
      }
    }

    return { valid: true };
  }

  /**
   * Re-validate action after confirmation
   */
  async revalidateAction({ action, membershipId, chamaId, actionData, versionToken }) {
    return await actionSafetyEngine.revalidateAction({
      action,
      membershipId,
      chamaId,
      actionData,
      versionToken
    });
  }

  /**
   * Get "Why am I seeing this warning?" explanation
   */
  getWarningExplanation(warningType, actionData) {
    const explanations = {
      'COMMITTEE_APPROVAL_REQUIRED': {
        title: 'Committee Approval Required',
        reasons: [
          'Loan exceeds KSh 50,000',
          'Member has an outstanding balance',
          'Two committee approvals are required',
          'Treasurer has not yet confirmed available funds'
        ],
        policyReference: 'Loan Policy Section 4.2'
      },
      
      'INSUFFICIENT_FUNDS': {
        title: 'Insufficient Chama Funds',
        reasons: [
          'Disbursement amount exceeds available chama balance',
          'Funds may be locked in other pending transactions',
          'Check upcoming contribution deposits'
        ],
        policyReference: 'Financial Policy Section 3.1'
      },
      
      'MULTIPLE_OUTSTANDING_LOANS': {
        title: 'Multiple Outstanding Loans',
        reasons: [
          'Member already has active loans',
          'Total outstanding debt exceeds contribution balance',
          'Loan policy limits multiple concurrent loans'
        ],
        policyReference: 'Loan Policy Section 2.3'
      },
      
      'OUTSTANDING_LOAN': {
        title: 'Outstanding Loan Detected',
        reasons: [
          'Member has an active loan',
          'New loan may increase debt burden',
          'Consider repayment capacity'
        ],
        policyReference: 'Loan Policy Section 2.2'
      },
      
      'LOW_CONTRIBUTION_BALANCE': {
        title: 'Low Contribution Balance',
        reasons: [
          'Member contribution balance is low',
          'Loan amount is high relative to contributions',
          'May affect loan repayment capacity'
        ],
        policyReference: 'Loan Policy Section 2.1'
      }
    };

    return explanations[warningType] || {
      title: 'Action Warning',
      reasons: ['This action requires additional review'],
      policyReference: 'Chama Policies'
    };
  }
}

export default new ConfirmationDialogService();