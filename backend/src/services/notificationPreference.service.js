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
      const preferences = await NotificationPreference.create({
        user_id: userId,
        default_channels: {
          in_app: true,
          toast: true,
          push: false,
          sms: false,
          email: false
        },
        category_preferences: {
          financial: {
            in_app: true,
            toast: true,
            push: false,
            sms: false,
            email: false
          },
          membership: {
            in_app: true,
            toast: true,
            push: false,
            sms: false,
            email: false
          },
          governance: {
            in_app: true,
            toast: true,
            push: false,
            sms: false,
            email: false
          },
          burial: {
            in_app: true,
            toast: true,
            push: false,
            sms: false,
            email: false
          },
          system: {
            in_app: true,
            toast: true,
            push: false,
            sms: false,
            email: false
          },
          approval: {
            in_app: true,
            toast: true,
            push: true,
            sms: false,
            email: false
          },
          alert: {
            in_app: true,
            toast: true,
            push: true,
            sms: true,
            email: true
          }
        },
        quiet_hours: {
          enabled: false,
          start_time: '22:00',
          end_time: '08:00',
          timezone: 'Africa/Nairobi'
        },
        do_not_disturb: {
          enabled: false,
          until: null
        },
        mobile_settings: {
          sound_enabled: true,
          vibration_enabled: true,
          badge_enabled: true
        },
        email_settings: {
          email_address: null,
          digest_frequency: 'immediate'
        },
        sms_settings: {
          phone_number: null,
          country_code: '+254'
        }
      });

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

      Object.assign(preferences.default_channels, channelPreferences);
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

      Object.assign(preferences.sms_settings, smsSettings);
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
  shouldReceiveChannel(userId, channel, category = null) {
    try {
      const preferences = this.getUserPreferences(userId);

      // Check do not disturb mode
      if (preferences.do_not_disturb.enabled) {
        if (preferences.do_not_disturb.until && preferences.do_not_disturb.until > new Date()) {
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

      // Check category-specific preferences
      if (category && preferences.category_preferences[category]) {
        return preferences.category_preferences[category][channel] || false;
      }

      // Check default channel preferences
      return preferences.default_channels[channel] || false;

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
  getEnabledChannels(userId, category = null) {
    try {
      const preferences = this.getUserPreferences(userId);
      const enabledChannels = [];

      const channelCheck = category
        ? (channel) => this.shouldReceiveChannel(userId, channel, category)
        : (channel) => this.shouldReceiveChannel(userId, channel);

      if (channelCheck('in_app')) enabledChannels.push('in-app');
      if (channelCheck('toast')) enabledChannels.push('toast');
      if (channelCheck('push')) enabledChannels.push('push');
      if (channelCheck('sms')) enabledChannels.push('sms');
      if (channelCheck('email')) enabledChannels.push('email');

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