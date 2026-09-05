import api from "@/app/services/api";

const notificationsApi = {
  // Notification Center
  getUnreadNotifications(params) {
    return api.get("/notifications/unread", { params });
  },

  getActionRequiredNotifications(params) {
    return api.get("/notifications/action-required", { params });
  },

  getHighPriorityNotifications(params) {
    return api.get("/notifications/high-priority", { params });
  },

  getNotificationsByCategory(category, params) {
    return api.get(`/notifications/category/${category}`, { params });
  },

  getNotificationCounts() {
    return api.get("/notifications/counts");
  },

  getNotificationById(notificationId) {
    return api.get(`/notifications/${notificationId}`);
  },

  markNotificationAsRead(notificationId) {
    return api.patch(`/notifications/${notificationId}/read`);
  },

  markAllNotificationsAsRead() {
    return api.patch("/notifications/read-all");
  },

  markNotificationAsArchived(notificationId) {
    return api.patch(`/notifications/${notificationId}/archive`);
  },

  markActionCompleted(notificationId, data) {
    return api.patch(`/notifications/${notificationId}/action`, data);
  },

  // Preferences
  getNotificationPreferences() {
    return api.get("/notifications/preferences");
  },

  updateDefaultChannelPreferences(channelPreferences) {
    return api.patch("/notifications/preferences/channels", channelPreferences);
  },

  updateCategoryPreferences(category, categoryPreferences) {
    return api.patch(`/notifications/preferences/category/${category}`, categoryPreferences);
  },

  updateQuietHours(quietHoursSettings) {
    return api.patch("/notifications/preferences/quiet-hours", quietHoursSettings);
  },

  updateDoNotDisturb(enabled, until) {
    return api.patch("/notifications/preferences/do-not-disturb", { enabled, until });
  },

  updateMobileSettings(mobileSettings) {
    return api.patch("/notifications/preferences/mobile", mobileSettings);
  },

  updateEmailSettings(emailSettings) {
    return api.patch("/notifications/preferences/email", emailSettings);
  },

  updateSMSSettings(smsSettings) {
    return api.patch("/notifications/preferences/sms", smsSettings);
  },

  resetPreferencesToDefaults() {
    return api.post("/notifications/preferences/reset");
  },

  enablePushNotifications(deviceToken, deviceInfo) {
    return api.post("/notifications/preferences/push/enable", { deviceToken, deviceInfo });
  },

  disablePushNotifications() {
    return api.post("/notifications/preferences/push/disable");
  },

  // Templates
  getConfirmationTemplate(templateType, data) {
    return api.get(`/notifications/templates/confirmation/${templateType}`, { data });
  },

  getToastTemplate(toastType) {
    return api.get(`/notifications/templates/toast/${toastType}`);
  },

  // Toast Notifications
  sendToastNotification(toastType, messageData, duration) {
    return api.post("/notifications/toast", { toastType, messageData, duration });
  },

  validateConfirmationDialog(templateType, data) {
    return api.post(`/notifications/confirmation/${templateType}/validate`, { data });
  },

  // System
  initializeNotificationSystem() {
    return api.post("/notifications/initialize");
  },

  // Chama Statistics (Admin)
  getChamaNotificationStatistics(chamaId, timeRange) {
    return api.get(`/notifications/chamas/${chamaId}/statistics`, { params: { timeRange } });
  },

  // Legacy compatibility
  getNotifications(params) {
    return api.get("/notifications/unread", { params });
  },

  markRead(id) {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllRead() {
    return api.patch("/notifications/read-all");
  },
};

export default notificationsApi;
