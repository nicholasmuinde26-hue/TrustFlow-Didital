import Notification from '../models/Notification.js';
import ChamaMembership from '../models/ChamaMembership.js';
import Chama from '../models/Chama.js';
import { organizationLabel, organizationPlural, localizeOrganizationTerms } from '../utils/organizationTerminology.js';
import User from '../models/User.js';
import notificationPreferenceService from './notificationPreference.service.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { sendSms, isSmsChannelConfigured } from './notifications/sms.service.js';
import { sendWhatsappNotification, isWhatsappChannelConfigured } from './notifications/whatsapp.service.js';
import { sendNotificationEmail, isEmailChannelConfigured } from './notifications/email.service.js';
import env from '../config/env.js';
import domainEventEmitter from './domainEvent.emitter.js';
import {
  sendRealTimeNotification,
  sendToastToUser
} from '../modules/realtime/index.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_CHANNELS,
  resolveSupportedChannels,
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

// Events that are about ONE member ("Your loan was approved"). The role fan-out
// below would otherwise deliver them to every member with that role - and now
// that alerts also go out by SMS/WhatsApp, to every phone in the chama. For
// these events the plain "member" audience is narrowed to the member the event
// is about; officials still receive them (worded in the third person).
const PERSONAL_EVENTS = new Set([
  'CONTRIBUTION_MISSED', 'CONTRIBUTION_OVERDUE', 'FINE_APPLIED', 'FINE_WAIVED',
  'LOAN_APPROVED', 'LOAN_REJECTED', 'LOAN_DISBURSED', 'LOAN_REPAYMENT_RECEIVED',
  'LOAN_REPAYMENT_OVERDUE', 'WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED',
  'PAYMENT_FAILED', 'MPESA_PAYMENT_SUCCESSFUL', 'MPESA_PAYMENT_FAILED',
  'MEMBER_INVITED', 'MEMBER_SUSPENDED', 'MEMBER_REINSTATED', 'MEMBER_REMOVED',
  'ROLE_CHANGED', 'COMMITTEE_APPOINTED', 'CLAIM_APPROVED', 'CLAIM_REJECTED',
  'BENEFIT_PAYMENT_DISBURSED', 'NEW_DEVICE_LOGIN', 'PASSWORD_CHANGED',
  'WALLET_DEPOSIT_CONFIRMED', 'WALLET_WITHDRAWAL_PROCESSED', 'MEMBER_EXIT_PROCESSED',
  'PAYOUT_COMPLETED'
]);
const AUDIENCE_ROLES = new Set(['member', 'beneficiary', 'user']);

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

      let localizedTitle = title;
      let localizedMessage = message;
      let localizedDescription = description;
      if (chamaId) {
        const org = await Chama.findById(chamaId).select('organization_family workspace_config.terminology').lean();
        if (org) {
          const label = organizationLabel(org.organization_family, org.workspace_config?.terminology);
          const plural = organizationPlural(label, org.organization_family);
          localizedTitle = localizeOrganizationTerms(title, label, plural);
          localizedMessage = localizeOrganizationTerms(message, label, plural);
          localizedDescription = localizeOrganizationTerms(description, label, plural);
        }
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

      // `priority` defaults to 'normal' in the signature, so a caller that did not
      // choose one must inherit the type's own priority rather than silently
      // downgrading an urgent alert to normal.
      const effectivePriority =
        priority && priority !== 'normal' ? priority : notificationConfig.priority || 'normal';

      // The user's global and category preferences govern delivery. The type
      // decides which channels it is allowed to use: alerts, approvals and
      // anything high/urgent also reaches SMS and WhatsApp (see
      // resolveSupportedChannels in notification.constants.js).
      const preferredChannels = await notificationPreferenceService.getEnabledChannels(
        membership.user_id,
        notificationConfig.category,
        effectivePriority
      );
      const supportedChannels = resolveSupportedChannels(notificationConfig, effectivePriority);
      const channels = preferredChannels.filter((channel) => supportedChannels.includes(channel));
      if (channels.length === 0) return null;
      const isPersistent = channels.includes(NOTIFICATION_CHANNELS.IN_APP);

      // Create notification
      const notification = new Notification({
        chama_id: chamaId,
        recipient_membership_id: recipientMembershipId,
        recipient_user_id: membership.user_id,
        recipient_role: membership.role,
        notification_type: notificationType,
        category: notificationConfig.category,
        icon: notificationConfig.icon,
        title: localizedTitle,
        message: localizedMessage,
        description: localizedDescription,
        metadata,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        action_url: actionUrl,
        action_text: actionText,
        action_method: actionMethod,
        state: NOTIFICATION_STATES.UNREAD,
        priority: effectivePriority,
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
      if (isPersistent) await notification.save();

      // Deliver notifications through channels
      await this.deliverNotification(notification, channels, isPersistent);

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

        // Most call sites never pass an explicit actionUrl, which left
        // action_url null on nearly every notification and made it
        // impossible for the frontend to know which nav item/section tab
        // an unread notification belongs to. Fall back to the workspace
        // route each notification type is configured with (see `route` on
        // NOTIFICATION_TYPES in notification.constants.js) so every
        // notification still resolves to a real page in the workspace the
        // event happened in.
        const actionUrl = eventData.actionUrl
          || (notificationConfig.route ? `/workspace/${chamaId}/${notificationConfig.route}` : null);

        const notification = await this.createNotification({
          chamaId,
          recipientMembershipId: recipient.membershipId,
          notificationType: notificationConfig.type,
          title: eventData.title || notificationConfig.title,
          message: eventData.message || this.generateMessageForDomainEvent(domainEvent, eventData, recipient),
          description: notificationConfig.description || '',
          metadata: eventData,
          relatedEntityType: eventData.entityType,
          relatedEntityId: eventData.entityId,
          actionUrl,
          actionText: eventData.actionText || (notificationConfig.requiresAction ? 'Review now' : undefined),
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
        expires_at: new Date(Date.now() + duration), // Auto-expire after duration
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
  async deliverNotification(notification, channels, isPersistent = true) {
    try {
      const deliveryPromises = [];

      for (const channel of channels) {
        switch (channel) {
          case NOTIFICATION_CHANNELS.IN_APP:
            // In-app is automatically handled by database storage
            if (isPersistent) await notification.updateDeliveryStatus('in-app', 'delivered');
            // Send real-time notification via WebSocket
            await sendRealTimeNotification(notification);
            break;

          case NOTIFICATION_CHANNELS.TOAST:
            // Toast notifications are handled by client polling
            if (isPersistent) await notification.updateDeliveryStatus('toast', 'sent');
            // Send toast via WebSocket
            sendToastToUser(
              notification.recipient_user_id.toString(),
              {
                icon: notification.icon,
                title: notification.title,
                message: notification.message,
                duration: 6000,
                category: notification.category,
                notification: notification.toObject()
              }
            );
            break;

          case NOTIFICATION_CHANNELS.PUSH:
            await this.sendPushNotification(notification, isPersistent);
            break;

          // SMS, WhatsApp and email call external providers that can take
          // seconds (or time out). They run in the background so a slow
          // provider never delays the request that caused the notification.
          // Each outcome is written back to delivery_channels honestly.
          case NOTIFICATION_CHANNELS.SMS:
            deliveryPromises.push(this.sendSMSNotification(notification, isPersistent));
            break;

          case NOTIFICATION_CHANNELS.WHATSAPP:
            deliveryPromises.push(this.sendWhatsappNotification(notification, isPersistent));
            break;

          case NOTIFICATION_CHANNELS.EMAIL:
            deliveryPromises.push(this.sendEmailNotification(notification, isPersistent));
            break;

          default:
            console.warn(`Unknown notification channel: ${channel}`);
        }
      }

      // Never awaited by the caller; each sender already catches its own errors.
      Promise.allSettled(deliveryPromises).catch(() => {});

    } catch (error) {
      console.error('Deliver notification error:', error);
      // Don't throw - delivery failures shouldn't break notification creation
    }
  }

  /**
   * Look up where to reach a user off-app. Preference overrides win, then the
   * phone/email the account was registered with.
   */
  async resolveContact(userId) {
    const [user, prefs] = await Promise.all([
      User.findById(userId).select('phone email name').lean(),
      NotificationPreference.findOne({ user_id: userId }).select('sms_settings email_settings').lean()
    ]);
    const countryCode = prefs?.sms_settings?.country_code || '+254';
    const withCountry = (value) => {
      const raw = String(value || '').replace(/[^\d+]/g, '');
      if (!raw) return null;
      if (raw.startsWith('+')) return raw;
      if (raw.startsWith('0')) return `${countryCode}${raw.slice(1)}`;
      return raw.startsWith(countryCode.replace('+', '')) ? `+${raw}` : `${countryCode}${raw}`;
    };
    const smsNumber = withCountry(prefs?.sms_settings?.phone_number || user?.phone);
    const whatsappNumber = withCountry(
      prefs?.sms_settings?.whatsapp_number || prefs?.sms_settings?.phone_number || user?.phone
    );
    return {
      name: user?.name || null,
      sms: smsNumber,
      whatsapp: whatsappNumber,
      email: prefs?.email_settings?.email_address || user?.email || null
    };
  }

  /**
   * Runs one off-app delivery and records the real outcome. A channel that is
   * not configured is recorded as failed with the reason - it is never marked
   * "sent" when nothing left the server.
   */
  async runExternalDelivery(notification, isPersistent, channel, { configured, send }) {
    const record = async (status, details = {}) => {
      if (!isPersistent) return;
      try {
        await notification.updateDeliveryStatus(channel, status, details);
      } catch (error) {
        console.error(`Could not record ${channel} delivery status:`, error.message);
      }
    };

    try {
      if (!configured()) {
        await record('failed', { reason: `${channel} provider is not configured on this server` });
        return;
      }
      const contact = await this.resolveContact(notification.recipient_user_id);
      const result = await send(contact);
      if (result === null) {
        await record('failed', { reason: `No ${channel} address on file for this user` });
        return;
      }
      await record('sent', { externalId: result?.messageId || result?.id || undefined });
    } catch (error) {
      console.error(`${channel} notification error:`, error.message);
      await record('failed', { reason: error.message });
    }
  }

  /**
   * Push: no push provider (FCM/OneSignal) is integrated yet. In-app + WebSocket
   * already reach anyone with the app open, so this records "failed: no
   * provider" instead of pretending a push was delivered.
   */
  async sendPushNotification(notification, isPersistent = true) {
    if (!isPersistent) return;
    try {
      await notification.updateDeliveryStatus('push', 'failed', {
        reason: 'No push provider configured'
      });
    } catch (error) {
      console.error('Push notification error:', error.message);
    }
  }

  /**
   * Send SMS (Africa's Talking). Sent for every notification routed to SMS -
   * alerts, approvals and anything high/urgent - subject to user preferences.
   */
  async sendSMSNotification(notification, isPersistent = true) {
    return this.runExternalDelivery(notification, isPersistent, 'sms', {
      configured: isSmsChannelConfigured,
      send: async (contact) => {
        if (!contact.sms) return null;
        const body = `${notification.title}: ${notification.message}`.replace(/\s+/g, ' ').trim();
        const text = body.length > 300 ? `${body.slice(0, 297)}...` : body;
        return sendSms({ to: contact.sms, message: `${text} - VeriCircle` });
      }
    });
  }

  /**
   * Send WhatsApp (Meta Cloud API).
   */
  async sendWhatsappNotification(notification, isPersistent = true) {
    return this.runExternalDelivery(notification, isPersistent, 'whatsapp', {
      configured: isWhatsappChannelConfigured,
      send: async (contact) => {
        if (!contact.whatsapp) return null;
        return sendWhatsappNotification({
          to: contact.whatsapp,
          title: notification.title,
          message: notification.message
        });
      }
    });
  }

  /**
   * Send email.
   */
  async sendEmailNotification(notification, isPersistent = true) {
    return this.runExternalDelivery(notification, isPersistent, 'email', {
      configured: isEmailChannelConfigured,
      send: async (contact) => {
        if (!contact.email) return null;
        const base = String(env.appUrl || '').replace(/\/$/, '');
        return sendNotificationEmail({
          to: contact.email,
          name: contact.name,
          title: notification.title,
          message: notification.message,
          priority: notification.priority,
          actionUrl: base && notification.action_url ? `${base}${notification.action_url}` : null
        });
      }
    });
  }

  /**
   * Check if role can receive notification type
   */
  canRoleReceiveNotification(role, notificationType) {
    if (notificationType === 'CHAT_MESSAGE_RECEIVED') return true;
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
      // Targeted events (a specific member's loan, their own withdrawal, ...) name
      // their recipients explicitly and skip the role fan-out.
      const explicitMembershipIds = (eventData.recipientMembershipIds || []).map(String);
      const explicitUserIds = (eventData.recipientUserIds || []).map(String);
      if (explicitMembershipIds.length || explicitUserIds.length) {
        const filter = { chama_id: chamaId, status: 'active', $or: [] };
        if (explicitMembershipIds.length) filter.$or.push({ _id: { $in: explicitMembershipIds } });
        if (explicitUserIds.length) filter.$or.push({ user_id: { $in: explicitUserIds } });
        const direct = await ChamaMembership.find(filter);
        const excluded = new Set((eventData.excludeMembershipIds || []).map(String));
        return direct
          .filter((m) => !excluded.has(String(m._id)))
          .filter((m) => !(eventData.excludeInitiator && String(m._id) === String(eventData.sentBy)))
          .map((m) => ({ membershipId: m._id, userId: m.user_id, role: m.role }));
      }

      // Determine which roles should receive this event
      const targetRoles = this.getRolesForDomainEvent(domainEvent, eventData);

      if (targetRoles.length === 0) {
        return [];
      }

      // Get all members of target roles in the chama
      const memberships = await ChamaMembership.find({
        chama_id: chamaId,
        role: { $in: targetRoles },
        status: 'active'
      });

      // Personal events: keep officials, but narrow the ordinary-member audience
      // to the member the event is about (and always include that member).
      const subjectMembershipId = String(eventData.membershipId || eventData.memberMembershipId || '');
      const subjectUserId = String(eventData.userId || eventData.memberUserId || '');
      let pool = memberships;
      if (PERSONAL_EVENTS.has(domainEvent) && (subjectMembershipId || subjectUserId)) {
        const isSubject = (m) =>
          (subjectMembershipId && String(m._id) === subjectMembershipId) ||
          (subjectUserId && String(m.user_id) === subjectUserId);
        pool = memberships.filter((m) => !AUDIENCE_ROLES.has(m.role) || isSubject(m));
        if (!pool.some(isSubject)) {
          // The subject is named explicitly by the event, so they are notified even
          // when the event just changed them out of "active" (suspended, removed).
          const subject = await ChamaMembership.findOne({
            chama_id: chamaId,
            ...(subjectMembershipId ? { _id: subjectMembershipId } : { user_id: subjectUserId })
          });
          if (subject) pool = [...pool, subject];
        }
        pool.forEach((m) => {
          m.__isSubject = isSubject(m);
        });
      }

      // Apply additional filtering based on event data
      const excludedIds = new Set((eventData.excludeMembershipIds || []).map(String));
      const recipients = pool.filter(membership => {
        if (excludedIds.has(String(membership._id))) return false;
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
        role: membership.role,
        isSubject: membership.__isSubject !== false
      }));

    } catch (error) {
      console.error('Get recipients error:', error);
      return [];
    }
  }

  /**
   * Get roles that should receive a domain event
   */
  getRolesForDomainEvent(domainEvent, eventData = {}) {
    if (Array.isArray(eventData.targetRoles) && eventData.targetRoles.length) return eventData.targetRoles;
    const everyone = ['member', 'treasurer', 'secretary', 'chairperson', 'committee_member', 'auditor', 'patron'];
    const eventRoleMapping = {
      // Full-coverage additions
      MEETING_CANCELLED: everyone,
      POLL_PUBLISHED: everyone,
      POLL_CLOSED: everyone,
      DISPUTE_RAISED: ['chairperson', 'secretary', 'treasurer'],
      DISPUTE_UPDATED: ['chairperson', 'secretary'],
      PAYOUT_CREATED: ['treasurer', 'chairperson', 'secretary'],
      PAYOUT_COMPLETED: ['treasurer', 'chairperson', 'secretary'],
      SHAREOUT_EXECUTED: everyone,
      SETTINGS_CHANGED: ['chairperson', 'treasurer', 'secretary', 'auditor'],
      MODULES_CHANGED: ['chairperson', 'treasurer', 'secretary'],
      FINANCIAL_YEAR_CLOSED: everyone,
      ASSET_ACQUIRED: ['treasurer', 'chairperson', 'secretary', 'auditor'],
      LARGE_TRANSACTION_ALERT: ['treasurer', 'chairperson', 'auditor'],
      MEMBER_EXIT_REQUESTED: ['chairperson', 'treasurer', 'secretary'],
      MEMBER_EXIT_PROCESSED: ['chairperson', 'treasurer', 'secretary'],
      // Previously defined but never wired
      MPESA_PAYMENT_FAILED: ['treasurer'],
      MPESA_PAYMENT_SUCCESSFUL: ['treasurer'],
      FINE_APPLIED: ['treasurer'],
      FINE_WAIVED: ['treasurer'],

      // Financial events
      CONTRIBUTION_RECEIVED: ['treasurer', 'chairperson'],
      CONTRIBUTION_MISSED: ['member'],
      CONTRIBUTION_OVERDUE: ['member', 'treasurer'],
      // Officials who must DECIDE get the approval notification (requires
      // action -> attention popup). The secretary just gets the heads-up.
      LOAN_SUBMITTED: ['secretary'],
      LOAN_REQUIRES_APPROVAL: ['chairperson', 'treasurer'],
      LOAN_REQUIRES_DISBURSEMENT: ['treasurer'],
      EXPENSE_REQUIRES_APPROVAL: ['chairperson', 'treasurer'],
      WITHDRAWAL_REQUIRES_APPROVAL: ['chairperson', 'treasurer'],
      ROLE_CHANGE_REQUIRES_APPROVAL: ['chairperson'],
      MEMBER_REMOVAL_REQUIRES_APPROVAL: ['chairperson'],
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
      MEETING_SCHEDULED: ['member', 'treasurer', 'secretary', 'chairperson'],
      MEETING_REMINDER: ['member', 'treasurer', 'secretary', 'chairperson'],
      MEETING_STARTED: ['member', 'treasurer', 'secretary', 'chairperson'],
      MINUTES_PUBLISHED: ['member', 'treasurer', 'secretary', 'chairperson'],
      RESOLUTION_CREATED: ['chairperson', 'secretary', 'treasurer'],
      RESOLUTION_APPROVED: ['member', 'treasurer', 'secretary', 'chairperson'],
      RESOLUTION_REJECTED: ['member', 'treasurer', 'secretary', 'chairperson'],
      ELECTION_OPENED: ['member', 'treasurer', 'secretary', 'chairperson'],
      ELECTION_COMPLETED: ['member', 'treasurer', 'secretary', 'chairperson'],
      COMMITTEE_APPOINTED: ['committee_member', 'chairperson'],
      
      // Burial events
      MEMBER_DECEASED_REPORTED: ['chairperson', 'treasurer', 'committee_member'],
      BURIAL_CASE_OPENED: ['chairperson', 'treasurer', 'committee_member'],
      BENEFICIARY_CLAIM_SUBMITTED: ['chairperson', 'treasurer', 'committee_member'],
      CLAIM_APPROVED: ['beneficiary'],
      CLAIM_REJECTED: ['beneficiary'],
      BENEFIT_PAYMENT_DISBURSED: ['beneficiary'],
      BURIAL_CONTRIBUTION_REQUIRED: ['member', 'treasurer', 'secretary', 'chairperson'],
      EMERGENCY_CONTRIBUTION_OPENED: ['member', 'treasurer', 'secretary', 'chairperson'],
      
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

    // Fall back to the type of the same name (approval events, RESOLUTION_CREATED, ...)
    // before the last-resort SECURITY_ALERT, so an unmapped event is never
    // silently turned into a security alert.
    return eventMapping[domainEvent] || NOTIFICATION_TYPES[domainEvent] || NOTIFICATION_TYPES.SECURITY_ALERT;
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
      ROLE_PERMISSION_CHANGED: `Role or permission changes have been made`,
      LOAN_REQUIRES_APPROVAL: `${eventData.memberName || 'A member'}'s loan of KSh ${eventData.amount} is waiting for your approval`,
      LOAN_REQUIRES_DISBURSEMENT: `An approved loan of KSh ${eventData.amount} is waiting to be disbursed`,
      EXPENSE_REQUIRES_APPROVAL: `An expense of KSh ${eventData.amount} is waiting for your approval`,
      WITHDRAWAL_REQUIRES_APPROVAL: `A withdrawal of KSh ${eventData.amount} is waiting for your approval`,
      ROLE_CHANGE_REQUIRES_APPROVAL: `A role change for ${eventData.memberName || 'a member'} is waiting for your approval`,
      MEMBER_REMOVAL_REQUIRES_APPROVAL: `Removal of ${eventData.memberName || 'a member'} is waiting for your approval`,
      RESOLUTION_CREATED: `A new resolution "${eventData.resolutionTitle || ''}" has been created`
    };

    const text = messageTemplates[domainEvent];
    if (text && PERSONAL_EVENTS.has(domainEvent) && recipient && recipient.isSubject === false) {
      const who = eventData.memberName || 'A member';
      return text
        .replace(/^Your /, `${who}'s `)
        .replace(/^You /, `${who} `)
        .replace(/ your /g, ` ${who}'s `);
    }
    return text || eventData.message || `${(NOTIFICATION_TYPES[domainEvent] || {}).title || 'New notification'}`;
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
   * Get unread notification counts grouped by category
   */
  async getUnreadCountsByCategory(recipientMembershipId) {
    return await Notification.getUnreadCountsByCategory(recipientMembershipId);
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
//
// FIX: this used to register its own inline listeners for
// CONTRIBUTION_RECEIVED, LOAN_SUBMITTED, LOAN_APPROVED, LOAN_DISBURSED,
// MEMBER_JOINED, MEMBER_REMOVED, ROLE_CHANGED, MEETING_SCHEDULED,
// SECURITY_ALERT, PAYMENT_FAILED, and WITHDRAWAL_REQUESTED - but
// notificationEventHandler.service.js (registered once at boot in app.js)
// already listens for every one of those same events with functionally
// identical handlers, plus ~30 more event types this file never covered.
// Both being registered meant every one of these 11 events fired two
// notifications per recipient - visible in logs as the same
// "Role X cannot receive notification type Y" line printed twice for a
// single loan submission. Domain events are now handled in exactly one
// place: notificationEventHandler.service.js.

// FIX: the listeners above all call `notificationService.sendDomainEventNotification`,
// but `export default new NotificationService()` never bound that instance to a
// local name - every domain event emitted crashed the process with
// "ReferenceError: notificationService is not defined". Name the instance so
// those references resolve, then export the same instance as before.
const notificationService = new NotificationService();
export default notificationService;
