import mongoose from 'mongoose';

// ======================================================
// REPORT SCHEMA
// ======================================================
// This schema manages the generation, storage, and 
// distribution of various reports for burial chamas.
// ======================================================

const reportSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Report identification
    // ---------------------------------------------------
    report_id: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // ---------------------------------------------------
    // Chama reference
    // ---------------------------------------------------
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Report type
    // ---------------------------------------------------
    report_type: {
      type: String,
      enum: [
        'member_register',
        'contribution_register',
        'arrears_report',
        'defaulters_report',
        'payment_reconciliation',
        'burial_cases',
        'benefits_paid',
        'beneficiary_register',
        'fundraising_report',
        'emergency_fund_report',
        'cash_bank_position',
        'monthly_financial_report',
        'member_statement',
        'committee_activity',
        'audit_report',
        'meeting_attendance',
        'welfare_activities',
        'penalty_report',
        'waiver_report',
        'eligibility_report',
        'custom'
      ],
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Report configuration
    // ---------------------------------------------------
    configuration: {
      period_start: {
        type: Date,
        required: true
      },
      period_end: {
        type: Date,
        required: true
      },
      include_inactive_members: {
        type: Boolean,
        default: false
      },
      include_financial_details: {
        type: Boolean,
        default: true
      },
      format: {
        type: String,
        enum: ['json', 'pdf', 'excel', 'csv'],
        default: 'json'
      },
      language: {
        type: String,
        enum: ['en', 'sw'],
        default: 'en'
      },
      custom_parameters: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },

    // ---------------------------------------------------
    // Report status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: ['generating', 'completed', 'failed', 'scheduled'],
      default: 'generating',
      index: true
    },

    // ---------------------------------------------------
    // Report data
    // ---------------------------------------------------
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    // ---------------------------------------------------
    // Summary statistics
    // ---------------------------------------------------
    summary: {
      total_records: {
        type: Number,
        default: 0
      },
      total_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },
      key_metrics: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
      }
    },

    // ---------------------------------------------------
    // File generation
    // ---------------------------------------------------
    file: {
      generated: {
        type: Boolean,
        default: false
      },
      file_url: {
        type: String,
        trim: true
      },
      file_name: {
        type: String,
        trim: true
      },
      file_size: {
        type: Number,
        default: null
      },
      file_format: {
        type: String,
        trim: true
      },
      generated_at: {
        type: Date,
        default: null
      }
    },

    // ---------------------------------------------------
    // Distribution
    // ---------------------------------------------------
    distribution: {
      channels: [
        {
          type: String,
          enum: ['email', 'app', 'download', 'whatsapp', 'sms']
        }
      ],
      recipients: [
        {
          user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          email: {
            type: String,
            trim: true
          },
          phone: {
            type: String,
            trim: true
          },
          sent_at: {
            type: Date,
            default: null
          },
          status: {
            type: String,
            enum: ['pending', 'sent', 'failed'],
            default: 'pending'
          }
        }
      ],
      download_count: {
        type: Number,
        default: 0
      }
    },

    // ---------------------------------------------------
    // Scheduling
    // ---------------------------------------------------
    schedule: {
      is_scheduled: {
        type: Boolean,
        default: false
      },
      frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually', 'custom'],
        default: null
      },
      next_run: {
        type: Date,
        default: null
      },
      last_run: {
        type: Date,
        default: null
      },
      active: {
        type: Boolean,
        default: true
      }
    },

    // ---------------------------------------------------
    // Member-specific reports (e.g., statements)
    // ---------------------------------------------------
    member_specific: {
      is_member_specific: {
        type: Boolean,
        default: false
      },
      membership_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership',
        default: null
      },
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      }
    },

    // ---------------------------------------------------
    // Error handling
    // ---------------------------------------------------
    error: {
      occurred: {
        type: Boolean,
        default: false
      },
      message: {
        type: String,
        trim: true
      },
      stack_trace: {
        type: String,
        trim: true
      },
      error_code: {
        type: String,
        trim: true
      }
    },

    // ---------------------------------------------------
    // Audit trail
    // ---------------------------------------------------
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    generated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    expires_at: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// ======================================================
// INDEXES
// ======================================================

reportSchema.index({
  chama_id: 1,
  report_type: 1,
  createdAt: -1
});

reportSchema.index({
  chama_id: 1,
  status: 1,
  createdAt: -1
});

// Member-specific reports
reportSchema.index({
  'member_specific.membership_id': 1,
  report_type: 1,
  createdAt: -1
});

// Scheduled reports
reportSchema.index({
  'schedule.is_scheduled': 1,
  'schedule.active': 1,
  'schedule.next_run': 1
});

// File-based lookups
reportSchema.index({
  'file.generated': 1,
  'file.generated_at': -1
});

// Expiration cleanup
reportSchema.index({
  expires_at: 1
}, { 
  partialFilterExpression: { expires_at: { $ne: null } }
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

reportSchema.pre('save', function(next) {
  // Generate report ID if not set
  if (!this.report_id) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    this.report_id = `RPT-${timestamp}-${random}`.toUpperCase();
  }

  // Set expiration for non-scheduled reports (30 days)
  if (!this.schedule.is_scheduled && !this.expires_at) {
    this.expires_at = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000));
  }

  // Update last run time for scheduled reports
  if (this.schedule.is_scheduled && this.status === 'completed') {
    this.schedule.last_run = new Date();
    
    // Calculate next run based on frequency
    if (this.schedule.frequency) {
      const nextRun = new Date();
      switch (this.schedule.frequency) {
        case 'daily':
          nextRun.setDate(nextRun.getDate() + 1);
          break;
        case 'weekly':
          nextRun.setDate(nextRun.getDate() + 7);
          break;
        case 'monthly':
          nextRun.setMonth(nextRun.getMonth() + 1);
          break;
        case 'quarterly':
          nextRun.setMonth(nextRun.getMonth() + 3);
          break;
        case 'annually':
          nextRun.setFullYear(nextRun.getFullYear() + 1);
          break;
      }
      this.schedule.next_run = nextRun;
    }
  }

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

reportSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    if (ret.summary && ret.summary.total_amount !== undefined && ret.summary.total_amount !== null) {
      ret.summary.total_amount = ret.summary.total_amount.toString();
    }

    // Remove sensitive information
    if (ret.error && ret.error.stack_trace) {
      delete ret.error.stack_trace;
    }

    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Report', reportSchema);