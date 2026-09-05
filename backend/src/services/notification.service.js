import Notification from '../models/Notification.js';
import ChamaMembership from '../models/ChamaMembership.js';
import Chama from '../models/Chama.js';
import User from '../models/User.js';
import notificationPreferenceService from './notificationPreference.service.js';
import domainEventEmitter from './domainEvent.emitter.js';
import {
  sendRealTimeNotification,
  sendToastToUser
} from '../modules/realtime/socketServer.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATES,
  ROLE_NOTIFICATION_RULES,
  DOMAIN_EVENTS,
  TOAST_TEMPLATES,
  CONFIRMATION_TEMPLATES
} from '../constants/notification.constants.js';

// ========================================
// NOTIFICATION SERVICE
// ========================================
//
// Centralized notification service for ChamaManager
// Handles notification creation, routing, and delivery
// across all notification channels.
//
// Architecture:
// Business Logic → Domain Event → Notification Service → Delivery Channels
//
// ========================================

class NotificationService {
  /**
   * Create and send notification
   */
  async createNotification({
    chamaId,
    recipientMembershipId,
    notificationType,
    title,
    message,
    description = '',
    metadata = {},
    relatedEntityType = null,
    relatedEntityId = null,
    actionUrl = null,
    actionText = null,
    actionMethod = null,
    priority = 'normal',
    requiresAction = false,
    actionDeadline = null,
    domainEvent = null,
    eventSource = null,
    sentBy = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      // Get recipient membership details
      const membership = await ChamaMembership.findById(recipientMembershipId);
      if (!membership) {
        throw new Error('Recipient membership not found');
      }

      // Get notification type configuration
      const notificationConfig = NOTIFICATION_TYPES[notificationType];
      if (!notificationConfig) {
        throw new Error(`Unknown notification type: ${notificationType}`);
      }

      // Validate role-based routing
      if (!this.canRoleReceiveNotification(membership.role, notificationType)) {
        console.log(`Role ${membership.role} cannot receive notification type ${notificationType}`);
        return null;
      }

      // Determine delivery channels
      const channels = notificationConfig.defaultChannels || ['in-app'];

      // Create notification
      const notification = await Notification.create({
        chama_id: chamaId,
        recipient_membership_id: recipientMembershipId,
        recipient_user_id: membership.user_id,
        recipient_role: membership.role,
        notification_type: notificationType,
        category: notificationConfig.category,
        icon: notificationConfig.icon,
        title,
        message,
        description,
        metadata,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        action_url: actionUrl,
        action_text: actionText,
        action_method: actionMethod,
        state: NOTIFICATION_STATES.UNREAD,
        priority: priority || notificationConfig.priority,
        requires_action: requiresAction || notificationConfig.requiresAction,
        action_deadline: actionDeadline,
        delivery_channels: channels.map(channel => ({
          channel,
          status: 'pending'
        })),
        domain_event: domainEvent,
        event_source: eventSource,
        event_timestamp: new Date(),
        sent_by: sentBy,
        sent_by_role: sentBy ? await this.getRoleForMembership(sentBy) : null,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      // Deliver notifications through channels
      await this.deliverNotification(notification, channels);

      return notification;

    } catch (error) {
      console.error('Create notification error:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Send notification to multiple recipients
   */
  async sendBulkNotification({
    chamaId,
    recipientMembershipIds,
    notificationType,
    title,
    message,
    description = '',
    metadata = {},
    relatedEntityType = null,
    relatedEntityId = null,
    actionUrl = null,
    actionText = null,
    actionMethod = null,
    priority = 'normal',
    requiresAction = false,
    actionDeadline = null,
    domainEvent = null,
    eventSource = null,
    sentBy = null,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      const notifications = [];

      for (const recipientId of recipientMembershipIds) {
        const notification = await this.createNotification({
          chamaId,
          recipientMembershipId: recipientId,
          notificationType,
          title,
          message,
          description,
          metadata,
          relatedEntityType,
          relatedEntityId,
          actionUrl,
          actionText,
          actionMethod,
          priority,
          requiresAction,
          actionDeadline,
          domainEvent,
          eventSource,
          sentBy,
          ipAddress,
          userAgent
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;

    } catch (error) {
      console.error('Bulk notification error:', error);
      throw new Error(`Failed to send bulk notifications: ${error.message}`);
    }
  }

  /**
   * Send notification based on domain event
   */
  async sendDomainEventNotification({
    domainEvent,
    chamaId,
    eventData = {},
    eventSource = null
  }) {
    try {
      // Get recipients based on domain event and roles
      const recipients = await this.getRecipientsForDomainEvent(domainEvent, chamaId, eventData);

      if (recipients.length === 0) {
        console.log(`No recipients found for domain event ${domainEvent}`);
        return [];
      }

      // Create notification for each recipient
      const notifications = [];
      for (const recipient of recipients) {
        const notificationConfig = this.getNotificationConfigForDomainEvent(domainEvent);
        
        const notification = await this.createNotification({
          chamaId,
          recipientMembershipId: recipient.membershipId,
          notificationType: notificationConfig.type,
          title: notificationConfig.title,
          message: this.generateMessageForDomainEvent(domainEvent, eventData, recipient),
          description: notificationConfig.description || '',
          metadata: eventData,
          relatedEntityType: eventData.entityType,
          relatedEntityId: eventData.entityId,
          actionUrl: eventData.actionUrl,
          actionText: eventData.actionText,
          actionMethod: eventData.actionMethod,
          priority: notificationConfig.priority,
          requiresAction: notificationConfig.requiresAction,
          actionDeadline: eventData.actionDeadline,
          domainEvent,
          eventSource,
          sentBy: eventData.sentBy,
          ipAddress: eventData.ipAddress,
          userAgent: eventData.userAgent
        });

        if (notification) {
          notifications.push(notification);
        }
      }

      return notifications;

    } catch (error) {
      console.error('Domain event notification error:', error);
      throw new Error(`Failed to send domain event notification: ${error.message}`);
    }
  }

  /**
   * Send toast notification (ephemeral)
   */
  async sendToastNotification({
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

      // Toast notifications are ephemeral, so we create with minimal persistence
      const membership = await ChamaMembership.findById(recipientMembershipId);
      if (!membership) {
        throw new Error('Recipient membership not found');
      }

      const notification = await Notification.create({
        chama_id: membership.chama_id,
        recipient_membership_id: recipientMembershipId,
        recipient_user_id: membership.user_id,
        recipient_role: membership.role,
        notification_type: toastType,
        category: 'system',
        icon: toastTemplate.icon,
        title: toastTemplate.message,
        message,
        metadata: messageData,
        state: NOTIFICATION_STATES.READ, // Toasts are auto-read
        priority: 'low',
        requires_action: false,
        delivery_channels: [{ channel: 'toast', status: 'sent', sent_at: new Date() }],
        expires_at: new Date(Date.now + duration), // Auto-expire after duration
        domain_event: 'TOAST_NOTIFICATION',
        event_source: 'client'
      });

      return notification;

    } catch (error) {
      console.error('Toast notification error:', error);
      throw new Error(`Failed to send toast notification: ${error.message}`);
    }
  }

  /**
   * Deliver notification through specified channels
   */
  async deliverNotification(notification, channels) {
    try {
      const deliveryPromises = [];

      for (const channel of channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.IN_APP:
            // In-app is automatically handled by database storage
            await notification.updateDeliveryStatus('in-app', 'delivered');
            // Send real-time notification via WebSocket
            await sendRealTimeNotification(notification);
            break;

          case NOTIFICATION_CHANNELS.TOAST:
            // Toast notifications are handled by client polling
            await notification.updateDeliveryStatus('toast', 'sent');
            // Send toast via WebSocket
            sendToastToUser(
              notification.recipient_user_id.toString(),
              {
                icon: notification.icon,
                title: notification.title,
                message: notification.message,
                duration: 3000
              }
            );
            break;

          case NOTIFICATION_CHANNELS.PUSH:
            // Push notifications would be handled by push service
            await this.sendPushNotification(notification);
            break;

          case NOTIFICATION_CHANNELS.SMS:
            // SMS notifications would be handled by SMS service
            await this.sendSMSNotification(notification);
            break;

          case NOTIFICATION_CHANNELS.EMAIL:
            // Email notifications would be handled by email service
            await this.sendEmailNotification(notification);
            break;

          default:
            console.warn(`Unknown notification channel: ${channel}`);
        }
      }

      await Promise.all(deliveryPromises);

    } catch (error) {
      console.error('Deliver notification error:', error);
      // Don't throw - delivery failures shouldn't break notification creation
    }
  }

  /**
   * Send push notification (placeholder for push service integration)
   */
  async sendPushNotification(notification) {
    try {
      // Placeholder for push notification service integration
      // This would integrate with Firebase Cloud Messaging, OneSignal, etc.
      
      console.log(`Push notification sent to user ${notification.recipient_user_id}: ${notification.title}`);
      
      await notification.updateDeliveryStatus('push', 'sent', {
        externalId: `push_${notification._id}_${Date.now()}`
      });

    } catch (error) {
      console.error('Push notification error:', error);
      await notification.updateDeliveryStatus('push', 'failed', { reason: error.message });
    }
  }

  /**
   * Send SMS notification (placeholder for SMS service integration)
   */
  async sendSMSNotification(notification) {
    try {
      // Placeholder for SMS service integration
      // This would integrate with M-Pesa SMS, Twilio, etc.
      
      // Only send SMS for urgent notifications
      if (notification.priority !== 'urgent' && notification.priority !== 'high') {
        await notification.updateDeliveryStatus('sms', 'failed', { reason: 'Not urgent enough for SMS' });
        return;
      }

      console.log(`SMS notification sent to user ${notification.recipient_user_id}: ${notification.title}`);
      
      await notification.updateDeliveryStatus('sms', 'sent', {
        externalId: `sms_${notification._id}_${Date.now()}`
      });

    } catch (error) {
      console.error('SMS notification error:', error);
      await notification.updateDeliveryStatus('sms', 'failed', { reason: error.message });
    }
  }

  /**
   * Send email notification (placeholder for email service integration)
   */
  async sendEmailNotification(notification) {
    try {
      // Placeholder for email service integration
      // This would integrate with SendGrid, Mailgun, etc.
      
      console.log(`Email notification sent to user ${notification.recipient_user_id}: ${notification.title}`);
      
      await notification.updateDeliveryStatus('email', 'sent', {
        externalId: `email_${notification._id}_${Date.now()}`
      });

    } catch (error) {
      console.error('Email notification error:', error);
      await notification.updateDeliveryStatus('email', 'failed', { reason: error.message });
    }
  }

  /**
   * Check if role can receive notification type
   */
  canRoleReceiveNotification(role, notificationType) {
    const roleRules = ROLE_NOTIFICATION_RULES[role];
    if (!roleRules) return false;

    return roleRules.canReceive.includes(notificationType) && 
           !roleRules.cannotReceive.includes(notificationType);
  }

  /**
   * Get recipients for domain event based on roles
   */
  async getRecipientsForDomainEvent(domainEvent, chamaId, eventData) {
    try {
      // Determine which roles should receive this event
      const targetRoles = this.getRolesForDomainEvent(domainEvent);
      
      if (targetRoles.length === 0) {
        return [];
      }

      // Get all members of target roles in the chama
      const memberships = await ChamaMembership.find({
        chama_id: chamaId,
        role: { $in: targetRoles },
        status: 'active'
      });

      // Apply additional filtering based on event data
      const recipients = memberships.filter(membership => {
        // Example: exclude the person who triggered the event
        if (eventData.excludeInitiator && String(membership._id) === String(eventData.sentBy)) {
          return false;
        }

        // Example: only notify committee members for committee events
        if (eventData.committeeType && membership.committee_assignments) {
          const inCommittee = membership.committee_assignments.some(
            ca => ca.committee_type === eventData.committeeType
          );
          if (!inCommittee && membership.role !== 'chairperson') {
            return false;
          }
        }

        return true;
      });

      return recipients.map(membership => ({
        membershipId: membership._id,
        userId: membership.user_id,
        role: membership.role
      }));

    } catch (error) {
      console.error('Get recipients error:', error);
      return [];
    }
  }

  /**
   * Get roles that should receive a domain event
   */
  getRolesForDomainEvent(domainEvent) {
    const eventRoleMapping = {
      // Financial events
      CONTRIBUTION_RECEIVED: ['treasurer', 'chairperson'],
      CONTRIBUTION_MISSED: ['member'],
      CONTRIBUTION_OVERDUE: ['member', 'treasurer'],
      LOAN_SUBMITTED: ['chairperson', 'treasurer', 'secretary'],
      LOAN_APPROVED: ['treasurer', 'member'],
      LOAN_REJECTED: ['member'],
      LOAN_DISBURSED: ['member'],
      LOAN_REPAYMENT_RECEIVED: ['treasurer', 'member'],
      LOAN_REPAYMENT_OVERDUE: ['member', 'treasurer'],
      WITHDRAWAL_REQUESTED: ['chairperson', 'treasurer'],
      WITHDRAWAL_APPROVED: ['member'],
      WITHDRAWAL_REJECTED: ['member'],
      PAYMENT_FAILED: ['treasurer', 'member'],
      PAYMENT_REVERSED: ['auditor', 'treasurer'],
      
      // Membership events
      MEMBER_JOINED: ['chairperson', 'treasurer', 'secretary'],
      MEMBER_INVITED: ['member'],
      INVITATION_ACCEPTED: ['chairperson', 'treasurer', 'secretary'],
      MEMBER_SUSPENDED: ['member', 'chairperson'],
      MEMBER_REINSTATED: ['member', 'chairperson'],
      MEMBER_REMOVED: ['member', 'chairperson'],
      ROLE_CHANGED: ['member', 'chairperson'],
      
      // Governance events
      MEETING_SCHEDULED: ['member'],
      MEETING_REMINDER: ['member'],
      MEETING_STARTED: ['member'],
      MINUTES_PUBLISHED: ['member'],
      RESOLUTION_APPROVED: ['member'],
      ELECTION_OPENED: ['member'],
      ELECTION_COMPLETED: ['member'],
      COMMITTEE_APPOINTED: ['committee_member', 'chairperson'],
      
      // Burial events
      MEMBER_DECEASED_REPORTED: ['chairperson', 'treasurer', 'committee_member'],
      BURIAL_CASE_OPENED: ['chairperson', 'treasurer', 'committee_member'],
      BENEFICIARY_CLAIM_SUBMITTED: ['chairperson', 'treasurer', 'committee_member'],
      CLAIM_APPROVED: ['beneficiary'],
      CLAIM_REJECTED: ['beneficiary'],
      BENEFIT_PAYMENT_DISBURSED: ['beneficiary'],
      BURIAL_CONTRIBUTION_REQUIRED: ['member'],
      EMERGENCY_CONTRIBUTION_OPENED: ['member'],
      
      // System events
      SECURITY_ALERT: ['chairperson', 'treasurer'],
      NEW_DEVICE_LOGIN: ['user'],
      PASSWORD_CHANGED: ['user'],
      ROLE_PERMISSION_CHANGED: ['chairperson', 'treasurer']
    };

    return eventRoleMapping[domainEvent] || [];
  }

  /**
   * Get notification configuration for domain event
   */
  getNotificationConfigForDomainEvent(domainEvent) {
    const eventMapping = {
      CONTRIBUTION_RECEIVED: NOTIFICATION_TYPES.CONTRIBUTION_RECEIVED,
      CONTRIBUTION_MISSED: NOTIFICATION_TYPES.CONTRIBUTION_MISSED,
      CONTRIBUTION_OVERDUE: NOTIFICATION_TYPES.CONTRIBUTION_OVERDUE,
      LOAN_SUBMITTED: NOTIFICATION_TYPES.LOAN_SUBMITTED,
      LOAN_APPROVED: NOTIFICATION_TYPES.LOAN_APPROVED,
      LOAN_REJECTED: NOTIFICATION_TYPES.LOAN_REJECTED,
      LOAN_DISBURSED: NOTIFICATION_TYPES.LOAN_DISBURSED,
      LOAN_REPAYMENT_RECEIVED: NOTIFICATION_TYPES.LOAN_REPAYMENT_RECEIVED,
      LOAN_REPAYMENT_OVERDUE: NOTIFICATION_TYPES.LOAN_REPAYMENT_OVERDUE,
      WITHDRAWAL_REQUESTED: NOTIFICATION_TYPES.WITHDRAWAL_REQUESTED,
      WITHDRAWAL_APPROVED: NOTIFICATION_TYPES.WITHDRAWAL_APPROVED,
      WITHDRAWAL_REJECTED: NOTIFICATION_TYPES.WITHDRAWAL_REJECTED,
      PAYMENT_FAILED: NOTIFICATION_TYPES.PAYMENT_FAILED,
      PAYMENT_REVERSED: NOTIFICATION_TYPES.PAYMENT_REVERSED,
      MEMBER_JOINED: NOTIFICATION_TYPES.MEMBER_JOINED,
      MEMBER_INVITED: NOTIFICATION_TYPES.MEMBER_INVITED,
      INVITATION_ACCEPTED: NOTIFICATION_TYPES.INVITATION_ACCEPTED,
      MEMBER_SUSPENDED: NOTIFICATION_TYPES.MEMBER_SUSPENDED,
      MEMBER_REINSTATED: NOTIFICATION_TYPES.MEMBER_REINSTATED,
      MEMBER_REMOVED: NOTIFICATION_TYPES.MEMBER_REMOVED,
      ROLE_CHANGED: NOTIFICATION_TYPES.ROLE_CHANGED,
      MEETING_SCHEDULED: NOTIFICATION_TYPES.MEETING_SCHEDULED,
      MEETING_REMINDER: NOTIFICATION_TYPES.MEETING_REMINDER,
      MEETING_STARTED: NOTIFICATION_TYPES.MEETING_STARTED,
      MINUTES_PUBLISHED: NOTIFICATION_TYPES.MINUTES_PUBLISHED,
      RESOLUTION_APPROVED: NOTIFICATION_TYPES.RESOLUTION_APPROVED,
      RESOLUTION_REJECTED: NOTIFICATION_TYPES.RESOLUTION_REJECTED,
      ELECTION_OPENED: NOTIFICATION_TYPES.ELECTION_OPENED,
      ELECTION_COMPLETED: NOTIFICATION_TYPES.ELECTION_COMPLETED,
      COMMITTEE_APPOINTED: NOTIFICATION_TYPES.COMMITTEE_APPOINTED,
      MEMBER_DECEASED_REPORTED: NOTIFICATION_TYPES.MEMBER_DECEASED_REPORTED,
      BURIAL_CASE_OPENED: NOTIFICATION_TYPES.BURIAL_CASE_OPENED,
      BENEFICIARY_CLAIM_SUBMITTED: NOTIFICATION_TYPES.BENEFICIARY_CLAIM_SUBMITTED,
      CLAIM_APPROVED: NOTIFICATION_TYPES.CLAIM_APPROVED,
      CLAIM_REJECTED: NOTIFICATION_TYPES.CLAIM_REJECTED,
      BENEFIT_PAYMENT_DISBURSED: NOTIFICATION_TYPES.BENEFIT_PAYMENT_DISBURSED,
      BURIAL_CONTRIBUTION_REQUIRED: NOTIFICATION_TYPES.BURIAL_CONTRIBUTION_REQUIRED,
      EMERGENCY_CONTRIBUTION_OPENED: NOTIFICATION_TYPES.EMERGENCY_CONTRIBUTION_OPENED,
      SECURITY_ALERT: NOTIFICATION_TYPES.SECURITY_ALERT,
      NEW_DEVICE_LOGIN: NOTIFICATION_TYPES.NEW_DEVICE_LOGIN,
      PASSWORD_CHANGED: NOTIFICATION_TYPES.PASSWORD_CHANGED,
      ROLE_PERMISSION_CHANGED: NOTIFICATION_TYPES.ROLE_PERMISSION_CHANGED
    };

    return eventMapping[domainEvent] || NOTIFICATION_TYPES.SECURITY_ALERT;
  }

  /**
   * Generate message for domain event
   */
  generateMessageForDomainEvent(domainEvent, eventData, recipient) {
    const messageTemplates = {
      CONTRIBUTION_RECEIVED: `${eventData.memberName} has paid KSh ${eventData.amount} towards ${eventData.contributionPeriod} contribution`,
      CONTRIBUTION_MISSED: `You missed your contribution of KSh ${eventData.amount} for ${eventData.contributionPeriod}`,
      CONTRIBUTION_OVERDUE: `Your contribution of KSh ${eventData.amount} for ${eventData.contributionPeriod} is overdue`,
      LOAN_SUBMITTED: `${eventData.memberName} has applied for a KSh ${eventData.amount} loan`,
      LOAN_APPROVED: `Your loan application for KSh ${eventData.amount} has been approved`,
      LOAN_REJECTED: `Your loan application for KSh ${eventData.amount} has been rejected`,
      LOAN_DISBURSED: `Your loan of KSh ${eventData.amount} has been disbursed`,
      LOAN_REPAYMENT_RECEIVED: `Loan repayment of KSh ${eventData.amount} received`,
      LOAN_REPAYMENT_OVERDUE: `Your loan repayment of KSh ${eventData.amount} is overdue`,
      WITHDRAWAL_REQUESTED: `${eventData.memberName} has requested a withdrawal of KSh ${eventData.amount}`,
      WITHDRAWAL_APPROVED: `Your withdrawal of KSh ${eventData.amount} has been approved`,
      WITHDRAWAL_REJECTED: `Your withdrawal of KSh ${eventData.amount} has been rejected`,
      PAYMENT_FAILED: `Payment of KSh ${eventData.amount} failed`,
      PAYMENT_REVERSED: `Payment of KSh ${eventData.amount} was reversed`,
      MEMBER_JOINED: `${eventData.memberName} has joined the chama`,
      MEMBER_INVITED: `You have been invited to join ${eventData.chamaName}`,
      INVITATION_ACCEPTED: `${eventData.memberName} has accepted your invitation`,
      MEMBER_SUSPENDED: `Your membership has been suspended`,
      MEMBER_REINSTATED: `Your membership has been reinstated`,
      MEMBER_REMOVED: `Your membership has been removed from the chama`,
      ROLE_CHANGED: `Your role has been changed to ${eventData.newRole}`,
      MEETING_SCHEDULED: `Meeting scheduled for ${eventData.meetingDate}`,
      MEETING_REMINDER: `Reminder: Meeting tomorrow at ${eventData.meetingTime}`,
      MEETING_STARTED: `Meeting has started`,
      MINUTES_PUBLISHED: `Meeting minutes for ${eventData.meetingDate} have been published`,
      RESOLUTION_APPROVED: `Resolution "${eventData.resolutionTitle}" has been approved`,
      RESOLUTION_REJECTED: `Resolution "${eventData.resolutionTitle}" has been rejected`,
      ELECTION_OPENED: `Election for ${eventData.position} is now open`,
      ELECTION_COMPLETED: `Election for ${eventData.position} has been completed`,
      COMMITTEE_APPOINTED: `You have been appointed to the ${eventData.committeeType} committee`,
      MEMBER_DECEASED_REPORTED: `${eventData.memberName} has been reported as deceased`,
      BURIAL_CASE_OPENED: `Burial case opened for ${eventData.memberName}`,
      BENEFICIARY_CLAIM_SUBMITTED: `Beneficiary claim submitted for ${eventData.memberName}`,
      CLAIM_APPROVED: `Your beneficiary claim has been approved`,
      CLAIM_REJECTED: `Your beneficiary claim has been rejected`,
      BENEFIT_PAYMENT_DISBURSED: `Benefit payment of KSh ${eventData.amount} has been disbursed`,
      BURIAL_CONTRIBUTION_REQUIRED: `Burial contribution of KSh ${eventData.amount} required for ${eventData.memberName}`,
      EMERGENCY_CONTRIBUTION_OPENED: `Emergency contribution opened for ${eventData.purpose}`,
      SECURITY_ALERT: `Security alert: ${eventData.alertMessage}`,
      NEW_DEVICE_LOGIN: `New login detected from ${eventData.deviceInfo}`,
      PASSWORD_CHANGED: `Your password has been changed`,
      ROLE_PERMISSION_CHANGED: `Role or permission changes have been made`
    };

    return messageTemplates[domainEvent] || `New notification: ${domainEvent}`;
  }

  /**
   * Get role for membership
   */
  async getRoleForMembership(membershipId) {
    try {
      const membership = await ChamaMembership.findById(membershipId);
      return membership ? membership.role : null;
    } catch (error) {
      console.error('Get role error:', error);
      return null;
    }
  }

  /**
   * Get unread notifications for user
   */
  async getUnreadNotifications(recipientMembershipId, options = {}) {
    return await Notification.getUnreadNotifications(recipientMembershipId, options);
  }

  /**
   * Get action-required notifications
   */
  async getActionRequiredNotifications(recipientMembershipId, options = {}) {
    return await Notification.getActionRequiredNotifications(recipientMembershipId, options);
  }

  /**
   * Get high-priority notifications
   */
  async getHighPriorityNotifications(recipientMembershipId, options = {}) {
    return await Notification.getHighPriorityNotifications(recipientMembershipId, options);
  }

  /**
   * Get notification counts by state
   */
  async getNotificationCounts(recipientMembershipId) {
    return await Notification.getNotificationCounts(recipientMembershipId);
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }
    return await notification.markAsRead();
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(recipientMembershipId) {
    return await Notification.markAllAsRead(recipientMembershipId);
  }

  /**
   * Mark notification as archived
   */
  async markAsArchived(notificationId) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }
    return await notification.markAsArchived();
  }

  /**
   * Mark action as completed
   */
  async markActionCompleted(notificationId, actionTaken, respondedBy, metadata = {}) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }
    return await notification.markActionCompleted(actionTaken, respondedBy, metadata);
  }

  /**
   * Cleanup expired notifications
   */
  async cleanupExpiredNotifications() {
    return await Notification.cleanupExpiredNotifications();
  }

  /**
   * Archive old notifications
   */
  async archiveOldNotifications(daysOld = 30) {
    return await Notification.archiveOldNotifications(daysOld);
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics(chamaId, timeRange = '7d') {
    return await Notification.getNotificationStatistics(chamaId, timeRange);
  }

  /**
   * Get confirmation dialog template
   */
  getConfirmationTemplate(templateType) {
    return CONFIRMATION_TEMPLATES[templateType] || null;
  }

  /**
   * Get toast template
   */
  getToastTemplate(toastType) {
    return TOAST_TEMPLATES[toastType] || null;
  }
}

// ========================================
// SETUP DOMAIN EVENT LISTENERS
// ========================================

// Auto-subscribe to domain events and create notifications
domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.CONTRIBUTION_RECEIVED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.CONTRIBUTION_RECEIVED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.LOAN_SUBMITTED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.LOAN_SUBMITTED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.LOAN_APPROVED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.LOAN_APPROVED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.LOAN_DISBURSED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.LOAN_DISBURSED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.MEMBER_JOINED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.MEMBER_JOINED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.MEMBER_REMOVED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.MEMBER_REMOVED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.ROLE_CHANGED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.ROLE_CHANGED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.MEETING_SCHEDULED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.MEETING_SCHEDULED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.SECURITY_ALERT, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.SECURITY_ALERT,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.PAYMENT_FAILED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.PAYMENT_FAILED,
    chamaId: eventData.chamaId,
    eventData
  });
});

domainEventEmitter.onDomainEvent(DOMAIN_EVENTS.WITHDRAWAL_REQUESTED, async (eventData) => {
  await notificationService.sendDomainEventNotification({
    domainEvent: DOMAIN_EVENTS.WITHDRAWAL_REQUESTED,
    chamaId: eventData.chamaId,
    eventData
  });
});

export default new NotificationService();