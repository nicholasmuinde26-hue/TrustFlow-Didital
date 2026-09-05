import express from 'express';
import {
  getUnreadNotifications,
  getActionRequiredNotifications,
  getHighPriorityNotifications,
  getNotificationsByCategory,
  getNotificationCounts,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationAsArchived,
  markActionCompleted,
  getNotificationById,
  getChamaNotificationStatistics,
  getNotificationPreferences,
  updateDefaultChannelPreferences,
  updateCategoryPreferences,
  updateQuietHours,
  updateDoNotDisturb,
  updateMobileSettings,
  updateEmailSettings,
  updateSMSSettings,
  resetPreferencesToDefaults,
  enablePushNotifications,
  disablePushNotifications,
  getConfirmationTemplate,
  getToastTemplate,
  initializeNotificationSystem
} from './notification.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember
} from '../../middleware/chama.middleware.js';

// ========================================
// ROUTER
// ========================================

const router = express.Router();

// ========================================
// NOTIFICATION CENTER ENDPOINTS
// ========================================

/**
 * GET /api/v1/notifications/unread
 * Get unread notifications for current user
 */
router.get('/unread', protect, getUnreadNotifications);

/**
 * GET /api/v1/notifications/action-required
 * Get action-required notifications
 */
router.get('/action-required', protect, getActionRequiredNotifications);

/**
 * GET /api/v1/notifications/high-priority
 * Get high-priority notifications
 */
router.get('/high-priority', protect, getHighPriorityNotifications);

/**
 * GET /api/v1/notifications/category/:category
 * Get notifications by category
 */
router.get('/category/:category', protect, getNotificationsByCategory);

/**
 * GET /api/v1/notifications/counts
 * Get notification counts by state
 */
router.get('/counts', protect, getNotificationCounts);

/**
 * GET /api/v1/notifications/:notificationId
 * Get notification by ID
 */
router.get('/:notificationId', protect, getNotificationById);

/**
 * PATCH /api/v1/notifications/:notificationId/read
 * Mark notification as read
 */
router.patch('/:notificationId/read', protect, markNotificationAsRead);

/**
 * PATCH /api/v1/notifications/:notificationId/archive
 * Mark notification as archived
 */
router.patch('/:notificationId/archive', protect, markNotificationAsArchived);

/**
 * PATCH /api/v1/notifications/:notificationId/action
 * Mark action as completed
 */
router.patch('/:notificationId/action', protect, markActionCompleted);

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', protect, markAllNotificationsAsRead);

// ========================================
// NOTIFICATION PREFERENCES ENDPOINTS
// ========================================

/**
 * GET /api/v1/notifications/preferences
 * Get notification preferences for current user
 */
router.get('/preferences', protect, getNotificationPreferences);

/**
 * PATCH /api/v1/notifications/preferences/channels
 * Update default channel preferences
 */
router.patch('/preferences/channels', protect, updateDefaultChannelPreferences);

/**
 * PATCH /api/v1/notifications/preferences/category/:category
 * Update category preferences
 */
router.patch('/preferences/category/:category', protect, updateCategoryPreferences);

/**
 * PATCH /api/v1/notifications/preferences/quiet-hours
 * Update quiet hours settings
 */
router.patch('/preferences/quiet-hours', protect, updateQuietHours);

/**
 * PATCH /api/v1/notifications/preferences/do-not-disturb
 * Update do not disturb mode
 */
router.patch('/preferences/do-not-disturb', protect, updateDoNotDisturb);

/**
 * PATCH /api/v1/notifications/preferences/mobile
 * Update mobile settings
 */
router.patch('/preferences/mobile', protect, updateMobileSettings);

/**
 * PATCH /api/v1/notifications/preferences/email
 * Update email settings
 */
router.patch('/preferences/email', protect, updateEmailSettings);

/**
 * PATCH /api/v1/notifications/preferences/sms
 * Update SMS settings
 */
router.patch('/preferences/sms', protect, updateSMSSettings);

/**
 * POST /api/v1/notifications/preferences/reset
 * Reset preferences to defaults
 */
router.post('/preferences/reset', protect, resetPreferencesToDefaults);

/**
 * POST /api/v1/notifications/preferences/push/enable
 * Enable push notifications
 */
router.post('/preferences/push/enable', protect, enablePushNotifications);

/**
 * POST /api/v1/notifications/preferences/push/disable
 * Disable push notifications
 */
router.post('/preferences/push/disable', protect, disablePushNotifications);

// ========================================
// ADMIN ENDPOINTS
// ========================================

/**
 * GET /api/v1/chamas/:chamaId/notifications/statistics
 * Get notification statistics for chama (admin)
 */
router.get('/chamas/:chamaId/notifications/statistics', protect, requireChamaMember, getChamaNotificationStatistics);

// ========================================
// TEMPLATE ENDPOINTS
// ========================================

/**
 * GET /api/v1/notifications/templates/confirmation/:templateType
 * Get confirmation dialog template
 */
router.get('/templates/confirmation/:templateType', protect, getConfirmationTemplate);

/**
 * GET /api/v1/notifications/templates/toast/:toastType
 * Get toast template
 */
router.get('/templates/toast/:toastType', protect, getToastTemplate);

// ========================================
// SYSTEM ENDPOINTS
// ========================================

/**
 * POST /api/v1/notifications/initialize
 * Initialize notification event listeners
 */
router.post('/initialize', protect, initializeNotificationSystem);

// ========================================
// EXPORT ROUTER
// ========================================

export default router;