import NotificationPreference from '../models/NotificationPreference.js';
import User from '../models/User.js';

// ========================================
// NOTIFICATION PREFERENCE SERVICE
// ========================================
//
// Service for managing user notification preferences
// across different channels and categories.
//
// ========================================

class NotificationPreferenceService {
  /**
   * Get notification preferences for a user
   */
  async getUserPreferences(userId) {
    try {
      let preferences = await NotificationPreference.findOne({ user_id: userId });

      // Create default preferences if not exists
      if (!preferences) {
        preferences = await this.createDefaultPreferences(userId);
      }

      return preferences;

    } catch (error) {
      console.error('Get user preferences error:', error);
      throw new Error(`Failed to get user preferences: ${error.message}`);
    }
  }

  /**
   * Create default preferences for a user
   */
  async createDefaultPreferences(userId) {
    try {
      // Schema defaults are the single source of truth (see NotificationPreference.js):
      // in-app/toast always on, SMS + WhatsApp on for alerts, approvals, burial,
      // governance, financial and system items.
      const preferences = await NotificationPreference.create({ user_id: userId });

      return preferences;

    } catch (error) {
      console.error('Create default preferences error:', error);
      throw new Error(`Failed to create default preferences: ${error.message}`);
    }
  }

  /**
   * Update default channel preferences
   */
  async updateDefaultChannels(userId, channelPreferences) {
    try {
      const preferences = await this.getUserPreferences(userId);

      const allowedChannels = ['in_app', 'toast', 'push', 'sms', 'whatsapp', 'email'];
      for (const key of allowedChannels) {
        if (typeof channelPreferences?.[key] === 'boolean') preferences.default_channels[key] = channelPreferences[key];
      }
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update default channels error:', error);
      throw new Error(`Failed to update default channels: ${error.message}`);
    }
  }

  /**
   * Update category preferences
   */
  async updateCategoryPreferences(userId, category, categoryPreferences) {
    try {
      const preferences = await this.getUserPreferences(userId);

      if (!preferences.category_preferences[category]) {
        throw new Error(`Invalid category: ${category}`);
      }

      Object.assign(preferences.category_preferences[category], categoryPreferences);
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update category preferences error:', error);
      throw new Error(`Failed to update category preferences: ${error.message}`);
    }
  }

  /**
   * Update quiet hours settings
   */
  async updateQuietHours(userId, quietHoursSettings) {
    try {
      const preferences = await this.getUserPreferences(userId);

      Object.assign(preferences.quiet_hours, quietHoursSettings);
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update quiet hours error:', error);
      throw new Error(`Failed to update quiet hours: ${error.message}`);
    }
  }

  /**
   * Update do not disturb mode
   */
  async updateDoNotDisturb(userId, enabled, until = null) {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.do_not_disturb.enabled = enabled;
      preferences.do_not_disturb.until = until;
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update do not disturb error:', error);
      throw new Error(`Failed to update do not disturb: ${error.message}`);
    }
  }

  /**
   * Update mobile settings
   */
  async updateMobileSettings(userId, mobileSettings) {
    try {
      const preferences = await this.getUserPreferences(userId);

      Object.assign(preferences.mobile_settings, mobileSettings);
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update mobile settings error:', error);
      throw new Error(`Failed to update mobile settings: ${error.message}`);
    }
  }

  /**
   * Update email settings
   */
  async updateEmailSettings(userId, emailSettings) {
    try {
      const preferences = await this.getUserPreferences(userId);

      Object.assign(preferences.email_settings, emailSettings);
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update email settings error:', error);
      throw new Error(`Failed to update email settings: ${error.message}`);
    }
  }

  /**
   * Update SMS settings
   */
  async updateSMSSettings(userId, smsSettings) {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Whitelist: never merge arbitrary client keys into the preferences document.
      const phonePattern = /^\+?[0-9 ()-]{7,20}$/;
      const next = {};
      for (const key of ['phone_number', 'whatsapp_number']) {
        const value = smsSettings?.[key];
        if (value === undefined) continue;
        const trimmed = value === null ? '' : String(value).trim();
        if (trimmed && !phonePattern.test(trimmed)) {
          throw new Error(`Enter a valid ${key === 'whatsapp_number' ? 'WhatsApp' : 'phone'} number, e.g. +254712345678`);
        }
        next[key] = trimmed || null;
      }
      if (typeof smsSettings?.country_code === 'string' && /^\+\d{1,4}$/.test(smsSettings.country_code)) {
        next.country_code = smsSettings.country_code;
      }
      Object.assign(preferences.sms_settings, next);
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update SMS settings error:', error);
      throw new Error(`Failed to update SMS settings: ${error.message}`);
    }
  }

  /**
   * Check if user wants to receive notification in a channel
   */
  async shouldReceiveChannel(userId, channel, category = null) {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Check do not disturb mode
      if (preferences.do_not_disturb.enabled) {
        if (!preferences.do_not_disturb.until || preferences.do_not_disturb.until > new Date()) {
          return false;
        }
      }

      // Check quiet hours
      if (preferences.quiet_hours.enabled) {
        if (this.isInQuietHours(preferences.quiet_hours)) {
          // Allow urgent notifications during quiet hours
          return false;
        }
      }

      // Default channels are the master switches; category settings can further
      // mute a channel but cannot turn it back on after its master switch is off.
      if (preferences.default_channels?.[channel] === false) return false;
      const categoryPreference = category
        ? preferences.category_preferences?.[category]?.[channel]
        : undefined;
      return categoryPreference === undefined
        ? preferences.default_channels?.[channel] !== false
        : categoryPreference === true;

    } catch (error) {
      console.error('Check channel preference error:', error);
      return true; // Default to true on error
    }
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(quietHours) {
    if (!quietHours.enabled) return false;

    try {
      const now = new Date();
      const startTime = this.parseTime(quietHours.start_time);
      const endTime = this.parseTime(quietHours.end_time);

      if (startTime <= endTime) {
        // Quiet hours don't cross midnight
        return now >= startTime && now < endTime;
      } else {
        // Quiet hours cross midnight (e.g., 22:00 to 08:00)
        return now >= startTime || now < endTime;
      }

    } catch (error) {
      console.error('Quiet hours check error:', error);
      return false;
    }
  }

  /**
   * Parse time string to Date object
   */
  parseTime(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  /**
   * Get all channels a user wants to receive notifications for
   */
  async getEnabledChannels(userId, category = null, priority = 'normal') {
    try {
      const preferences = await this.getUserPreferences(userId);
      const enabledChannels = [];
      const mapping = [
        ['in_app', 'in-app'],
        ['toast', 'toast'],
        ['push', 'push'],
        ['sms', 'sms'],
        ['whatsapp', 'whatsapp'],
        ['email', 'email']
      ];

      // Do-not-disturb and quiet hours silence the channels that interrupt a
      // person (toast, push, SMS, WhatsApp). The item is still saved to the
      // in-app notification centre so nothing is lost, and urgent alerts break
      // through quiet hours (never through an explicit do-not-disturb).
      const dnd = preferences.do_not_disturb;
      const dndActive = Boolean(dnd?.enabled && (!dnd.until || dnd.until > new Date()));
      const quietActive = Boolean(
        preferences.quiet_hours?.enabled && this.isInQuietHours(preferences.quiet_hours)
      );
      const muteIntrusive = dndActive || (quietActive && priority !== 'urgent');
      const intrusive = new Set(['toast', 'push', 'sms', 'whatsapp']);

      for (const [preferenceKey, deliveryChannel] of mapping) {
        if (muteIntrusive && intrusive.has(deliveryChannel)) continue;
        // A master switch that was never stored (older preference documents
        // pre-date WhatsApp) falls back to the schema default of "on".
        if (preferences.default_channels?.[preferenceKey] === false) continue;
        const categoryValue = category
          ? preferences.category_preferences?.[category]?.[preferenceKey]
          : undefined;
        if (categoryValue === undefined || categoryValue === true) enabledChannels.push(deliveryChannel);
      }

      return enabledChannels;

    } catch (error) {
      console.error('Get enabled channels error:', error);
      return ['in-app']; // Default to in-app on error
    }
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(userId) {
    try {
      await NotificationPreference.deleteOne({ user_id: userId });
      return await this.createDefaultPreferences(userId);

    } catch (error) {
      console.error('Reset preferences error:', error);
      throw new Error(`Failed to reset preferences: ${error.message}`);
    }
  }

  /**
   * Enable push notifications for user
   */
  async enablePushNotifications(userId, deviceToken, deviceInfo = {}) {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.default_channels.push = true;
      preferences.metadata.push_token = deviceToken;
      preferences.metadata.device_info = deviceInfo;
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Enable push notifications error:', error);
      throw new Error(`Failed to enable push notifications: ${error.message}`);
    }
  }

  /**
   * Disable push notifications for user
   */
  async disablePushNotifications(userId) {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.default_channels.push = false;
      delete preferences.metadata.push_token;
      delete preferences.metadata.device_info;
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Disable push notifications error:', error);
      throw new Error(`Failed to disable push notifications: ${error.message}`);
    }
  }

  /**
   * Update user's email for notifications
   */
  async updateNotificationEmail(userId, emailAddress) {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.email_settings.email_address = emailAddress;
      preferences.default_channels.email = true;
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update notification email error:', error);
      throw new Error(`Failed to update notification email: ${error.message}`);
    }
  }

  /**
   * Update user's phone for SMS notifications
   */
  async updateNotificationPhone(userId, phoneNumber, countryCode = '+254') {
    try {
      const preferences = await this.getUserPreferences(userId);

      preferences.sms_settings.phone_number = phoneNumber;
      preferences.sms_settings.country_code = countryCode;
      preferences.default_channels.sms = true;
      preferences.updated_at = new Date();

      await preferences.save();
      return preferences;

    } catch (error) {
      console.error('Update notification phone error:', error);
      throw new Error(`Failed to update notification phone: ${error.message}`);
    }
  }
}

export default new NotificationPreferenceService();