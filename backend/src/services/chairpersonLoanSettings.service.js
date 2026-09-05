import ChairpersonLoanSettings from '../models/ChairpersonLoanSettings.js';
import ChamaLoanPolicy from '../models/ChamaLoanPolicy.js';
import ChamaLoan from '../models/ChamaLoan.js';
import ChamaMembership from '../models/ChamaMembership.js';
import permissionService from './permission.service.js';
import PermissionAuditLog from '../models/PermissionAuditLog.js';

class ChairpersonLoanSettingsService {
  /**
   * Get chairperson loan settings for a chama
   */
  async getSettings(chamaId, actorMembershipId) {
    try {
      // Verify permission
      const hasPermission = await permissionService.hasPermission(
        actorMembershipId,
        'settings.view',
        { type: 'chairperson_loan_settings', id: chamaId }
      );

      if (!hasPermission.granted) {
        throw new Error('You do not have permission to view loan settings');
      }

      let settings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });

      // Initialize default settings if none exist
      if (!settings) {
        settings = await this.initializeDefaultSettings(chamaId, actorMembershipId);
      }

      return settings;
    } catch (error) {
      console.error('Get chairperson loan settings error:', error);
      throw new Error(`Failed to get loan settings: ${error.message}`);
    }
  }

  /**
   * Initialize default settings for a new chama
   */
  async initializeDefaultSettings(chamaId, actorMembershipId) {
    try {
      const settings = await ChairpersonLoanSettings.create({
        chama_id: chamaId,
        created_by: actorMembershipId,
        last_modified_by: actorMembershipId
      });

      await this.logSettingsChange({
        chamaId,
        actorMembershipId,
        action: 'SETTINGS_INITIALIZED',
        previousSettings: null,
        newSettings: settings.toObject(),
        reason: 'Default settings initialization'
      });

      return settings;
    } catch (error) {
      console.error('Initialize default settings error:', error);
      throw new Error(`Failed to initialize default settings: ${error.message}`);
    }
  }

  /**
   * Update chairperson loan settings
   */
  async updateSettings(chamaId, actorMembershipId, updates, changeReason = '') {
    try {
      // Verify permission
      const hasPermission = await permissionService.hasPermission(
        actorMembershipId,
        'settings.manage',
        { type: 'chairperson_loan_settings', id: chamaId }
      );

      if (!hasPermission.granted) {
        throw new Error('You do not have permission to update loan settings');
      }

      // Get current settings
      const currentSettings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });
      if (!currentSettings) {
        throw new Error('Settings not found. Initialize settings first.');
      }

      // Get actor membership for role information
      const actorMembership = await ChamaMembership.findById(actorMembershipId);
      if (!actorMembership) {
        throw new Error('Actor membership not found');
      }

      // Check if settings change requires approval
      if (currentSettings.security_settings.settings_change_requires_approval) {
        const approvalRequired = await this.checkIfApprovalRequired(
          currentSettings,
          updates,
          actorMembership.role
        );

        if (approvalRequired.required) {
          return await this.createSettingsChangeRequest(
            chamaId,
            actorMembershipId,
            currentSettings,
            updates,
            changeReason,
            approvalRequired.reason
          );
        }
      }

      // Check for large changes that require audit
      if (currentSettings.security_settings.require_audit_for_large_changes) {
        const largeChange = await this.checkForLargeChange(
          currentSettings,
          updates,
          currentSettings.security_settings.large_change_threshold
        );

        if (largeChange.isLarge) {
          await this.logLargeChangeWarning({
            chamaId,
            actorMembershipId,
            currentSettings,
            updates,
            largeChange
          });
        }
      }

      // Store previous settings for audit trail
      const previousSettings = currentSettings.toObject();

      // Apply updates
      Object.keys(updates).forEach(key => {
        if (currentSettings[key] !== undefined) {
          currentSettings[key] = updates[key];
        }
      });

      // Add to history
      currentSettings.addToHistory({
        changed_by: actorMembershipId,
        changed_by_role: actorMembership.role,
        previous_settings: previousSettings,
        new_settings: currentSettings.toObject(),
        change_reason: changeReason,
        ip_address: null, // Would be set from request
        user_agent: null // Would be set from request
      });

      await currentSettings.save();

      // Sync with ChamaLoanPolicy if needed
      await this.syncWithLoanPolicy(chamaId, currentSettings);

      // Log the change
      await this.logSettingsChange({
        chamaId,
        actorMembershipId,
        action: 'SETTINGS_UPDATED',
        previousSettings,
        newSettings: currentSettings.toObject(),
        reason: changeReason
      });

      return currentSettings;
    } catch (error) {
      console.error('Update chairperson loan settings error:', error);
      throw new Error(`Failed to update loan settings: ${error.message}`);
    }
  }

  /**
   * Check if settings change requires approval
   */
  async checkIfApprovalRequired(currentSettings, updates, actorRole) {
    const sensitiveFields = [
      'interest_rate_settings',
      'max_loan_settings',
      'penalty_settings',
      'approval_workflow'
    ];

    const hasSensitiveChanges = sensitiveFields.some(field => 
      updates[field] !== undefined
    );

    if (!hasSensitiveChanges) {
      return { required: false };
    }

    // Check if actor role is in the approval requirement list
    const requiresApproval = currentSettings.security_settings.settings_change_requires_approval;
    const approvalRoles = currentSettings.security_settings.settings_change_approval_roles;

    if (requiresApproval && approvalRoles.length > 0) {
      // Chairperson always needs approval for sensitive changes
      if (actorRole === 'chairperson') {
        return { 
          required: true, 
          reason: 'Chairperson requires approval for sensitive setting changes' 
        };
      }

      // Other roles need approval if they're not in the approval list
      if (!approvalRoles.includes(actorRole)) {
        return { 
          required: true, 
          reason: `${actorRole} requires approval for sensitive setting changes` 
        };
      }
    }

    return { required: false };
  }

  /**
   * Check for large changes that require audit
   */
  async checkForLargeChange(currentSettings, updates, threshold) {
    const largeChangeIndicators = [
      {
        field: 'interest_rate_settings.rate_percent',
        threshold: 5, // 5% change
        check: (prev, curr) => Math.abs(curr - prev) > 5
      },
      {
        field: 'max_loan_settings.multiplier',
        threshold: 2, // 2x multiplier change
        check: (prev, curr) => Math.abs(curr - prev) > 2
      },
      {
        field: 'max_loan_settings.absolute_limit',
        threshold: threshold,
        check: (prev, curr) => Math.abs(curr - prev) > threshold
      }
    ];

    for (const indicator of largeChangeIndicators) {
      const prevValue = this.getNestedValue(currentSettings, indicator.field);
      const currValue = this.getNestedValue(updates, indicator.field);

      if (prevValue !== undefined && currValue !== undefined) {
        if (indicator.check(prevValue, currValue)) {
          return {
            isLarge: true,
            field: indicator.field,
            previousValue: prevValue,
            newValue: currValue,
            threshold: indicator.threshold
          };
        }
      }
    }

    return { isLarge: false };
  }

  /**
   * Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, prop) => current && current[prop], obj);
  }

  /**
   * Log large change warning
   */
  async logLargeChangeWarning({ chamaId, actorMembershipId, currentSettings, updates, largeChange }) {
    try {
      const membership = await ChamaMembership.findById(actorMembershipId);

      await PermissionAuditLog.create({
        chama_id: chamaId,
        actor_membership_id: actorMembershipId,
        actor_role: membership?.role || 'unknown',
        action: 'settings_change_large_change_warning',
        target_type: 'chairperson_loan_settings',
        target_id: currentSettings._id,
        target_description: 'Large change warning',
        before_state: currentSettings.toObject(),
        after_state: updates,
        reason: `Large change detected in ${largeChange.field}: ${largeChange.previousValue} → ${largeChange.newValue} (threshold: ${largeChange.threshold})`
      });
    } catch (error) {
      console.error('Log large change warning error:', error);
    }
  }

  /**
   * Create settings change request (for approval workflow)
   */
  async createSettingsChangeRequest(chamaId, actorMembershipId, currentSettings, updates, changeReason, approvalReason) {
    // This would integrate with the approval workflow system
    // For now, return a placeholder response
    return {
      requiresApproval: true,
      reason: approvalReason,
      message: 'Settings change requires approval from authorized roles',
      currentSettings,
      requestedChanges: updates
    };
  }

  /**
   * Sync chairperson settings with ChamaLoanPolicy
   */
  async syncWithLoanPolicy(chamaId, chairpersonSettings) {
    try {
      let loanPolicy = await ChamaLoanPolicy.findOne({ chama_id: chamaId });

      if (!loanPolicy) {
        // Create new loan policy from chairperson settings
        loanPolicy = await ChamaLoanPolicy.create({
          chama_id: chamaId,
          loan_multiplier: chairpersonSettings.max_loan_settings.multiplier,
          interest_rate_percent: chairpersonSettings.interest_rate_settings.rate_percent,
          interest_type: chairpersonSettings.interest_rate_settings.rate_type,
          min_membership_months: chairpersonSettings.eligibility_settings.min_membership_months,
          max_active_loans_per_member: chairpersonSettings.eligibility_settings.max_active_loans,
          allowed_repayment_periods_months: chairpersonSettings.repayment_settings.allowed_periods_months,
          allowed_repayment_frequencies: [chairpersonSettings.repayment_settings.repayment_frequency],
          grace_period_days: chairpersonSettings.penalty_settings.grace_period_days,
          default_after_days: chairpersonSettings.penalty_settings.max_penalty_days,
          penalty_type: chairpersonSettings.penalty_settings.penalty_type === 'percentage_of_due' ? 'percentage_of_due' : 'flat_per_week',
          penalty_amount: chairpersonSettings.penalty_settings.penalty_type === 'percentage_of_due' 
            ? chairpersonSettings.penalty_settings.penalty_percentage 
            : chairpersonSettings.penalty_settings.penalty_amount,
          guarantor_capacity_ratio: chairpersonSettings.guarantor_settings.guarantor_capacity_ratio,
          allow_guarantor_recovery: true,
          min_guarantors_required: chairpersonSettings.guarantor_settings.min_guarantors_required,
          approval_matrix: this.buildApprovalMatrix(chairpersonSettings),
          recusal_quorum_size: 2,
          emergency_loan_enabled: chairpersonSettings.isLoanTypeEnabled('emergency'),
          emergency_loan_limit: chairpersonSettings.getLoanTypeConfig('emergency')?.max_amount || 5000,
          emergency_loan_approval_roles: ['treasurer'],
          topup_enabled: true,
          group_loans_enabled: true
        });
      } else {
        // Update existing loan policy
        loanPolicy.loan_multiplier = chairpersonSettings.max_loan_settings.multiplier;
        loanPolicy.interest_rate_percent = chairpersonSettings.interest_rate_settings.rate_percent;
        loanPolicy.interest_type = chairpersonSettings.interest_rate_settings.rate_type;
        loanPolicy.min_membership_months = chairpersonSettings.eligibility_settings.min_membership_months;
        loanPolicy.max_active_loans_per_member = chairpersonSettings.eligibility_settings.max_active_loans;
        loanPolicy.allowed_repayment_periods_months = chairpersonSettings.repayment_settings.allowed_periods_months;
        loanPolicy.allowed_repayment_frequencies = [chairpersonSettings.repayment_settings.repayment_frequency];
        loanPolicy.grace_period_days = chairpersonSettings.penalty_settings.grace_period_days;
        loanPolicy.default_after_days = chairpersonSettings.penalty_settings.max_penalty_days;
        loanPolicy.penalty_type = chairpersonSettings.penalty_settings.penalty_type === 'percentage_of_due' ? 'percentage_of_due' : 'flat_per_week';
        loanPolicy.penalty_amount = chairpersonSettings.penalty_settings.penalty_type === 'percentage_of_due' 
          ? chairpersonSettings.penalty_settings.penalty_percentage 
          : chairpersonSettings.penalty_settings.penalty_amount;
        loanPolicy.guarantor_capacity_ratio = chairpersonSettings.guarantor_settings.guarantor_capacity_ratio;
        loanPolicy.min_guarantors_required = chairpersonSettings.guarantor_settings.min_guarantors_required;
        loanPolicy.approval_matrix = this.buildApprovalMatrix(chairpersonSettings);
        loanPolicy.emergency_loan_enabled = chairpersonSettings.isLoanTypeEnabled('emergency');
        loanPolicy.emergency_loan_limit = chairpersonSettings.getLoanTypeConfig('emergency')?.max_amount || 5000;

        await loanPolicy.save();
      }

      return loanPolicy;
    } catch (error) {
      console.error('Sync with loan policy error:', error);
      // Don't throw - this is a secondary operation
    }
  }

  /**
   * Build approval matrix from chairperson settings
   */
  buildApprovalMatrix(chairpersonSettings) {
    const workflow = chairpersonSettings.approval_workflow;
    const autoApprovalLimit = workflow.auto_approval_enabled ? workflow.auto_approval_limit : 0;

    const matrix = [];

    // Auto-approval tier
    if (autoApprovalLimit > 0) {
      matrix.push({
        max_amount: autoApprovalLimit,
        required_roles: ['treasurer'] // Auto-approved by system, treasurer notified
      });
    }

    // Main approval tier based on workflow type
    let requiredRoles = ['chairperson', 'treasurer'];
    switch (workflow.workflow_type) {
      case 'chair_only':
        requiredRoles = ['chairperson'];
        break;
      case 'chair_treasurer':
        requiredRoles = ['chairperson', 'treasurer'];
        break;
      case 'chair_treasurer_secretary':
        requiredRoles = ['chairperson', 'treasurer', 'secretary'];
        break;
      case 'committee_vote':
        requiredRoles = ['committee_member'];
        break;
    }

    matrix.push({
      max_amount: null, // No upper limit
      required_roles: requiredRoles
    });

    return matrix;
  }

  /**
   * Check if chairperson can approve a specific loan
   */
  async canApproveLoan(chamaId, chairpersonMembershipId, loanId) {
    try {
      const settings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });
      if (!settings) {
        throw new Error('Settings not found');
      }

      // Check security restriction
      if (settings.security_settings.prevent_self_approval) {
        const loan = await ChamaLoan.findById(loanId);
        if (!loan) {
          throw new Error('Loan not found');
        }

        // Check if chairperson is the loan applicant
        if (String(loan.membership_id) === String(chairpersonMembershipId)) {
          return {
            canApprove: false,
            reason: 'Chairperson cannot approve their own loan due to security restrictions'
          };
        }
      }

      // Check if chairperson role is in the required approval roles
      const workflow = settings.approval_workflow;
      const chairpersonInWorkflow = ['chair_only', 'chair_treasurer', 'chair_treasurer_secretary'].includes(workflow.workflow_type);

      if (!chairpersonInWorkflow) {
        return {
          canApprove: false,
          reason: 'Chairperson approval is not required in the current workflow configuration'
        };
      }

      return { canApprove: true };
    } catch (error) {
      console.error('Check can approve loan error:', error);
      throw new Error(`Failed to check approval eligibility: ${error.message}`);
    }
  }

  /**
   * Check if settings can be changed (no active loans affected)
   */
  async canChangeSettings(chamaId, settingType, newValue) {
    try {
      const settings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });
      if (!settings) {
        return { canChange: true };
      }

      // Check for security restrictions
      if (settingType === 'interest_rate' && settings.security_settings.prevent_interest_change_after_disbursement) {
        // Check if there are active loans
        const activeLoans = await ChamaLoan.countDocuments({
          chama_id: chamaId,
          status: { $in: ['active', 'partially_repaid', 'overdue'] }
        });

        if (activeLoans > 0) {
          return {
            canChange: false,
            reason: `Cannot change interest rate while ${activeLoans} active loans exist. Security restriction prevents interest changes after disbursement.`
          };
        }
      }

      return { canChange: true };
    } catch (error) {
      console.error('Check can change settings error:', error);
      throw new Error(`Failed to check if settings can be changed: ${error.message}`);
    }
  }

  /**
   * Get settings change history
   */
  async getSettingsHistory(chamaId, actorMembershipId) {
    try {
      // Verify permission
      const hasPermission = await permissionService.hasPermission(
        actorMembershipId,
        'audit.view',
        { type: 'chairperson_loan_settings', id: chamaId }
      );

      if (!hasPermission.granted) {
        throw new Error('You do not have permission to view settings history');
      }

      const settings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });
      if (!settings) {
        throw new Error('Settings not found');
      }

      return settings.settings_history.sort({ changed_at: -1 });
    } catch (error) {
      console.error('Get settings history error:', error);
      throw new Error(`Failed to get settings history: ${error.message}`);
    }
  }

  /**
   * Log settings change for audit
   */
  async logSettingsChange({ chamaId, actorMembershipId, action, previousSettings, newSettings, reason }) {
    try {
      const membership = await ChamaMembership.findById(actorMembershipId);

      await PermissionAuditLog.create({
        chama_id: chamaId,
        actor_membership_id: actorMembershipId,
        actor_role: membership?.role || 'unknown',
        action: action,
        target_type: 'chairperson_loan_settings',
        target_id: newSettings._id,
        target_description: 'Chairperson loan settings',
        before_state: previousSettings,
        after_state: newSettings,
        reason: reason
      });
    } catch (error) {
      console.error('Log settings change error:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(chamaId, actorMembershipId, reason = '') {
    try {
      // Verify permission
      const hasPermission = await permissionService.hasPermission(
        actorMembershipId,
        'settings.manage',
        { type: 'chairperson_loan_settings', id: chamaId }
      );

      if (!hasPermission.granted) {
        throw new Error('You do not have permission to reset loan settings');
      }

      const currentSettings = await ChairpersonLoanSettings.findOne({ chama_id: chamaId });
      if (!currentSettings) {
        throw new Error('Settings not found');
      }

      const previousSettings = currentSettings.toObject();

      // Delete current settings
      await ChairpersonLoanSettings.deleteOne({ chama_id: chamaId });

      // Initialize new default settings
      const newSettings = await this.initializeDefaultSettings(chamaId, actorMembershipId);

      // Log the reset
      await this.logSettingsChange({
        chamaId,
        actorMembershipId,
        action: 'SETTINGS_RESET',
        previousSettings,
        newSettings: newSettings.toObject(),
        reason: reason || 'Settings reset to defaults'
      });

      return newSettings;
    } catch (error) {
      console.error('Reset settings error:', error);
      throw new Error(`Failed to reset settings: ${error.message}`);
    }
  }
}

export default new ChairpersonLoanSettingsService();