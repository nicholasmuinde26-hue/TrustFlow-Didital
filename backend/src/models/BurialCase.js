import mongoose from 'mongoose';

// ======================================================
// BURIAL CASE SCHEMA
// ======================================================
// This schema represents a burial or welfare case
// with complete lifecycle management from reporting
// to disbursement.
// ======================================================

const burialCaseSchema = new mongoose.Schema(
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
    // Reference to burial chama profile
    // ---------------------------------------------------
    burial_chama_profile_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BurialChamaProfile',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Case identification
    // ---------------------------------------------------
    case_number: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    // ---------------------------------------------------
    // Case type
    // ---------------------------------------------------
    case_type: {
      type: String,
      enum: [
        'member_death',
        'spouse_death',
        'child_death',
        'parent_death',
        'dependant_death',
        'other_covered_person_death',
        'emergency_welfare',
        'custom'
      ],
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Deceased person information
    // ---------------------------------------------------
    deceased: {
      beneficiary_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Beneficiary',
        default: null
      },
      first_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      last_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      other_names: {
        type: String,
        trim: true,
        maxlength: 100
      },
      full_name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 300
      },
      relationship_to_member: {
        type: String,
        enum: [
          'self',
          'spouse',
          'child',
          'parent',
          'sibling',
          'guardian',
          'grandparent',
          'dependant',
          'adopted_child',
          'custom'
        ],
        required: true
      },
      date_of_birth: {
        type: Date,
        required: true
      },
      date_of_death: {
        type: Date,
        required: true
      },
      national_id: {
        type: String,
        trim: true,
        maxlength: 50
      },
      cause_of_death: {
        type: String,
        trim: true,
        maxlength: 200
      }
    },

    // ---------------------------------------------------
    // Member associated with the case
    // ---------------------------------------------------
    member: {
      membership_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership',
        required: true,
        index: true
      },
      user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      first_name: {
        type: String,
        required: true,
        trim: true
      },
      last_name: {
        type: String,
        required: true,
        trim: true
      },
      phone: {
        type: String,
        trim: true
      }
    },

    // ---------------------------------------------------
    // Claimant information
    // ---------------------------------------------------
    claimant: {
      name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
      },
      relationship: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      phone: {
        type: String,
        required: true,
        trim: true
      },
      email: {
        type: String,
        trim: true,
        lowercase: true
      },
      national_id: {
        type: String,
        trim: true,
        maxlength: 50
      }
    },

    // ---------------------------------------------------
    // Case lifecycle status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: [
        'reported',
        'under_review',
        'documentation_required',
        'verified',
        'eligibility_check',
        'benefit_calculated',
        'committee_review',
        'approved',
        'payment_authorized',
        'disbursement',
        'confirmed',
        'closed',
        'rejected',
        'appeal',
        'cancelled'
      ],
      default: 'reported',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Case lifecycle timestamps
    // ---------------------------------------------------
    reported_at: {
      type: Date,
      default: Date.now
    },
    reported_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    under_review_at: {
      type: Date,
      default: null
    },
    verified_at: {
      type: Date,
      default: null
    },
    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
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
    rejected_at: {
      type: Date,
      default: null
    },
    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    rejection_reason: {
      type: String,
      trim: true,
      maxlength: 1000
    },
    closed_at: {
      type: Date,
      default: null
    },
    closed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // ---------------------------------------------------
    // Benefit calculation
    // ---------------------------------------------------
    benefit: {
      calculated_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      approved_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      currency: {
        type: String,
        default: 'KES',
        uppercase: true,
        trim: true
      },
      calculation_method: {
        type: String,
        trim: true
      },
      calculation_details: {
        type: mongoose.Schema.Types.Mixed
      }
    },

    // ---------------------------------------------------
    // Eligibility check results
    // ---------------------------------------------------
    eligibility: {
      is_eligible: {
        type: Boolean,
        default: null
      },
      checked_at: {
        type: Date,
        default: null
      },
      checked_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      waiting_period_satisfied: {
        type: Boolean,
        default: null
      },
      contribution_status: {
        type: String,
        trim: true
      },
      arrears_impact: {
        type: String,
        trim: true
      },
      reasons: [
        {
          type: String,
          trim: true
        }
      ]
    },

    // ---------------------------------------------------
    // Required documents
    // ---------------------------------------------------
    documents: [
      {
        document_type: {
          type: String,
          enum: [
            'death_certificate',
            'death_notification',
            'member_id',
            'national_id',
            'relationship_proof',
            'chiefs_letter',
            'hospital_document',
            'burial_permit',
            'other'
          ],
          required: true
        },
        document_url: String,
        document_number: String,
        status: {
          type: String,
          enum: ['pending', 'submitted', 'verified', 'rejected'],
          default: 'pending'
        },
        submitted_at: {
          type: Date,
          default: null
        },
        verified_at: {
          type: Date,
          default: null
        },
        verified_by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        notes: {
          type: String,
          trim: true,
          maxlength: 500
        }
      }
    ],

    // ---------------------------------------------------
    // Committee review
    // ---------------------------------------------------
    committee_review: {
      required: {
        type: Boolean,
        default: true
      },
      meeting_date: {
        type: Date,
        default: null
      },
      quorum_met: {
        type: Boolean,
        default: null
      },
      votes: [
        {
          committee_member_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership'
          },
          vote: {
            type: String,
            enum: ['yes', 'no', 'abstain']
          },
          voted_at: {
            type: Date,
            default: Date.now
          },
          comments: {
            type: String,
            trim: true,
            maxlength: 500
          }
        }
      ],
      total_votes: {
        type: Number,
        default: 0
      },
      yes_votes: {
        type: Number,
        default: 0
      },
      no_votes: {
        type: Number,
        default: 0
      },
      abstain_votes: {
        type: Number,
        default: 0
      },
      approved: {
        type: Boolean,
        default: null
      },
      notes: {
        type: String,
        trim: true,
        maxlength: 1000
      }
    },

    // ---------------------------------------------------
    // Emergency case handling
    // ---------------------------------------------------
    emergency: {
      is_emergency: {
        type: Boolean,
        default: false
      },
      emergency_type: {
        type: String,
        enum: ['immediate_burial', 'medical_emergency', 'other'],
        default: null
      },
      temporary_authorized: {
        type: Boolean,
        default: false
      },
      temporary_authorized_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      temporary_authorized_at: {
        type: Date,
        default: null
      },
      temporary_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      ratification_required: {
        type: Boolean,
        default: true
      },
      ratified: {
        type: Boolean,
        default: false
      },
      ratified_at: {
        type: Date,
        default: null
      }
    },

    // ---------------------------------------------------
    // Fundraising campaign
    // ---------------------------------------------------
    fundraising: {
      enabled: {
        type: Boolean,
        default: false
      },
      target_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      raised_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null
      },
      contributions: [
        {
          contributor_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership'
          },
          contributor_name: {
            type: String,
            trim: true
          },
          amount: {
            type: mongoose.Schema.Types.Decimal128,
            required: true
          },
          pledged_at: {
            type: Date,
            default: Date.now
          },
          paid: {
            type: Boolean,
            default: false
          },
          paid_at: {
            type: Date,
            default: null
          },
          anonymous: {
            type: Boolean,
            default: false
          }
        }
      ],
      external_contributions: [
        {
          contributor_name: {
            type: String,
            trim: true
          },
          amount: {
            type: mongoose.Schema.Types.Decimal128,
            required: true
          },
          contributed_at: {
            type: Date,
            default: Date.now
          },
          notes: {
            type: String,
            trim: true
          }
        }
      ]
    },

    // ---------------------------------------------------
    // Payment and disbursement
    // ---------------------------------------------------
    disbursement: {
      payment_recipient: {
        type: String,
        trim: true,
        maxlength: 200
      },
      payment_recipient_relationship: {
        type: String,
        trim: true
      },
      payment_method: {
        type: String,
        enum: ['mpesa', 'bank_transfer', 'cash', 'check'],
        default: 'mpesa'
      },
      payment_details: {
        type: mongoose.Schema.Types.Mixed
      },
      authorized_at: {
        type: Date,
        default: null
      },
      authorized_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      disbursed_at: {
        type: Date,
        default: null
      },
      disbursed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
      },
      transaction_reference: {
        type: String,
        trim: true
      },
      financial_transaction_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialTransaction',
        default: null
      }
    },

    // ---------------------------------------------------
    // Multiple beneficiary distribution
    // ---------------------------------------------------
    beneficiary_distribution: [
      {
        beneficiary_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Beneficiary'
        },
        beneficiary_name: {
          type: String,
          trim: true
        },
        relationship: {
          type: String,
          trim: true
        },
        percentage: {
          type: Number,
          min: 0,
          max: 100
        },
        amount: {
          type: mongoose.Schema.Types.Decimal128,
          required: true
        },
        paid: {
          type: Boolean,
          default: false
        },
        paid_at: {
          type: Date,
          default: null
        }
      }
    ],

    // ---------------------------------------------------
    // Funeral details
    // ---------------------------------------------------
    funeral_details: {
      funeral_date: {
        type: Date,
        default: null
      },
      funeral_location: {
        type: String,
        trim: true,
        maxlength: 300
      },
      home_county: {
        type: String,
        trim: true
      },
      attendance: {
        type: Number,
        default: null
      },
      chama_representatives: [
        {
          membership_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership'
          },
          name: {
            type: String,
            trim: true
          },
          role: {
            type: String,
            trim: true
          }
        }
      ]
    },

    // ---------------------------------------------------
    // Notes and additional information
    // ---------------------------------------------------
    notes: {
      type: String,
      trim: true,
      maxlength: 2000
    },

    // ---------------------------------------------------
    // Audit trail
    // ---------------------------------------------------
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
  { timestamps: true }
);

// ======================================================
// INDEXES
// ======================================================

// Primary lookups
burialCaseSchema.index({
  chama_id: 1,
  status: 1,
  createdAt: -1
});

burialCaseSchema.index({
  burial_chama_profile_id: 1,
  status: 1
});

// Member cases
burialCaseSchema.index({
  'member.membership_id': 1,
  status: 1,
  createdAt: -1
});

// Date-based queries
burialCaseSchema.index({
  chama_id: 1,
  'deceased.date_of_death': -1
});

// Status-based workflow
burialCaseSchema.index({
  status: 1,
  reported_at: -1
});

// Emergency cases
burialCaseSchema.index({
  chama_id: 1,
  'emergency.is_emergency': 1,
  status: 1
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

burialCaseSchema.pre('save', function(next) {
  // Build full name for deceased
  if (this.deceased) {
    this.deceased.full_name = `${this.deceased.first_name} ${this.deceased.other_names ? this.deceased.other_names + ' ' : ''}${this.deceased.last_name}`.trim();
  }

  // Calculate committee vote totals
  if (this.committee_review && this.committee_review.votes) {
    const votes = this.committee_review.votes;
    this.committee_review.total_votes = votes.length;
    this.committee_review.yes_votes = votes.filter(v => v.vote === 'yes').length;
    this.committee_review.no_votes = votes.filter(v => v.vote === 'no').length;
    this.committee_review.abstain_votes = votes.filter(v => v.vote === 'abstain').length;
  }

  // Calculate fundraising total
  if (this.fundraising && this.fundraising.contributions) {
    let total = 0;
    this.fundraising.contributions.forEach(contrib => {
      if (contrib.amount) {
        total += parseFloat(contrib.amount.toString());
      }
    });
    this.fundraising.raised_amount = total;
  }

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

burialCaseSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    const decimalFields = [
      'benefit.calculated_amount',
      'benefit.approved_amount',
      'emergency.temporary_amount',
      'fundraising.target_amount',
      'fundraising.raised_amount',
      'beneficiary_distribution.amount'
    ];
    
    decimalFields.forEach(field => {
      const parts = field.split('.');
      let obj = ret;
      for (let i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]]) {
          obj = obj[parts[i]];
        } else {
          return;
        }
      }
      if (obj[parts[parts.length - 1]] !== undefined && obj[parts[parts.length - 1]] !== null) {
        obj[parts[parts.length - 1]] = obj[parts[parts.length - 1]].toString();
      }
    });

    // Handle nested decimal fields in arrays
    if (ret.fundraising && ret.fundraising.contributions) {
      ret.fundraising.contributions.forEach(contrib => {
        if (contrib.amount !== undefined && contrib.amount !== null) {
          contrib.amount = contrib.amount.toString();
        }
      });
    }

    if (ret.fundraising && ret.fundraising.external_contributions) {
      ret.fundraising.external_contributions.forEach(contrib => {
        if (contrib.amount !== undefined && contrib.amount !== null) {
          contrib.amount = contrib.amount.toString();
        }
      });
    }

    if (ret.beneficiary_distribution) {
      ret.beneficiary_distribution.forEach(beneficiary => {
        if (beneficiary.amount !== undefined && beneficiary.amount !== null) {
          beneficiary.amount = beneficiary.amount.toString();
        }
      });
    }

    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('BurialCase', burialCaseSchema);