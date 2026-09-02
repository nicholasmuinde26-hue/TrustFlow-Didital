import mongoose from 'mongoose';

// ======================================================
// MEMBER COMMUNICATION PREFERENCES SCHEMA
// ======================================================
// This schema stores each member's communication preferences
// to enable personalized, multi-channel communication.
// ======================================================

const memberCommunicationPreferencesSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the member's chama membership
    // ---------------------------------------------------
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      unique: true
    },

    // ---------------------------------------------------
    // Reference to the chama (denormalized for performance)
    // ---------------------------------------------------
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // User reference
    // ---------------------------------------------------
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Language preferences
    // ---------------------------------------------------
    language: {
      type: String,
      enum: ['en', 'sw', 'ki', 'lu', 'ka', 'custom'],
      default: 'en'
    },
    custom_language: {
      type: String,
      trim: true,
      maxlength: 50
    },

    // ---------------------------------------------------
    // Communication channel preferences
    // ---------------------------------------------------
    channels: {
      sms: {
        enabled: {
          type: Boolean,
          default: true
        },
        phone: {
          type: String,
          trim: true,
          maxlength: 20
        },
        preferred: {
          type: Boolean,
          default: true
        },
        receive_reminders: {
          type: Boolean,
          default: true
        },
        receive_notices: {
          type: Boolean,
          default: true
        },
        receive_promotional: {
          type: Boolean,
          default: false
        }
      },
      whatsapp: {
        enabled: {
          type: Boolean,
          default: false
        },
        phone: {
          type: String,
          trim: true,
          maxlength: 20
        },
        preferred: {
          type: Boolean,
          default: false
        },
        receive_reminders: {
          type: Boolean,
          default: true
        },
        receive_notices: {
          type: Boolean,
          default: true
        },
        receive_promotional: {
          type: Boolean,
          default: false
        }
      },
      email: {
        enabled: {
          type: Boolean,
          default: false
        },
        email_address: {
          type: String,
          trim: true,
          lowercase: true,
          maxlength: 100
        },
        preferred: {
          type: Boolean,
          default: false
        },
        receive_reminders: {
          type: Boolean,
          default: true
        },
        receive_notices: {
          type: Boolean,
          default: true
        },
        receive_statements: {
          type: Boolean,
          default: true
        },
        receive_promotional: {
          type: Boolean,
          default: false
        }
      },
      app: {
        enabled: {
          type: Boolean,
          default: true
        },
        preferred: {
          type: Boolean,
          default: false
        },
        receive_push_notifications: {
          type: Boolean,
          default: true
        },
        receive_reminders: {
          type: Boolean,
          default: true
        },
        receive_notices: {
          type: Boolean,
          default: true
        }
      },
      ussd: {
        enabled: {
          type: Boolean,
          default: true
        },
        preferred: {
          type: Boolean,
          default: false
        },
        language: {
          type: String,
          enum: ['en', 'sw'],
          default: 'sw'
        }
      }
    },

    // ---------------------------------------------------
    // Communication timing preferences
    // ---------------------------------------------------
    timing: {
      quiet_hours_start: {
        type: String,
        default: '22:00',
        trim: true
      },
      quiet_hours_end: {
        type: String,
        default: '08:00',
        trim: true
      },
      respect_quiet_hours: {
        type: Boolean,
        default: true
      },
      preferred_days: [
        {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        }
      ],
      reminder_frequency: {
        type: String,
        enum: ['once', 'daily', 'weekly'],
        default: 'once'
      }
    },

    // ---------------------------------------------------
    // Specific notification preferences
    // ---------------------------------------------------
    notifications: {
      contribution_reminders: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String],
        timing: {
          days_before: [Number],
          days_after: [Number]
        }
      },
      payment_confirmations: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String]
      },
      meeting_reminders: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String],
        timing: {
          days_before: [Number]
        }
      },
      burial_claims: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String]
      },
      benefit_notifications: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String]
      },
      arrears_notices: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String],
        escalation_schedule: [Number]
      },
      committee_notifications: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String]
      },
      announcements: {
        enabled: {
          type: Boolean,
          default: true
        },
        channels: [String]
      }
    },

    // ---------------------------------------------------
    // Statement preferences
    // ---------------------------------------------------
    statements: {
      preferred_format: {
        type: String,
        enum: ['app', 'ussd', 'sms', 'email_pdf', 'whatsapp_pdf'],
        default: 'app'
      },
      frequency: {
        type: String,
        enum: ['on_request', 'monthly', 'quarterly'],
        default: 'on_request'
      },
      include_detailed_breakdown: {
        type: Boolean,
        default: true
      },
      include_projections: {
        type: Boolean,
        default: false
      }
    },

    // ---------------------------------------------------
    // Emergency contact preferences
    // ---------------------------------------------------
    emergency_contact: {
      name: {
        type: String,
        trim: true,
        maxlength: 200
      },
      relationship: {
        type: String,
        trim: true,
        maxlength: 100
      },
      phone: {
        type: String,
        trim: true,
        maxlength: 20
      },
      receive_emergency_notifications: {
        type: Boolean,
        default: true
      }
    },

    // ---------------------------------------------------
    // Contact verification status
    // ---------------------------------------------------
    verification: {
      phone_verified: {
        type: Boolean,
        default: false
      },
      phone_verified_at: {
        type: Date,
        default: null
      },
      email_verified: {
        type: Boolean,
        default: false
      },
      email_verified_at: {
        type: Date,
        default: null
      },
      whatsapp_verified: {
        type: Boolean,
        default: false
      },
      whatsapp_verified_at: {
        type: Date,
        default: null
      }
    },

    // ---------------------------------------------------
    // Privacy preferences
    // ---------------------------------------------------
    privacy: {
      share_contact_with_members: {
        type: Boolean,
        default: false
      },
      share_contact_with_committee: {
        type: Boolean,
        default: true
      },
      allow_directory_listing: {
        type: Boolean,
        default: false
      }
    },

    // ---------------------------------------------------
    // Audit trail
    // ---------------------------------------------------
    last_updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    preferences_confirmed_at: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ======================================================
// INDEXES
// ======================================================

// Chama-wide communication
memberCommunicationPreferencesSchema.index({
  chama_id: 1,
  'channels.sms.enabled': 1
});

memberCommunicationPreferencesSchema.index({
  chama_id: 1,
  'channels.whatsapp.enabled': 1
});

// Channel-specific lookups
memberCommunicationPreferencesSchema.index({
  'channels.sms.phone': 1
});

memberCommunicationPreferencesSchema.index({
  'channels.whatsapp.phone': 1
});

memberCommunicationPreferencesSchema.index({
  'channels.email.email_address': 1
});

// Language-based targeting
memberCommunicationPreferencesSchema.index({
  chama_id: 1,
  language: 1
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

memberCommunicationPreferencesSchema.pre('save', function(next) {
  // Ensure at least one preferred channel is set
  const hasPreferred = 
    this.channels.sms.preferred ||
    this.channels.whatsapp.preferred ||
    this.channels.email.preferred ||
    this.channels.app.preferred ||
    this.channels.ussd.preferred;

  if (!hasPreferred) {
    // Default to SMS if nothing preferred
    this.channels.sms.preferred = true;
  }

  // Sync phone numbers if not specified
  if (this.channels.sms.enabled && !this.channels.sms.phone) {
    this.channels.sms.phone = this.channels.whatsapp.phone;
  }

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

memberCommunicationPreferencesSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Remove sensitive information
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('MemberCommunicationPreferences', memberCommunicationPreferencesSchema);