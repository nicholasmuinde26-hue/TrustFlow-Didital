import mongoose from 'mongoose';

// ======================================================
// USSD SESSION SCHEMA
// ======================================================
// This schema manages USSD sessions for rural members
// without smartphones, enabling account registration,
// contribution payments, and account management.
// ======================================================

const ussdSessionSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Session identification
    // ---------------------------------------------------
    session_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // ---------------------------------------------------
    // Phone number (MSISDN)
    // ---------------------------------------------------
    phone_number: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    // ---------------------------------------------------
    // Chama reference
    // ---------------------------------------------------
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      default: null,
      index: true
    },

    // ---------------------------------------------------
    // User reference (if authenticated)
    // ---------------------------------------------------
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },

    // ---------------------------------------------------
    // Membership reference (if linked)
    // ---------------------------------------------------
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      default: null,
      index: true
    },

    // ---------------------------------------------------
    // Session state
    // ---------------------------------------------------
    current_menu: {
      type: String,
      trim: true,
      default: 'main'
    },
    previous_menu: {
      type: String,
      trim: true,
      default: null
    },
    session_data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // ---------------------------------------------------
    // Session type
    // ---------------------------------------------------
    session_type: {
      type: String,
      enum: [
        'registration',
        'login',
        'contribution_payment',
        'account_inquiry',
        'beneficiary_management',
        'statement_request',
        'funeral_contribution',
        'help',
        'custom'
      ],
      default: 'login'
    },

    // ---------------------------------------------------
    // Language preference
    // ---------------------------------------------------
    language: {
      type: String,
      enum: ['en', 'sw'],
      default: 'sw'
    },

    // ---------------------------------------------------
    // Session status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned', 'error', 'timeout'],
      default: 'active',
      index: true
    },

    // ---------------------------------------------------
    // Session timing
    // ---------------------------------------------------
    started_at: {
      type: Date,
      default: Date.now
    },
    last_activity_at: {
      type: Date,
      default: Date.now
    },
    completed_at: {
      type: Date,
      default: null
    },
    timeout_seconds: {
      type: Number,
      default: 180 // 3 minutes default
    },

    // ---------------------------------------------------
    // Transaction information (if payment session)
    // ---------------------------------------------------
    transaction: {
      type: {
        type: String,
        enum: ['contribution', 'funeral_contribution', 'registration_fee', 'other'],
        default: null
      },
      amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },
      obligation_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ContributionObligation',
        default: null
      },
      payment_intent_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PaymentIntent',
        default: null
      },
      mpesa_reference: {
        type: String,
        trim: true
      },
      status: {
        type: String,
        enum: ['pending', 'initiated', 'processing', 'completed', 'failed'],
        default: null
      }
    },

    // ---------------------------------------------------
    // Error handling
    // ---------------------------------------------------
    error_count: {
      type: Number,
      default: 0
    },
    last_error: {
      type: String,
      trim: true
    },
    error_code: {
      type: String,
      trim: true
    },

    // ---------------------------------------------------
    // Menu navigation history
    // ---------------------------------------------------
    navigation_history: [
      {
        menu: {
          type: String,
          trim: true
        },
        user_input: {
          type: String,
          trim: true
        },
        timestamp: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // ---------------------------------------------------
    // Additional data
    // ---------------------------------------------------
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // ---------------------------------------------------
    // Network information
    // ---------------------------------------------------
    network_info: {
      operator: {
        type: String,
        trim: true
      },
      location: {
        type: String,
        trim: true
      }
    }
  },
  { timestamps: true }
);

// ======================================================
// INDEXES
// ======================================================

// Primary lookups
ussdSessionSchema.index({
  phone_number: 1,
  status: 1,
  last_activity_at: -1
});

ussdSessionSchema.index({
  user_id: 1,
  status: 1,
  last_activity_at: -1
});

// Active sessions for cleanup
ussdSessionSchema.index({
  status: 1,
  last_activity_at: 1
});

// Transaction sessions
ussdSessionSchema.index({
  'transaction.payment_intent_id': 1
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

ussdSessionSchema.pre('save', function(next) {
  // Update last activity time on any change
  this.last_activity_at = new Date();

  // Auto-complete session if status is completed
  if (this.status === 'completed' && !this.completed_at) {
    this.completed_at = new Date();
  }

  // Check for timeout
  if (this.status === 'active') {
    const timeoutTime = new Date(this.last_activity_at.getTime() + (this.timeout_seconds * 1000));
    if (new Date() > timeoutTime) {
      this.status = 'timeout';
    }
  }

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

ussdSessionSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    if (ret.transaction && ret.transaction.amount !== undefined && ret.transaction.amount !== null) {
      ret.transaction.amount = ret.transaction.amount.toString();
    }

    // Remove sensitive information
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('UssdSession', ussdSessionSchema);