
import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION PAYMENT MODEL
// ========================================
//
// Financial lifecycle:
//
// ContributionObligation
//        │
//        │ amount expected
//        ▼
// ContributionPayment
//        │
//        ├── Payment Channel
//        │      ├── Cash
//        │      ├── M-Pesa
//        │      ├── Mobile Money
//        │      ├── Bank
//        │      ├── Card
//        │      └── Transfer
//        │
//        ├── Payment Instrument Snapshot
//        ├── Payment Provider
//        ├── Payment Attempt Lifecycle
//        └── FinancialTransaction
//
// Reversal:
//
// ContributionPayment
//        │
//        ▼
// ContributionPaymentReversal
//        │
//        ├── Compensating FinancialTransaction
//        └── Obligation balance restored
//
// ========================================


// ========================================
// CONSTANTS
// ========================================

const OWNER_TYPES = [
  'Chama',
  'ContributionGroup'
];

const PARTICIPANT_TYPES = [
  'ChamaMembership',
  'ContributionGroupMember'
];

const PAYMENT_METHODS = [
  'cash',
  'bank',
  'mpesa',
  'mobile_money',
  'card',
  'transfer',
  'other'
];

const PAYMENT_STATUSES = [
  'pending',
  'completed',
  'failed',
  'reversed',
  'cancelled'
];

const CHANNEL_TYPES = [
  'cash',
  'mpesa',
  'mobile_money',
  'bank_account',
  'bank_transfer',
  'card',
  'internal_transfer',
  'other'
];

const PROCESSING_MODES = [
  'manual',
  'automated',
  'webhook'
];

const PAYMENT_PROVIDERS = [
  'mpesa',
  'airtel_money',
  'pesapal',
  'stripe',
  'card_processor',
  'bank',
  'internal',
  'cash',
  'other'
];

const PAYMENT_INSTRUMENT_TYPES = [
  'cash',
  'phone_number',
  'mobile_money_account',
  'bank_account',
  'card',
  'account',
  'other'
];

const PAYMENT_ATTEMPT_STATUSES = [
  'initiated',
  'pending',
  'processing',
  'completed',
  'failed',
  'cancelled',
  'expired'
];

const PAYMENT_DIRECTIONS = [
  'inbound'
];


// ========================================
// CONTRIBUTION PAYMENT SCHEMA
// ========================================

const contributionPaymentSchema = new mongoose.Schema(
  {

    // ========================================
    // CONTRIBUTION OBLIGATION
    // ========================================

    obligation_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionObligation',
      required: true,
      index: true
    },


    // ========================================
    // CONTRIBUTION PLAN
    // ========================================

    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ContributionPlan',
      required: true,
      index: true
    },


    // ========================================
    // OWNER TYPE
    // ========================================

    owner_type: {
      type: String,
      enum: OWNER_TYPES,
      required: true,
      index: true
    },


    // ========================================
    // OWNER ID
    // ========================================

    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },


    // ========================================
    // PARTICIPANT TYPE
    // ========================================

    participant_type: {
      type: String,
      enum: PARTICIPANT_TYPES,
      required: true,
      index: true
    },


    // ========================================
    // PARTICIPANT ID
    // ========================================

    participant_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },


    // ========================================
    // PAYMENT DIRECTION
    // ========================================

    payment_direction: {
      type: String,
      enum: PAYMENT_DIRECTIONS,
      required: true,
      default: 'inbound'
    },


    // ========================================
    // PAYMENT AMOUNT
    // ========================================

    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      min: 0.01
    },


    // ========================================
    // CURRENCY
    // ========================================

    currency: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      default: 'KES'
    },


    // ========================================
    // PAYMENT METHOD
    // ========================================

    payment_method: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      index: true
    },


    // ========================================
    // CHANNEL TYPE
    // ========================================

    channel_type: {
      type: String,
      enum: CHANNEL_TYPES,
      required: true,
      index: true
    },


    // ========================================
    // PROCESSING MODE
    // ========================================

    processing_mode: {
      type: String,
      enum: PROCESSING_MODES,
      required: true,
      default: 'manual'
    },


    // ========================================
    // PAYMENT PROVIDER
    // ========================================

    payment_provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: null,
      index: true
    },


    // ========================================
    // PROVIDER PAYMENT ID
    // ========================================

    provider_payment_id: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null
    },


    // ========================================
    // EXTERNAL PAYMENT REFERENCE
    // ========================================

    external_reference: {
      type: String,
      trim: true,
      maxlength: 150,
      default: null,
      index: true
    },


    // ========================================
    // INTERNAL PAYMENT REFERENCE
    // ========================================

    reference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },


    // ========================================
    // PAYMENT INSTRUMENT SNAPSHOT
    // ========================================

    payment_instrument: {

      instrument_type: {
        type: String,
        enum: PAYMENT_INSTRUMENT_TYPES,
        default: null
      },

      provider: {
        type: String,
        trim: true,
        maxlength: 100,
        default: null
      },

      display_label: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
      },

      phone_number: {
        type: String,
        trim: true,
        maxlength: 30,
        default: null
      },

      bank_name: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
      },

      bank_account_name: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
      },

      bank_account_last4: {
        type: String,
        trim: true,
        maxlength: 4,
        default: null
      },

      card_brand: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null
      },

      card_last4: {
        type: String,
        trim: true,
        maxlength: 4,
        default: null
      },

      provider_customer_id: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null
      },

      provider_instrument_id: {
        type: String,
        trim: true,
        maxlength: 200,
        default: null
      }

    },


    // ========================================
    // PAYMENT STATUS
    // ========================================

    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      required: true,
      default: 'pending',
      index: true
    },


    // ========================================
    // PAYMENT DATE
    // ========================================

    paid_at: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },


    // ========================================
    // INITIATED AT
    // ========================================

    initiated_at: {
      type: Date,
      default: null
    },


    // ========================================
    // COMPLETED AT
    // ========================================

    completed_at: {
      type: Date,
      default: null,
      index: true
    },


    // ========================================
    // FAILED AT
    // ========================================

    failed_at: {
      type: Date,
      default: null
    },


    // ========================================
    // FAILURE CODE
    // ========================================

    failure_code: {
      type: String,
      trim: true,
      maxlength: 100,
      default: null
    },


    // ========================================
    // FAILURE MESSAGE
    // ========================================

    failure_message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },


    // ========================================
    // PAYMENT RECORDED BY
    // ========================================

    recorded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },


    // ========================================
    // PAYMENT CREATED BY
    // ========================================

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },


    // ========================================
    // PAYMENT VERIFIED BY
    // ========================================

    verified_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },


    // ========================================
    // PAYMENT VERIFIED AT
    // ========================================

    verified_at: {
      type: Date,
      default: null
    },


    // ========================================
    // FINANCIAL TRANSACTION
    // ========================================

    financial_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },


    // ========================================
    // REVERSAL TRANSACTION
    // ========================================

    reversal_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FinancialTransaction',
      default: null
    },


    // ========================================
    // REVERSAL
    // ========================================

    reversed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },


    // ========================================
    // REVERSED AT
    // ========================================

    reversed_at: {
      type: Date,
      default: null
    },


    // ========================================
    // REVERSAL REASON
    // ========================================

    reversal_reason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null
    },


    // ========================================
    // PAYMENT ATTEMPTS
    // ========================================

    attempts: [
      {

        attempt_number: {
          type: Number,
          required: true
        },

        status: {
          type: String,
          enum: PAYMENT_ATTEMPT_STATUSES,
          required: true,
          default: 'initiated'
        },

        provider: {
          type: String,
          enum: PAYMENT_PROVIDERS,
          default: null
        },

        channel_type: {
          type: String,
          enum: CHANNEL_TYPES,
          required: true
        },

        external_reference: {
          type: String,
          trim: true,
          maxlength: 150,
          default: null
        },

        provider_payment_id: {
          type: String,
          trim: true,
          maxlength: 200,
          default: null
        },

        instrument_snapshot: {

          instrument_type: {
            type: String,
            enum: PAYMENT_INSTRUMENT_TYPES,
            default: null
          },

          display_label: {
            type: String,
            trim: true,
            maxlength: 150,
            default: null
          },

          phone_number: {
            type: String,
            trim: true,
            maxlength: 30,
            default: null
          },

          bank_name: {
            type: String,
            trim: true,
            maxlength: 150,
            default: null
          },

          bank_account_last4: {
            type: String,
            trim: true,
            maxlength: 4,
            default: null
          },

          card_brand: {
            type: String,
            trim: true,
            maxlength: 50,
            default: null
          },

          card_last4: {
            type: String,
            trim: true,
            maxlength: 4,
            default: null
          }

        },

        started_at: {
          type: Date,
          default: Date.now
        },

        completed_at: {
          type: Date,
          default: null
        },

        failure_code: {
          type: String,
          trim: true,
          maxlength: 100,
          default: null
        },

        failure_message: {
          type: String,
          trim: true,
          maxlength: 500,
          default: null
        }

      }
    ],


    // ========================================
    // DESCRIPTION / NOTES
    // ========================================

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    }

  },

  {
    timestamps: true
  }

);


// ========================================
// COMPOUND INDEXES
// ========================================

contributionPaymentSchema.index({
  obligation_id: 1,
  status: 1,
  paid_at: -1,
  createdAt: -1
});

contributionPaymentSchema.index({
  owner_type: 1,
  owner_id: 1,
  status: 1,
  paid_at: -1,
  createdAt: -1
});

contributionPaymentSchema.index({
  participant_type: 1,
  participant_id: 1,
  status: 1,
  paid_at: -1,
  createdAt: -1
});

contributionPaymentSchema.index({
  owner_type: 1,
  owner_id: 1,
  payment_method: 1,
  status: 1,
  createdAt: -1
});

contributionPaymentSchema.index({
  payment_provider: 1,
  provider_payment_id: 1
});

contributionPaymentSchema.index(
  {
    owner_type: 1,
    owner_id: 1,
    external_reference: 1
  },
  {
    unique: true,
    sparse: true,
    name: 'unique_external_reference_per_owner'
  }
);

contributionPaymentSchema.index(
  {
    financial_transaction_id: 1
  },
  {
    name: 'contribution_payment_financial_transaction_lookup'
  }
);

contributionPaymentSchema.index(
  {
    reversal_transaction_id: 1
  },
  {
    name: 'contribution_payment_reversal_transaction_lookup'
  }
);

contributionPaymentSchema.index({
  obligation_id: 1,
  participant_type: 1,
  participant_id: 1
});


// ========================================
// PRE-VALIDATION
// ========================================
//
// IMPORTANT:
//
// Promise/synchronous middleware is used here.
// There is intentionally NO next().
//
// Throwing an Error causes Mongoose validation
// to fail correctly and propagates the error
// through document.save().
//
// ========================================

contributionPaymentSchema.pre(
  'validate',
  function () {

    // ======================================
    // OWNER / PARTICIPANT COMPATIBILITY
    // ======================================

    if (
      this.owner_type === 'Chama' &&
      this.participant_type !== 'ChamaMembership'
    ) {
      throw new Error(
        'Chama contribution payments must use ChamaMembership participants'
      );
    }

    if (
      this.owner_type === 'ContributionGroup' &&
      this.participant_type !== 'ContributionGroupMember'
    ) {
      throw new Error(
        'ContributionGroup contribution payments must use ContributionGroupMember participants'
      );
    }


    // ======================================
    // PAYMENT METHOD / CHANNEL CONSISTENCY
    // ======================================

    if (
      this.payment_method === 'mpesa' &&
      !['mpesa', 'mobile_money'].includes(this.channel_type)
    ) {
      throw new Error(
        'M-Pesa payments must use mpesa or mobile_money channel types'
      );
    }

    if (
      this.payment_method === 'card' &&
      this.channel_type !== 'card'
    ) {
      throw new Error(
        'Card payments must use the card channel type'
      );
    }

    if (
      this.payment_method === 'bank' &&
      !['bank_account', 'bank_transfer'].includes(this.channel_type)
    ) {
      throw new Error(
        'Bank payments must use bank_account or bank_transfer channel types'
      );
    }


    // ======================================
    // PAYMENT PROVIDER CONSISTENCY
    // ======================================

    if (
      this.processing_mode !== 'manual' &&
      !this.payment_provider
    ) {
      throw new Error(
        'Automated or webhook payments must have a payment provider'
      );
    }


    // ======================================
    // PAYMENT INSTRUMENT CONSISTENCY
    // ======================================

    if (
      this.payment_instrument?.instrument_type === 'phone_number' &&
      !this.payment_instrument?.phone_number
    ) {
      throw new Error(
        'Phone number is required for phone_number payment instruments'
      );
    }

    if (
      this.payment_instrument?.instrument_type === 'bank_account' &&
      !this.payment_instrument?.bank_account_last4
    ) {
      throw new Error(
        'Bank account last four digits are required for bank account payment instruments'
      );
    }

    if (
      this.payment_instrument?.instrument_type === 'card' &&
      !this.payment_instrument?.card_last4
    ) {
      throw new Error(
        'Card last four digits are required for card payment instruments'
      );
    }


    // ======================================
    // VERIFICATION CONSISTENCY
    // ======================================

    if (
      this.verified_by &&
      !this.verified_at
    ) {
      throw new Error(
        'verified_at is required when verified_by is set'
      );
    }

    if (
      this.verified_at &&
      !this.verified_by
    ) {
      throw new Error(
        'verified_by is required when verified_at is set'
      );
    }


    // ======================================
    // COMPLETION CONSISTENCY
    // ======================================

    if (
      this.status === 'completed' &&
      !this.financial_transaction_id
    ) {
      throw new Error(
        'Completed contribution payments must have a financial transaction'
      );
    }


    // ======================================
    // COMPLETED AT CONSISTENCY
    // ======================================

    if (
      this.status === 'completed' &&
      !this.completed_at
    ) {
      throw new Error(
        'Completed contribution payments must have completed_at'
      );
    }


    // ======================================
    // FAILED PAYMENT CONSISTENCY
    // ======================================

    if (
      this.status === 'failed' &&
      !this.failed_at
    ) {
      throw new Error(
        'Failed contribution payments must have failed_at'
      );
    }


    // ======================================
    // REVERSAL CONSISTENCY
    // ======================================

    if (
      this.reversed_by &&
      !this.reversed_at
    ) {
      throw new Error(
        'reversed_at is required when reversed_by is set'
      );
    }

    if (
      this.reversed_at &&
      !this.reversed_by
    ) {
      throw new Error(
        'reversed_by is required when reversed_at is set'
      );
    }

    if (
      this.reversal_reason &&
      !this.reversed_by
    ) {
      throw new Error(
        'reversed_by is required when reversal_reason is set'
      );
    }


    // ======================================
    // REVERSED STATUS CONSISTENCY
    // ======================================

    if (
      this.status === 'reversed' &&
      !this.reversed_by
    ) {
      throw new Error(
        'Reversed contribution payments must have reversed_by'
      );
    }

    if (
      this.status === 'reversed' &&
      !this.reversed_at
    ) {
      throw new Error(
        'Reversed contribution payments must have reversed_at'
      );
    }

    if (
      this.status === 'reversed' &&
      !this.reversal_transaction_id
    ) {
      throw new Error(
        'Reversed contribution payments must have a reversal transaction'
      );
    }


    // ======================================
    // PAYMENT ATTEMPT NUMBER VALIDATION
    // ======================================

    if (this.attempts?.length) {

      const attemptNumbers = this.attempts.map(
        attempt => attempt.attempt_number
      );

      const uniqueAttemptNumbers = new Set(
        attemptNumbers
      );

      if (
        uniqueAttemptNumbers.size !==
        attemptNumbers.length
      ) {
        throw new Error(
          'Payment attempt numbers must be unique'
        );
      }
    }

  }
);


// ========================================
// JSON TRANSFORMATION
// ========================================

contributionPaymentSchema.set(
  'toJSON',
  {
    transform: (_doc, ret) => {

      if (
        ret.amount !== undefined &&
        ret.amount !== null
      ) {
        ret.amount = ret.amount.toString();
      }

      return ret;
    }
  }
);


// ========================================
// MODEL
// ========================================
//
// Safe for nodemon / hot reload environments.
//
// ========================================

const ContributionPayment =
  mongoose.models.ContributionPayment ||
  mongoose.model(
    'ContributionPayment',
    contributionPaymentSchema
  );


// ========================================
// EXPORT
// ========================================

export default ContributionPayment;


// ========================================
// EXPORT CONSTANTS
// ========================================

export {
  OWNER_TYPES,
  PARTICIPANT_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  CHANNEL_TYPES,
  PROCESSING_MODES,
  PAYMENT_PROVIDERS,
  PAYMENT_INSTRUMENT_TYPES,
  PAYMENT_ATTEMPT_STATUSES,
  PAYMENT_DIRECTIONS
};
