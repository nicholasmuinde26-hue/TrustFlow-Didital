import mongoose from 'mongoose';

// ======================================================
// PENALTY WAIVER SCHEMA
// ======================================================
// Records approved/requested waivers for penalties.
// Designed for auditable Kenyan chama operations.
// ======================================================

const penaltyWaiverSchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the obligation that was penalized
    // ---------------------------------------------------
    obligation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionObligation',
      required: true
    },

    // ---------------------------------------------------
    // Reference to the payment that incurred the penalty
    // ---------------------------------------------------
    payment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPayment',
      default: null
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
    // Member reference
    // ---------------------------------------------------
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Original penalty details
    // ---------------------------------------------------
    original_penalty: {
      amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
      },

      currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },

      penalty_type: {
        type: String,
        enum: [
          'late_payment',
          'missed_payment',
          'returned_payment',
          'other'
        ],
        required: true
      },

      calculated_at: {
        type: Date,
        required: true
      },

      calculation_method: {
        type: String,
        trim: true
      }
    },

    // ---------------------------------------------------
    // Waiver details
    // ---------------------------------------------------
    waiver: {
      waived_amount: {
        type: mongoose.Schema.Types.Decimal128,
        required: true
      },

      waiver_percentage: {
        type: Number,
        min: 0,
        max: 100
      },

      waiver_type: {
        type: String,
        enum: ['full', 'partial', 'conditional'],
        required: true
      },

      reason: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
      },

      reason_category: {
        type: String,
        enum: [
          'hardship',
          'medical_emergency',
          'hospitalization',
          'bereavement',
          'natural_disaster',
          'system_error',
          'administrative_error',
          'good_standing',
          'special_circumstance',
          'other'
        ],
        required: true
      },

      supporting_documents: [
        {
          document_type: {
            type: String,
            enum: [
              'medical_report',
              'death_certificate',
              'disaster_report',
              'other'
            ]
          },

          document_url: {
            type: String,
            trim: true
          },

          description: {
            type: String,
            trim: true
          }
        }
      ]
    },

    // ---------------------------------------------------
    // Approval workflow
    // ---------------------------------------------------
    approval: {
      requested_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },

      requested_at: {
        type: Date,
        default: Date.now
      },

      approved_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },

      approved_at: {
        type: Date,
        default: null
      },

      approval_role: {
        type: String,
        enum: [
          'chairperson',
          'treasurer',
          'secretary',
          'committee_member',
          'custom'
        ],
        default: null
      },

      // -------------------------------------------------
      // Committee approval
      // -------------------------------------------------
      committee_approval: {
        required: {
          type: Boolean,
          default: false
        },

        meeting_date: {
          type: Date,
          default: null
        },

        committee_members: [
          {
            membership_id: {
              type: mongoose.Schema.Types.ObjectId,
              ref: 'ChamaMembership'
            },

            vote: {
              type: String,
              enum: [
                'approved',
                'rejected',
                'abstained'
              ]
            },

            comments: {
              type: String,
              trim: true
            }
          }
        ]
      },

      // -------------------------------------------------
      // Approval status
      // -------------------------------------------------
      status: {
        type: String,
        enum: [
          'pending',
          'approved',
          'rejected',
          'cancelled'
        ],
        default: 'pending',
        index: true
      },

      rejection_reason: {
        type: String,
        trim: true,
        maxlength: 500
      }
    },

    // ---------------------------------------------------
    // Effective period
    // ---------------------------------------------------
    effective_from: {
      type: Date,
      default: Date.now
    },

    effective_to: {
      type: Date,
      default: null
    },

    // ---------------------------------------------------
    // Conditions for conditional waiver
    // ---------------------------------------------------
    conditions: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },

    conditions_met: {
      type: Boolean,
      default: null
    },

    conditions_checked_at: {
      type: Date,
      default: null
    },

    // ---------------------------------------------------
    // Audit / notes
    // ---------------------------------------------------
    notes: {
      type: String,
      trim: true,
      maxlength: 1000
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
  {
    timestamps: true
  }
);

// ======================================================
// INDEXES
// ======================================================

// Primary lookup
penaltyWaiverSchema.index({
  chama_id: 1,
  'approval.status': 1,
  createdAt: -1
});

// Obligation lookup
penaltyWaiverSchema.index({
  obligation_id: 1
});

// Member waiver history
penaltyWaiverSchema.index({
  membership_id: 1,
  'approval.status': 1,
  createdAt: -1
});

// Date-based queries
penaltyWaiverSchema.index({
  chama_id: 1,
  effective_from: -1
});

// Approval workflow
penaltyWaiverSchema.index({
  'approval.requested_by': 1,
  'approval.status': 1
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

penaltyWaiverSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 values to strings
    const decimalFields = [
      ['original_penalty', 'amount'],
      ['waiver', 'waived_amount']
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

    // Remove mongoose version field
    delete ret.__v;

    return ret;
  }
});

// ======================================================
// MODEL
// ======================================================

export default mongoose.model(
  'PenaltyWaiver',
  penaltyWaiverSchema
);