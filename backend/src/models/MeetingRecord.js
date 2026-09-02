
import mongoose from 'mongoose';

// ======================================================
// MEETING RECORD SCHEMA
// ======================================================
// This schema digitizes meetings, attendance, minutes,
// resolutions, and welfare activities for the chama.
// ======================================================

const meetingRecordSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the chama
    // ---------------------------------------------------
    chama_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chama',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Meeting identification
    // ---------------------------------------------------
    meeting_number: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    // ---------------------------------------------------
    // Meeting type
    // ---------------------------------------------------
    meeting_type: {
      type: String,
      enum: [
        'regular',
        'special',
        'annual_general_meeting',
        'emergency',
        'committee',
        'welfare_visit',
        'funeral',
        'custom'
      ],
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Meeting details
    // ---------------------------------------------------
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // ---------------------------------------------------
    // Schedule
    // ---------------------------------------------------
    scheduled_date: {
      type: Date,
      required: true,
      index: true
    },

    scheduled_start_time: {
      type: String,
      required: true,
      trim: true
    },

    scheduled_end_time: {
      type: String,
      trim: true
    },

    actual_start_time: {
      type: String,
      trim: true
    },

    actual_end_time: {
      type: String,
      trim: true
    },

    // ---------------------------------------------------
    // Location
    // ---------------------------------------------------
    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },

    location_type: {
      type: String,
      enum: ['physical', 'virtual', 'hybrid'],
      default: 'physical'
    },

    virtual_meeting_link: {
      type: String,
      trim: true
    },

    venue_address: {
      type: String,
      trim: true,
      maxlength: 300
    },

    // ---------------------------------------------------
    // Meeting status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: [
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
        'postponed'
      ],
      default: 'scheduled',
      index: true
    },

    // ---------------------------------------------------
    // Attendance
    // ---------------------------------------------------
    attendance: {
      expected_count: {
        type: Number,
        default: null,
        min: 0
      },

      actual_count: {
        type: Number,
        default: null,
        min: 0
      },

      quorum_met: {
        type: Boolean,
        default: null
      },

      // -------------------------------------------------
      // Members who attended
      // -------------------------------------------------
      attendees: [
        {
          membership_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership',
            required: true
          },

          user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
          },

          name: {
            type: String,
            required: true,
            trim: true
          },

          role: {
            type: String,
            trim: true
          },

          check_in_time: {
            type: Date,
            default: null
          },

          check_out_time: {
            type: Date,
            default: null
          },

          attendance_type: {
            type: String,
            enum: [
              'physical',
              'virtual',
              'proxy'
            ],
            default: 'physical'
          },

          proxy_for: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership',
            default: null
          },

          signature: {
            type: String,
            trim: true
          }
        }
      ],

      // -------------------------------------------------
      // Members who were absent
      // -------------------------------------------------
      absentees: [
        {
          membership_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership'
          },

          user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },

          name: {
            type: String,
            trim: true
          },

          reason: {
            type: String,
            trim: true
          },

          excused: {
            type: Boolean,
            default: false
          }
        }
      ]
    },

    // ---------------------------------------------------
    // Agenda
    // ---------------------------------------------------
    agenda: [
      {
        item_number: {
          type: Number,
          required: true
        },

        title: {
          type: String,
          required: true,
          trim: true
        },

        description: {
          type: String,
          trim: true
        },

        presenter: {
          type: String,
          trim: true
        },

        estimated_duration_minutes: {
          type: Number,
          default: null,
          min: 0
        },

        status: {
          type: String,
          enum: [
            'pending',
            'in_progress',
            'completed',
            'deferred',
            'cancelled'
          ],
          default: 'pending'
        },

        outcome: {
          type: String,
          trim: true
        }
      }
    ],

    // ---------------------------------------------------
    // Minutes
    // ---------------------------------------------------
    minutes: {
      prepared_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },

      prepared_at: {
        type: Date,
        default: null
      },

      content: {
        type: String,
        trim: true,
        maxlength: 10000
      },

      approved: {
        type: Boolean,
        default: false
      },

      approved_at: {
        type: Date,
        default: null
      },

      approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },

      document_url: {
        type: String,
        trim: true
      }
    },

    // ---------------------------------------------------
    // Resolutions and decisions
    // ---------------------------------------------------
    resolutions: [
      {
        resolution_number: {
          type: String,
          trim: true
        },

        title: {
          type: String,
          required: true,
          trim: true
        },

        description: {
          type: String,
          required: true,
          trim: true
        },

        proposer: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership'
        },

        vote_type: {
          type: String,
          enum: [
            'unanimous',
            'majority',
            'consensus',
            'executive'
          ]
        },

        votes_for: {
          type: Number,
          default: 0,
          min: 0
        },

        votes_against: {
          type: Number,
          default: 0,
          min: 0
        },

        votes_abstain: {
          type: Number,
          default: 0,
          min: 0
        },

        status: {
          type: String,
          enum: [
            'proposed',
            'passed',
            'rejected',
            'deferred'
          ],
          default: 'proposed'
        },

        implementation_deadline: {
          type: Date,
          default: null
        },

        implementation_status: {
          type: String,
          enum: [
            'not_started',
            'in_progress',
            'completed',
            'cancelled'
          ],
          default: 'not_started'
        }
      }
    ],

    // ---------------------------------------------------
    // Financial matters
    // ---------------------------------------------------
    financial_matters: {
      contributions_collected: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },

      expenses_reported: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },

      balance_reported: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },

      financial_report_presented: {
        type: Boolean,
        default: false
      },

      financial_report_approved: {
        type: Boolean,
        default: false
      }
    },

    // ---------------------------------------------------
    // Welfare activities
    // ---------------------------------------------------
    welfare_activities: [
      {
        activity_type: {
          type: String,
          enum: [
            'funeral_attendance',
            'hospital_visit',
            'bereavement_visit',
            'other'
          ],
          required: true
        },

        beneficiary_name: {
          type: String,
          trim: true
        },

        beneficiary_relationship: {
          type: String,
          trim: true
        },

        description: {
          type: String,
          trim: true
        },

        participants: [
          {
            membership_id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'ChamaMembership'
            },

            name: {
              type: String,
              trim: true
            }
          }
        ],

        contribution_amount: {
          type: mongoose.Schema.Types.Decimal128,
          default: null
        },

        date: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // ---------------------------------------------------
    // Action items
    // ---------------------------------------------------
    action_items: [
      {
        description: {
          type: String,
          required: true,
          trim: true
        },

        assigned_to: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership',
          required: true
        },

        assigned_to_name: {
          type: String,
          trim: true
        },

        due_date: {
          type: Date,
          required: true
        },

        status: {
          type: String,
          enum: [
            'pending',
            'in_progress',
            'completed',
            'overdue'
          ],
          default: 'pending'
        },

        completed_at: {
          type: Date,
          default: null
        },

        notes: {
          type: String,
          trim: true
        }
      }
    ],

    // ---------------------------------------------------
    // Next meeting
    // ---------------------------------------------------
    next_meeting: {
      proposed_date: {
        type: Date,
        default: null
      },

      proposed_location: {
        type: String,
        trim: true
      },

      proposed_agenda_items: [
        {
          type: String,
          trim: true
        }
      ]
    },

    // ---------------------------------------------------
    // Additional information
    // ---------------------------------------------------
    notes: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    // ---------------------------------------------------
    // Audit trail
    // ---------------------------------------------------
    called_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    chaired_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    updated_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },

  // ====================================================
  // SCHEMA OPTIONS
  // ====================================================
  {
    timestamps: true
  }
);

// ======================================================
// INDEXES
// ======================================================

// Primary meeting lookup
meetingRecordSchema.index({
  chama_id: 1,
  status: 1,
  scheduled_date: -1
});

// Meeting type lookup
meetingRecordSchema.index({
  chama_id: 1,
  meeting_type: 1,
  scheduled_date: -1
});

// Unique meeting number per chama
meetingRecordSchema.index(
  {
    chama_id: 1,
    meeting_number: 1
  },
  {
    unique: true
  }
);

// Attendance queries
meetingRecordSchema.index({
  chama_id: 1,
  'attendance.attendees.membership_id': 1,
  scheduled_date: -1
});

// Date range queries
meetingRecordSchema.index({
  chama_id: 1,
  scheduled_date: -1
});

// Status-based workflow
meetingRecordSchema.index({
  status: 1,
  scheduled_date: -1
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

meetingRecordSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // --------------------------------------------------
    // Convert Decimal128 financial fields to strings
    // --------------------------------------------------

    const decimalFields = [
      [
        'financial_matters',
        'contributions_collected'
      ],
      [
        'financial_matters',
        'expenses_reported'
      ],
      [
        'financial_matters',
        'balance_reported'
      ]
    ];

    decimalFields.forEach(([parent, field]) => {
      if (
        ret[parent] &&
        ret[parent][field] !== undefined &&
        ret[parent][field] !== null
      ) {
        ret[parent][field] =
          ret[parent][field].toString();
      }
    });

    // --------------------------------------------------
    // Convert welfare Decimal128 values
    // --------------------------------------------------

    if (
      Array.isArray(ret.welfare_activities)
    ) {
      ret.welfare_activities.forEach(
        (activity) => {
          if (
            activity.contribution_amount !==
              undefined &&
            activity.contribution_amount !== null
          ) {
            activity.contribution_amount =
              activity.contribution_amount.toString();
          }
        }
      );
    }

    // --------------------------------------------------
    // Remove mongoose internal version field
    // --------------------------------------------------

    delete ret.__v;

    return ret;
  }
});

// ======================================================
// MODEL
// ======================================================

export default mongoose.model(
  'MeetingRecord',
  meetingRecordSchema
);
