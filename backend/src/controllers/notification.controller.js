import notificationService from '../services/notification.service.js';
import notificationPreferenceService from '../services/notificationPreference.service.js';
import notificationEventHandler from '../services/notificationEventHandler.service.js';
import confirmationService from '../services/confirmation.service.js';
import toastService from '../services/toast.service.js';
import Notification from '../models/Notification.js';

// ========================================
// NOTIFICATION CONTROLLER
// ========================================
//
// Controller for notification-related API endpoints
// including notification center, preferences, and toast notifications
//
// ========================================

/**
 * Get unread notifications for current user
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const { user } = req;
    const { limit = 20, skip = 0, category } = req.query;

    // Get user's active membership for the chama
    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notifications = await notificationService.getUnreadNotifications(membership._id, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      category
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Get unread notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get action-required notifications
 */
export const getActionRequiredNotifications = async (req, res) => {
  try {
    const { user } = req;
    const { limit = 10, skip = 0 } = req.query;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notifications = await notificationService.getActionRequiredNotifications(membership._id, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Get action required notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get high-priority notifications
 */
export const getHighPriorityNotifications = async (req, res) => {
  try {
    const { user } = req;
    const { limit = 10, skip = 0 } = req.query;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notifications = await notificationService.getHighPriorityNotifications(membership._id, {
      limit: parseInt(limit),
      skip: parseInt(skip)
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Get high priority notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get notifications by category
 */
export const getNotificationsByCategory = async (req, res) => {
  try {
    const { user } = req;
    const { category } = req.params;
    const { limit = 20, skip = 0, state } = req.query;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notifications = await Notification.getNotificationsByCategory(membership._id, category, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      state
    });

    res.status(200).json({
      success: true,
      data: notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Get notifications by category error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get notification counts by state
 */
export const getNotificationCounts = async (req, res) => {
  try {
    const { user } = req;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const counts = await notificationService.getNotificationCounts(membership._id);

    const countMap = {};
    counts.forEach(item => {
      countMap[item._id] = item.count;
    });

    res.status(200).json({
      success: true,
      data: countMap
    });

  } catch (error) {
    console.error('Get notification counts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await notificationService.markAsRead(notificationId);

    res.status(200).json({
      success: true,
      data: notification,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const { user } = req;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const result = await notificationService.markAllAsRead(membership._id);

    res.status(200).json({
      success: true,
      data: result,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark notification as archived
 */
export const markNotificationAsArchived = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await notificationService.markAsArchived(notificationId);

    res.status(200).json({
      success: true,
      data: notification,
      message: 'Notification archived'
    });

  } catch (error) {
    console.error('Mark notification as archived error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Mark action as completed
 */
export const markActionCompleted = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { actionTaken, metadata = {} } = req.body;
    const { user } = req;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notification = await notificationService.markActionCompleted(
      notificationId,
      actionTaken,
      membership._id,
      metadata
    );

    res.status(200).json({
      success: true,
      data: notification,
      message: 'Action marked as completed'
    });

  } catch (error) {
    console.error('Mark action completed error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const { user } = req;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient_membership_id: membership._id
    }).populate('chama_id');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });

  } catch (error) {
    console.error('Get notification by ID error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get notification statistics for chama (admin)
 */
export const getChamaNotificationStatistics = async (req, res) => {
  try {
    const { chamaId } = req.params;
    const { timeRange = '7d' } = req.query;

    const statistics = await notificationService.getNotificationStatistics(chamaId, timeRange);

    res.status(200).json({
      success: true,
      data: statistics
    });

  } catch (error) {
    console.error('Get chama notification statistics error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get notification preferences for current user
 */
export const getNotificationPreferences = async (req, res) => {
  try {
    const { userId } = req;

    const preferences = await notificationPreferenceService.getUserPreferences(userId);

    res.status(200).json({
      success: true,
      data: preferences
    });

  } catch (error) {
    console.error('Get notification preferences error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update default channel preferences
 */
export const updateDefaultChannelPreferences = async (req, res) => {
  try {
    const { userId } = req;
    const { channelPreferences } = req.body;

    const preferences = await notificationPreferenceService.updateDefaultChannels(
      userId,
      channelPreferences
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Default channel preferences updated'
    });

  } catch (error) {
    console.error('Update default channel preferences error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update category preferences
 */
export const updateCategoryPreferences = async (req, res) => {
  try {
    const { userId } = req;
    const { category } = req.params;
    const { categoryPreferences } = req.body;

    const preferences = await notificationPreferenceService.updateCategoryPreferences(
      userId,
      category,
      categoryPreferences
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Category preferences updated'
    });

  } catch (error) {
    console.error('Update category preferences error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update quiet hours settings
 */
export const updateQuietHours = async (req, res) => {
  try {
    const { userId } = req;
    const { quietHoursSettings } = req.body;

    const preferences = await notificationPreferenceService.updateQuietHours(
      userId,
      quietHoursSettings
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Quiet hours updated'
    });

  } catch (error) {
    console.error('Update quiet hours error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update do not disturb mode
 */
export const updateDoNotDisturb = async (req, res) => {
  try {
    const { userId } = req;
    const { enabled, until } = req.body;

    const preferences = await notificationPreferenceService.updateDoNotDisturb(
      userId,
      enabled,
      until
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Do not disturb mode updated'
    });

  } catch (error) {
    console.error('Update do not disturb error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update mobile settings
 */
export const updateMobileSettings = async (req, res) => {
  try {
    const { userId } = req;
    const { mobileSettings } = req.body;

    const preferences = await notificationPreferenceService.updateMobileSettings(
      userId,
      mobileSettings
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Mobile settings updated'
    });

  } catch (error) {
    console.error('Update mobile settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update email settings
 */
export const updateEmailSettings = async (req, res) => {
  try {
    const { userId } = req;
    const { emailSettings } = req.body;

    const preferences = await notificationPreferenceService.updateEmailSettings(
      userId,
      emailSettings
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Email settings updated'
    });

  } catch (error) {
    console.error('Update email settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update SMS settings
 */
export const updateSMSSettings = async (req, res) => {
  try {
    const { userId } = req;
    const { smsSettings } = req.body;

    const preferences = await notificationPreferenceService.updateSMSSettings(
      userId,
      smsSettings
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'SMS settings updated'
    });

  } catch (error) {
    console.error('Update SMS settings error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Reset preferences to defaults
 */
export const resetPreferencesToDefaults = async (req, res) => {
  try {
    const { userId } = req;

    const preferences = await notificationPreferenceService.resetToDefaults(userId);

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Preferences reset to defaults'
    });

  } catch (error) {
    console.error('Reset preferences error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Enable push notifications
 */
export const enablePushNotifications = async (req, res) => {
  try {
    const { userId } = req;
    const { deviceToken, deviceInfo } = req.body;

    const preferences = await notificationPreferenceService.enablePushNotifications(
      userId,
      deviceToken,
      deviceInfo
    );

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Push notifications enabled'
    });

  } catch (error) {
    console.error('Enable push notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Disable push notifications
 */
export const disablePushNotifications = async (req, res) => {
  try {
    const { userId } = req;

    const preferences = await notificationPreferenceService.disablePushNotifications(userId);

    res.status(200).json({
      success: true,
      data: preferences,
      message: 'Push notifications disabled'
    });

  } catch (error) {
    console.error('Disable push notifications error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get confirmation dialog template
 */
export const getConfirmationTemplate = async (req, res) => {
  try {
    const { templateType } = req.params;
    const data = req.body.data || {};

    const template = confirmationService.generateConfirmationDialog(templateType, data);

    res.status(200).json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Get confirmation template error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get toast template
 */
export const getToastTemplate = async (req, res) => {
  try {
    const { toastType } = req.params;

    const template = toastService.getToastTemplate(toastType);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Toast template not found'
      });
    }

    res.status(200).json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Get toast template error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Initialize notification event listeners
 */
export const initializeNotificationSystem = async (req, res) => {
  try {
    notificationEventHandler.initializeEventListeners();

    res.status(200).json({
      success: true,
      message: 'Notification system initialized'
    });

  } catch (error) {
    console.error('Initialize notification system error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Send toast notification
 */
export const sendToastNotification = async (req, res) => {
  try {
    const { user } = req;
    const { toastType, messageData = {}, duration = 3000 } = req.body;

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      user_id: user._id,
      status: 'active'
    });

    if (!membership) {
      return res.status(404).json({
        success: false,
        message: 'No active membership found'
      });
    }

    const result = await toastService.sendToast({
      recipientMembershipId: membership._id,
      toastType,
      messageData,
      duration
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Send toast notification error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Validate confirmation dialog
 */
export const validateConfirmationDialog = async (req, res) => {
  try {
    const { templateType } = req.params;
    const data = req.body.data || {};

    const result = confirmationService.validateConfirmationResponse(templateType, data);

    res.status(200).json({
      success: true,
      data: { valid: result }
    });

  } catch (error) {
    console.error('Validate confirmation dialog error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
};