import notificationService from './notification.service.js';
import {
  CONFIRMATION_TEMPLATES
} from '../constants/notification.constants.js';

// ========================================
// CONFIRMATION DIALOG SERVICE
// ========================================
//
// Service for managing confirmation dialogs
// for sensitive actions in ChamaManager
//
// ========================================

class ConfirmationDialogService {
  /**
   * Get confirmation dialog template
   */
  getConfirmationTemplate(templateType) {
    const template = CONFIRMATION_TEMPLATES[templateType];
    if (!template) {
      throw new Error(`Unknown confirmation template: ${templateType}`);
    }

    return template;
  }

  /**
   * Generate confirmation dialog with data
   */
  generateConfirmationDialog(templateType, data = {}) {
    const template = this.getConfirmationTemplate(templateType);

    return {
      title: template.title,
      message: typeof template.message === 'function' 
        ? template.message(data) 
        : template.message,
      confirmText: template.confirmText,
      cancelText: template.cancelText,
      severity: template.severity,
      data
    };
  }

  /**
   * Validate confirmation response
   */
  validateConfirmationResponse(templateType, data) {
    const template = this.getConfirmationTemplate(templateType);

    // Add template-specific validation
    switch (templateType) {
      case 'LOAN_APPROVAL':
        if (!data.amount || !data.memberName) {
          throw new Error('Missing required loan approval data');
        }
        break;

      case 'LOAN_REJECTION':
        if (!data.amount || !data.memberName) {
          throw new Error('Missing required loan rejection data');
        }
        break;

      case 'MEMBER_REMOVAL':
        if (!data.memberName || !data.role) {
          throw new Error('Missing required member removal data');
        }
        break;

      case 'ROLE_CHANGE':
        if (!data.memberName || !data.currentRole || !data.newRole) {
          throw new Error('Missing required role change data');
        }
        break;

      case 'WITHDRAWAL_APPROVAL':
        if (!data.amount || !data.memberName) {
          throw new Error('Missing required withdrawal approval data');
        }
        break;

      case 'EXPENSE_APPROVAL':
        if (!data.amount || !data.category) {
          throw new Error('Missing required expense approval data');
        }
        break;

      default:
        // No specific validation
        break;
    }

    return true;
  }

  /**
   * List available confirmation templates
   */
  listConfirmationTemplates() {
    return Object.keys(CONFIRMATION_TEMPLATES);
  }

  /**
   * Get all confirmation templates
   */
  getAllConfirmationTemplates() {
    return CONFIRMATION_TEMPLATES;
  }
}

export default new ConfirmationDialogService();