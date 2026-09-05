import mongoose from 'mongoose';

// ========================================
// NOTIFICATION PREFERENCE SCHEMA
// ========================================
//
// User notification preferences for controlling
// how they receive notifications across different channels.
//
// ========================================

const notificationPreferenceSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },

  // Default preferences
  default_channels: {
    in_app: {
      type: Boolean,
      default: true
    },
    toast: {
      type: Boolean,
      default: true
    },
    push: {
      type: Boolean,
      default: false
    },
    sms: {
      type: Boolean,
      default: false
    },
    email: {
      type: Boolean,
      default: false
    }
  },

  // Category-specific preferences
  category_preferences: {
    financial: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    membership: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    governance: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    burial: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    system: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    approval: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      email: { type: Boolean, default: false }
    },
    alert: {
      in_app: { type: Boolean, default: true },
      toast: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      email: { type: Boolean, default: true }
    }
  },

  // Quiet hours (do not send notifications during these times)
  quiet_hours: {
    enabled: {
      type: Boolean,
      default: false
    },
    start_time: {
      type: String,
      default: '22:00' // 10 PM
    },
    end_time: {
      type: String,
      default: '08:00' // 8 AM
    },
    timezone: {
      type: String,
      default: 'Africa/Nairobi'
    }
  },

  // Do not disturb mode
  do_not_disturb: {
    enabled: {
      type: Boolean,
      default: false
    },
    until: {
      type: Date,
      default: null
    }
  },

  // Mobile-specific settings
  mobile_settings: {
    sound_enabled: {
      type: Boolean,
      default: true
    },
    vibration_enabled: {
      type: Boolean,
      default: true
    },
    badge_enabled: {
      type: Boolean,
      default: true
    }
  },

  // Email-specific settings
  email_settings: {
    email_address: {
      type: String,
      default: null
    },
    digest_frequency: {
      type: String,
      enum: ['immediate', 'hourly', 'daily', 'weekly'],
      default: 'immediate'
    }
  },

  // SMS-specific settings
  sms_settings: {
    phone_number: {
      type: String,
      default: null
    },
    country_code: {
      type: String,
      default: '+254'
    }
  },

  // Metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  created_at: {
    type: Date,
    default: Date.now
  },

  updated_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// ========================================
// VALIDATION
// ========================================

notificationPreferenceSchema.pre('save', function(next) {
  // Ensure at least one channel is enabled
  const hasEnabledChannel = 
    this.default_channels.in_app ||
    this.default_channels.toast ||
    this.default_channels.push ||
    this.default_channels.sms ||
    this.default_channels.email;

  if (!hasEnabledChannel) {
    this.default_channels.in_app = true; // Always enable in-app as fallback
  }

  // Validate quiet hours
  if (this.quiet_hours.enabled) {
    const startTime = this.quiet_hours.start_time;
    const endTime = this.quiet_hours.end_time;
    
    if (!startTime || !endTime) {
      return next(new Error('Both start_time and end_time are required when quiet_hours is enabled'));
    }
  }

  next();
});

// ========================================
// MODEL
// ========================================

const NotificationPreference = mongoose.models.NotificationPreference ||
  mongoose.model('NotificationPreference', notificationPreferenceSchema);

export default NotificationPreference;