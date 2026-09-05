import notificationService from './notification.service.js';
import {
  TOAST_TEMPLATES
} from '../constants/notification.constants.js';

// ========================================
// TOAST NOTIFICATION SERVICE
// ========================================
//
// Service for managing toast notifications
// (ephemeral, instant feedback notifications)
//
// ========================================

class ToastNotificationService {
  /**
   * Send toast notification to user
   */
  async sendToast({
    recipientMembershipId,
    toastType,
    messageData = {},
    duration = 3000
  }) {
    try {
      const toastTemplate = TOAST_TEMPLATES[toastType];
      if (!toastTemplate) {
        throw new Error(`Unknown toast type: ${toastType}`);
      }

      // Generate message (could be function or string)
      const message = typeof toastTemplate.message === 'function' 
        ? toastTemplate.message(messageData) 
        : toastTemplate.message;

      // Send toast via notification service
      await notificationService.sendToastNotification({
        recipientMembershipId,
        toastType,
        messageData,
        duration
      });

      return {
        success: true,
        icon: toastTemplate.icon,
        message,
        duration
      };

    } catch (error) {
      console.error('Send toast notification error:', error);
      throw new Error(`Failed to send toast notification: ${error.message}`);
    }
  }

  /**
   * Send success toast
   */
  async sendSuccess(recipientMembershipId, message, duration = 3000) {
    await notificationService.sendToastNotification({
      recipientMembershipId,
      toastType: 'SUCCESS',
      messageData: { message },
      duration
    });
  }

  /**
   * Send error toast
   */
  async sendError(recipientMembershipId, message, duration = 5000) {
    await notificationService.sendToastNotification({
      recipientMembershipId,
      toastType: 'ERROR',
      messageData: { message },
      duration
    });
  }

  /**
   * Send warning toast
   */
  async sendWarning(recipientMembershipId, message, duration = 4000) {
    await notificationService.sendToastNotification({
      recipientMembershipId,
      toastType: 'WARNING',
      messageData: { message },
      duration
    });
  }

  /**
   * Send info toast
   */
  async sendInfo(recipientMembershipId, message, duration = 3000) {
    await notificationService.sendToastNotification({
      recipientMembershipId,
      toastType: 'INFO',
      messageData: { message },
      duration
    });
  }

  /**
   * Get toast template
   */
  getToastTemplate(toastType) {
    return TOAST_TEMPLATES[toastType] || null;
  }

  /**
   * List available toast templates
   */
  listToastTemplates() {
    return Object.keys(TOAST_TEMPLATES);
  }
}

export default new ToastNotificationService();