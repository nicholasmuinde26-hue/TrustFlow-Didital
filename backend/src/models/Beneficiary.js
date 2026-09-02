import mongoose from 'mongoose';

// ======================================================
// BENEFICIARY/DEPENDENT REGISTRY SCHEMA
// ======================================================
// This schema represents all persons linked to a member
// who may be eligible for burial/welfare benefits.
// ======================================================

const beneficiarySchema = new mongoose.Schema(
  {
    // ---------------------------------------------------
    // Reference to the member's chama membership
    // ---------------------------------------------------
    membership_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ChamaMembership',
      required: true,
      index: true
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
    // Personal Information
    // ---------------------------------------------------
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

    // ---------------------------------------------------
    // Relationship to member
    // ---------------------------------------------------
    relationship: {
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
      required: true,
      index: true
    },
    custom_relationship: {
      type: String,
      trim: true,
      maxlength: 100
    },

    // ---------------------------------------------------
    // Date of Birth and Age calculation
    // ---------------------------------------------------
    date_of_birth: {
      type: Date,
      required: true
    },
    age: {
      type: Number,
      min: 0,
      max: 150
    },

    // ---------------------------------------------------
    // Gender
    // ---------------------------------------------------
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: true
    },

    // ---------------------------------------------------
    // Contact Information
    // ---------------------------------------------------
    phone: {
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
    // Identification
    // ---------------------------------------------------
    national_id: {
      type: String,
      trim: true,
      maxlength: 50
    },
    other_identifier: {
      type: String,
      trim: true,
      maxlength: 100
    },
    identifier_type: {
      type: String,
      enum: ['national_id', 'passport', 'birth_certificate', 'other'],
      default: 'national_id'
    },

    // ---------------------------------------------------
    // Residence/Location
    // ---------------------------------------------------
    residence: {
      type: String,
      trim: true,
      maxlength: 200
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

    // ---------------------------------------------------
    // Dependant Status
    // ---------------------------------------------------
    is_dependant: {
      type: Boolean,
      default: false
    },
    dependant_since: {
      type: Date,
      default: null
    },

    // ---------------------------------------------------
    // Eligibility Status
    // ---------------------------------------------------
    eligibility_status: {
      type: String,
      enum: ['eligible', 'ineligible', 'pending_verification', 'suspended'],
      default: 'eligible',
      index: true
    },

    // ---------------------------------------------------
    // Effective Date Range
    // ---------------------------------------------------
    effective_from: {
      type: Date,
      required: true,
      default: Date.now
    },
    effective_to: {
      type: Date,
      default: null
    },

    // ---------------------------------------------------
    // Documents
    // ---------------------------------------------------
    documents: [
      {
        document_type: {
          type: String,
          enum: ['birth_certificate', 'id_copy', 'marriage_certificate', 'other'],
          required: true
        },
        document_url: String,
        document_number: String,
        uploaded_at: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // ---------------------------------------------------
    // Notes and additional information
    // ---------------------------------------------------
    notes: {
      type: String,
      trim: true,
      maxlength: 1000
    },

    // ---------------------------------------------------
    // Audit trail for changes
    // ---------------------------------------------------
    changed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    change_reason: {
      type: String,
      trim: true,
      maxlength: 500
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

    // ---------------------------------------------------
    // Previous record (for history tracking)
    // ---------------------------------------------------
    previous_beneficiary_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Beneficiary',
      default: null
    }
  },
  { timestamps: true }
);

// ======================================================
// INDEXES
// ======================================================

// Membership + active beneficiaries lookup
beneficiarySchema.index({
  membership_id: 1,
  eligibility_status: 1,
  effective_to: null
});

// Chama-wide beneficiary lookup
beneficiarySchema.index({
  chama_id: 1,
  relationship: 1,
  eligibility_status: 1
});

// Age-based queries for child eligibility
beneficiarySchema.index({
  chama_id: 1,
  relationship: 1,
  date_of_birth: 1
});

// Phone-based lookup for USSD
beneficiarySchema.index({
  chama_id: 1,
  phone: 1
});

// ID-based lookup
beneficiarySchema.index({
  chama_id: 1,
  national_id: 1
});

// History tracking
beneficiarySchema.index({
  membership_id: 1,
  effective_from: -1
});

// ======================================================
// PRE-SAVE HOOKS
// ======================================================

beneficiarySchema.pre('save', function(next) {
  // Calculate age from date of birth
  if (this.date_of_birth) {
    const today = new Date();
    const birthDate = new Date(this.date_of_birth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    this.age = age;
  }

  // Build full name
  this.full_name = `${this.first_name} ${this.other_names ? this.other_names + ' ' : ''}${this.last_name}`.trim();

  next();
});

// ======================================================
// JSON TRANSFORMATION
// ======================================================

beneficiarySchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Remove sensitive information if needed
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Beneficiary', beneficiarySchema);