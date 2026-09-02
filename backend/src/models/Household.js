import mongoose from 'mongoose';

// ======================================================
// HOUSEHOLD SCHEMA
// ======================================================
// This schema supports household-based chamas where
// contributions are organized around families rather than
// treating every person independently.
// ======================================================

const householdSchema = new mongoose.Schema(
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
    // Household identification
    // ---------------------------------------------------
    household_number: {
      type: String,
      required: true,
      trim: true,
      index: true
    },

    // ---------------------------------------------------
    // Primary member (head of household)
    // ---------------------------------------------------
    primary_member_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      index: true
    },

    // ---------------------------------------------------
    // Household name
    // ---------------------------------------------------
    household_name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },

    // ---------------------------------------------------
    // Household contact information
    // ---------------------------------------------------
    primary_phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 20
    },
    secondary_phone: {
      type: String,
      trim: true,
      maxlength: 20
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 100
    },

    // ---------------------------------------------------
    // Residential address
    // ---------------------------------------------------
    residence: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    county: {
      type: String,
      trim: true,
      maxlength: 100
    },
    sub_county: {
      type: String,
      trim: true,
      maxlength: 100
    },
    village: {
      type: String,
      trim: true,
      maxlength: 100
    },
    landmark: {
      type: String,
      trim: true,
      maxlength: 200
    },

    // ---------------------------------------------------
    // Household members
    // ---------------------------------------------------
    members: [
      {
        membership_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'ChamaMembership',
          required: true
        },
        role_in_household: {
          type: String,
          enum: ['head', 'spouse', 'child', 'parent', 'other', 'custom'],
          required: true
        },
        custom_role: {
          type: String,
          trim: true,
          maxlength: 100
        },
        joined_household_at: {
          type: Date,
          default: Date.now
        },
        is_primary_contributor: {
          type: Boolean,
          default: false
        }
      }
    ],

    // ---------------------------------------------------
    // Household contribution configuration
    // ---------------------------------------------------
    contribution_config: {
      method: {
        type: String,
        enum: ['single_primary', 'split_members', 'combined'],
        default: 'single_primary'
      },
      primary_contributor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChamaMembership',
        default: null
      },
      contribution_split: [
        {
          membership_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChamaMembership',
            required: true
          },
          percentage: {
            type: Number,
            min: 0,
            max: 100,
            required: true
          },
          fixed_amount: {
            type: mongoose.Schema.Types.Decimal128,
            default: null
          }
        }
      ]
    },

    // ---------------------------------------------------
    // Household status
    // ---------------------------------------------------
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'dissolved'],
      default: 'active',
      index: true
    },

    // ---------------------------------------------------
    // Effective date range
    // ---------------------------------------------------
    established_date: {
      type: Date,
      required: true,
      default: Date.now
    },
    dissolved_date: {
      type: Date,
      default: null
    },

    // ---------------------------------------------------
    // Additional information
    // ---------------------------------------------------
    notes: {
      type: String,
      trim: true,
      maxlength: 1000
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

// Primary lookup
householdSchema.index({
  chama_id: 1,
  household_number: 1
}, { unique: true });

// Primary member lookup
householdSchema.index({
  chama_id: 1,
  primary_member_id: 1
});

// Active households
householdSchema.index({
  chama_id: 1,
  status: 1
});

// Member household lookup
householdSchema.index({
  chama_id: 1,
  'members.membership_id': 1
});

// Location-based lookup
householdSchema.index({
  chama_id: 1,
  county: 1,
  status: 1
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

householdSchema.pre('save', function(next) {
  // Validate contribution split percentages sum to 100
  if (this.contribution_config && this.contribution_config.contribution_split) {
    const totalPercentage = this.contribution_config.contribution_split.reduce(
      (sum, split) => sum + split.percentage,
      0
    );
    
    if (totalPercentage !== 100) {
      next(new Error('Contribution split percentages must sum to 100'));
      return;
    }
  }

  // Ensure primary member is in members array
  if (this.primary_member_id && this.members) {
    const hasPrimary = this.members.some(
      member => member.membership_id.toString() === this.primary_member_id.toString()
    );
    if (!hasPrimary) {
      this.members.push({
        membership_id: this.primary_member_id,
        role_in_household: 'head',
        is_primary_contributor: true
      });
    }
  }

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

householdSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Convert Decimal128 fields to strings
    if (ret.contribution_config && ret.contribution_config.contribution_split) {
      ret.contribution_config.contribution_split.forEach(split => {
        if (split.fixed_amount !== undefined && split.fixed_amount !== null) {
          split.fixed_amount = split.fixed_amount.toString();
        }
      });
    }

    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Household', householdSchema);