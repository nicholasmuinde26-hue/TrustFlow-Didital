import notificationService from '../services/notification.service.js';
import notificationPreferenceService from '../services/notificationPreference.service.js';
import notificationEventHandler from '../services/notificationEventHandler.service.js';
import confirmationService from '../services/confirmation.service.js';
import toastService from '../services/toast.service.js';
import mongoose from 'mongoose';
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
 * Scope every query to the signed-in USER (all of their memberships), not to
 * whichever active membership Mongo happens to return first. A person who
 * belongs to several chamas, or holds an official role in one and plain
 * member in another, previously only ever saw one chama's notifications.
 * Pass ?chamaId= to narrow to a single workspace.
 */
function userScope(req) {
  const scope = {
    recipient_user_id: new mongoose.Types.ObjectId(String(req.user._id)),
    deleted_at: null
  };
  const chamaId = req.query?.chamaId || req.query?.chama_id;
  if (chamaId && mongoose.isValidObjectId(chamaId)) {
    scope.chama_id = new mongoose.Types.ObjectId(String(chamaId));
  }
  return scope;
}

function pageOf(req, defaultLimit) {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), 200);
  const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);
  return { limit, skip };
}

function listQuery(filter, sort, { limit, skip }) {
  return Notification.find(filter)
    .populate('chama_id', 'name type')
    .sort(sort)
    .limit(limit)
    .skip(skip);
}

// Only the recipient may touch a notification. Returns null if it is not theirs.
async function findOwned(req, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) return null;
  return Notification.findOne({
    _id: notificationId,
    recipient_user_id: req.user._id
  });
}

function fail(res, label, error) {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message: error.message });
}

const notFound = (res) =>
  res.status(404).json({ success: false, message: 'Notification not found' });

// "Still waiting on a person": needs action, not yet acted on, not archived.
// Viewing the page clears the icon badge (state -> read) but must NOT make a
// pending approval disappear, so 'read' stays in this set.
const OPEN_ACTION_FILTER = {
  requires_action: true,
  action_completed_at: null,
  state: { $in: ['unread', 'pending', 'read'] }
};

/**
 * Get unread notifications for current user
 */
export const getUnreadNotifications = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = { ...userScope(req), state: 'unread' };
    if (category) filter.category = category;

    const notifications = await listQuery(filter, { created_at: -1 }, pageOf(req, 20));
    res.status(200).json({ success: true, data: notifications, count: notifications.length });
  } catch (error) {
    fail(res, 'Get unread notifications error', error);
  }
};

/**
 * Get action-required notifications
 */
export const getActionRequiredNotifications = async (req, res) => {
  try {
    const filter = { ...userScope(req), ...OPEN_ACTION_FILTER };
    const notifications = await listQuery(
      filter,
      { action_deadline: 1, created_at: -1 },
      pageOf(req, 10)
    );
    res.status(200).json({ success: true, data: notifications, count: notifications.length });
  } catch (error) {
    fail(res, 'Get action required notifications error', error);
  }
};

/**
 * Get high-priority notifications
 */
export const getHighPriorityNotifications = async (req, res) => {
  try {
    const filter = {
      ...userScope(req),
      priority: { $in: ['high', 'urgent'] },
      state: { $in: ['unread', 'pending'] }
    };
    const notifications = await listQuery(filter, { created_at: -1 }, pageOf(req, 10));
    res.status(200).json({ success: true, data: notifications, count: notifications.length });
  } catch (error) {
    fail(res, 'Get high priority notifications error', error);
  }
};

/**
 * Get notifications by category
 */
export const getNotificationsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { state } = req.query;
    const filter = { ...userScope(req), category };
    if (state) filter.state = state;

    const notifications = await listQuery(filter, { created_at: -1 }, pageOf(req, 20));
    res.status(200).json({ success: true, data: notifications, count: notifications.length });
  } catch (error) {
    fail(res, 'Get notifications by category error', error);
  }
};

/**
 * Counts: by state, unread by category, and how many items are still waiting
 * on this person to act. Drives the nav/tab badges and the bell.
 */
export const getNotificationCounts = async (req, res) => {
  try {
    const scope = userScope(req);

    const [byState, byCategoryRows, actionRequired] = await Promise.all([
      Notification.aggregate([
        { $match: scope },
        { $group: { _id: '$state', count: { $sum: 1 } } }
      ]),
      Notification.aggregate([
        { $match: { ...scope, state: 'unread' } },
        { $group: { _id: '$category', count: { $sum: 1 } } }
      ]),
      Notification.countDocuments({ ...scope, ...OPEN_ACTION_FILTER })
    ]);

    const countMap = { unread: 0, read: 0, archived: 0, acted: 0 };
    byState.forEach((item) => {
      countMap[item._id] = item.count;
    });

    const byCategory = {};
    byCategoryRows.forEach((item) => {
      byCategory[item._id] = item.count;
    });

    countMap.byCategory = byCategory;
    countMap.actionRequired = actionRequired;
    // The Notification Center's "Action Required" card reads `pending`; the
    // 'pending' state is never actually set, so it always showed 0.
    countMap.pending = actionRequired;

    res.status(200).json({ success: true, data: countMap });
  } catch (error) {
    fail(res, 'Get notification counts error', error);
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (req, res) => {
  try {
    const notification = await findOwned(req, req.params.notificationId);
    if (!notification) return notFound(res);

    // Never downgrade an acted/archived notification back to "read".
    if (notification.state === 'unread' || notification.state === 'pending') {
      await notification.markAsRead();
    }

    res.status(200).json({ success: true, data: notification, message: 'Notification marked as read' });
  } catch (error) {
    fail(res, 'Mark notification as read error', error);
  }
};

/**
 * Mark all notifications as read
 */
export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const now = new Date();
    const result = await Notification.updateMany(
      { ...userScope(req), state: 'unread' },
      { state: 'read', read_at: now, updated_at: now }
    );
    res.status(200).json({ success: true, data: result, message: 'All notifications marked as read' });
  } catch (error) {
    fail(res, 'Mark all notifications as read error', error);
  }
};

/**
 * Clear the badge for a page the user has just opened.
 *
 * PATCH /notifications/read-by-route  { path: "/workspace/123/loans" }
 *
 * Marks the caller's unread notifications whose action_url is exactly this
 * page as read. Exact match on purpose: opening "Finance" must not silently
 * clear the "Contributions" badge the person has not looked at yet.
 */
export const markNotificationsReadByRoute = async (req, res) => {
  try {
    const raw = String(req.body?.path || '').split('?')[0].split('#')[0];
    const path = raw.length > 1 ? raw.replace(/\/+$/, '') : raw;

    if (!path.startsWith('/')) {
      return res.status(400).json({ success: false, message: 'A page path is required' });
    }

    const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const now = new Date();

    const result = await Notification.updateMany(
      {
        ...userScope(req),
        state: 'unread',
        action_url: new RegExp(`^${escaped}/?([?#].*)?$`)
      },
      { state: 'read', read_at: now, updated_at: now, $inc: { read_count: 1 } }
    );

    res.status(200).json({
      success: true,
      data: { cleared: result.modifiedCount ?? 0 }
    });
  } catch (error) {
    fail(res, 'Mark notifications read by route error', error);
  }
};

/**
 * Mark notification as archived
 */
export const markNotificationAsArchived = async (req, res) => {
  try {
    const notification = await findOwned(req, req.params.notificationId);
    if (!notification) return notFound(res);

    await notification.markAsArchived();
    res.status(200).json({ success: true, data: notification, message: 'Notification archived' });
  } catch (error) {
    fail(res, 'Mark notification as archived error', error);
  }
};

/**
 * Mark action as completed
 *
 * NOTE: this only RECORDS the person's response on the notification. It does
 * not approve the loan/withdrawal itself - that happens on the real page.
 */
export const markActionCompleted = async (req, res) => {
  try {
    const { actionTaken, metadata = {} } = req.body;

    if (!['approved', 'rejected', 'completed', 'dismissed'].includes(actionTaken)) {
      return res.status(400).json({ success: false, message: 'Invalid actionTaken' });
    }

    const notification = await findOwned(req, req.params.notificationId);
    if (!notification) return notFound(res);

    const ChamaMembership = (await import('../models/ChamaMembership.js')).default;
    const membership = await ChamaMembership.findOne({
      _id: notification.recipient_membership_id,
      user_id: req.user._id
    });

    await notification.markActionCompleted(actionTaken, membership?._id || null, metadata);

    res.status(200).json({ success: true, data: notification, message: 'Action marked as completed' });
  } catch (error) {
    fail(res, 'Mark action completed error', error);
  }
};

/**
 * Get notification by ID
 */
export const getNotificationById = async (req, res) => {
  try {
    const owned = await findOwned(req, req.params.notificationId);
    if (!owned) return notFound(res);

    const notification = await Notification.findById(owned._id).populate('chama_id', 'name type');
    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    fail(res, 'Get notification by ID error', error);
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
    const { user } = req;
    const userId = user._id;

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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;

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
    const { user } = req;
    const userId = user._id;
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
    const { user } = req;
    const userId = user._id;

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