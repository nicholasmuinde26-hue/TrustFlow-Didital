
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
//        │      ├── Phone Number
//        │      ├── Bank Account
//        │      ├── Card
//        │      └── Other
//        │
//        ├── Payment Provider
//        │
//        ├── Payment Attempt Lifecycle
//        │
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
// IMPORTANT:
//
// The original payment and original financial
// transaction are never deleted.
//
// Reversal is represented as a separate
// accounting event.
//
// IMPORTANT:
//
// Payment channel information is SNAPSHOTTED.
//
// A participant may change:
//    - M-Pesa number
//    - Bank account
//    - Card
//    - Mobile money account
//    - Preferred payment method
//
// Historical payments must remain associated
// with the exact payment instrument used when
// the payment was created.
//
// Therefore:
//
// Current Participant Profile
//        │
//        └── May change over time
//
// Historical ContributionPayment
//        │
//        └── Immutable payment channel snapshot
//
// ========================================


// ========================================
// CONSTANTS
// ========================================


// ========================================
// OWNER TYPES
// ========================================

const OWNER_TYPES = [
  'Chama',
  'ContributionGroup'
];


// ========================================
// PARTICIPANT TYPES
// ========================================

const PARTICIPANT_TYPES = [
  'ChamaMembership',
  'ContributionGroupMember'
];


// ========================================
// PAYMENT METHODS
// ========================================
//
// High-level payment method.
//
// This describes the financial channel used
// to settle the contribution.
//
// ========================================

const PAYMENT_METHODS = [

  'cash',

  'bank',

  'mpesa',

  'mobile_money',

  'card',

  'transfer',

  'other'

];


// ========================================
// PAYMENT STATUSES
// ========================================
//
// Payment lifecycle:
//
// pending
//    │
//    ├── completed
//    │      │
//    │      └── reversed
//    │
//    ├── failed
//    │
//    └── cancelled
//
// ========================================

const PAYMENT_STATUSES = [

  'pending',

  'completed',

  'failed',

  'reversed',

  'cancelled'

];


// ========================================
// PAYMENT CHANNEL TYPES
// ========================================
//
// More detailed routing classification.
//
// payment_method remains the broad
// accounting/payment method.
//
// channel_type identifies the actual
// operational channel.
//
// ========================================

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


// ========================================
// PAYMENT PROCESSING MODES
// ========================================
//
// manual
//    Payment recorded by an authorized user.
//
// automated
//    Payment initiated and processed by
//    an external payment provider.
//
// webhook
//    Payment completion received through
//    provider callback/webhook.
//
// ========================================

const PROCESSING_MODES = [

  'manual',

  'automated',

  'webhook'

];


// ========================================
// PAYMENT PROVIDERS
// ========================================
//
// This is intentionally extensible.
//
// Examples:
//
// mpesa
// airtel_money
// pesapal
// stripe
// card_processor
// bank
// internal
// cash
// other
//
// ========================================

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


// ========================================
// PAYMENT INSTRUMENT TYPES
// ========================================
//
// Identifies the exact source/destination
// instrument used for the payment.
//
// ========================================

const PAYMENT_INSTRUMENT_TYPES = [

  'cash',

  'phone_number',

  'mobile_money_account',

  'bank_account',

  'card',

  'account',

  'other'

];


// ========================================
// PAYMENT ATTEMPT STATUSES
// ========================================
//
// A ContributionPayment represents the
// business-level payment.
//
// Payment attempts represent operational
// processing attempts.
//
// Example:
//
// Payment
//    │
//    ├── Attempt 1 → failed
//    │
//    └── Attempt 2 → completed
//
// ========================================

const PAYMENT_ATTEMPT_STATUSES = [

  'initiated',

  'pending',

  'processing',

  'completed',

  'failed',

  'cancelled',

  'expired'

];


// ========================================
// PAYMENT DIRECTION
// ========================================
//
// contribution payments normally represent
// money entering the organization's financial
// system.
//
// ========================================

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

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'ContributionObligation',

      required:
        true,

      index:
        true

    },


    // ========================================
    // CONTRIBUTION PLAN
    // ========================================

    plan_id: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'ContributionPlan',

      required:
        true,

      index:
        true

    },


    // ========================================
    // OWNER TYPE
    // ========================================

    owner_type: {

      type:
        String,

      enum:
        OWNER_TYPES,

      required:
        true,

      index:
        true

    },


    // ========================================
    // OWNER ID
    // ========================================

    owner_id: {

      type:
        mongoose.Schema.Types.ObjectId,

      required:
        true,

      index:
        true

    },


    // ========================================
    // PARTICIPANT TYPE
    // ========================================

    participant_type: {

      type:
        String,

      enum:
        PARTICIPANT_TYPES,

      required:
        true,

      index:
        true

    },


    // ========================================
    // PARTICIPANT ID
    // ========================================

    participant_id: {

      type:
        mongoose.Schema.Types.ObjectId,

      required:
        true,

      index:
        true

    },


    // ========================================
    // PAYMENT DIRECTION
    // ========================================

    payment_direction: {

      type:
        String,

      enum:
        PAYMENT_DIRECTIONS,

      required:
        true,

      default:
        'inbound'

    },


    // ========================================
    // PAYMENT AMOUNT
    // ========================================

    amount: {

      type:
        mongoose.Schema.Types.Decimal128,

      required:
        true,

      min:
        0.01

    },


    // ========================================
    // CURRENCY
    // ========================================

    currency: {

      type:
        String,

      required:
        true,

      uppercase:
        true,

      trim:
        true,

      minlength:
        3,

      maxlength:
        3,

      default:
        'KES'

    },


    // ========================================
    // PAYMENT METHOD
    // ========================================
//
// Broad payment classification.
//
// Example:
//
// payment_method: "mpesa"
// channel_type: "mpesa"
//
// payment_method: "bank"
// channel_type: "bank_transfer"
//
// payment_method: "card"
// channel_type: "card"
//
// ========================================

    payment_method: {

      type:
        String,

      enum:
        PAYMENT_METHODS,

      required:
        true,

      index:
        true

    },


    // ========================================
    // CHANNEL TYPE
    // ========================================
//
// Operational payment channel.
//
// This allows the service layer to distinguish
// between different processing routes.
//
// ========================================

    channel_type: {

      type:
        String,

      enum:
        CHANNEL_TYPES,

      required:
        true,

      index:
        true

    },


    // ========================================
    // PROCESSING MODE
    // ========================================

    processing_mode: {

      type:
        String,

      enum:
        PROCESSING_MODES,

      required:
        true,

      default:
        'manual'

    },


    // ========================================
    // PAYMENT PROVIDER
    // ========================================
//
// Provider responsible for processing
// the payment.
//
// ========================================

    payment_provider: {

      type:
        String,

      enum:
        PAYMENT_PROVIDERS,

      default:
        null,

      index:
        true

    },


    // ========================================
    // PROVIDER PAYMENT ID
    // ========================================
//
// External provider transaction ID.
//
// Example:
//
// M-Pesa transaction ID
// Stripe PaymentIntent ID
// Bank reference
//
// ========================================

    provider_payment_id: {

      type:
        String,

      trim:
        true,

      maxlength:
        200,

      default:
        null

    },


    // ========================================
    // EXTERNAL PAYMENT REFERENCE
    // ========================================
//
// External payment reference.
//
// Examples:
//
// M-Pesa receipt
// Bank reference
// Provider transaction reference
//
// ========================================

    external_reference: {

      type:
        String,

      trim:
        true,

      maxlength:
        150,

      default:
        null,

      index:
        true

    },


    // ========================================
    // INTERNAL PAYMENT REFERENCE
    // ========================================

    reference: {

      type:
        String,

      required:
        true,

      unique:
        true,

      trim:
        true,

      index:
        true

    },


    // ========================================
    // PAYMENT INSTRUMENT SNAPSHOT
    // ========================================
//
// IMPORTANT:
//
// This is historical data.
//
// It MUST NOT be dynamically populated from
// the participant's current profile.
//
// Example:
//
// Participant initially uses:
//
// +254700000001
//
// Payment A stores:
//
// phone_number:
// +254700000001
//
// Later participant changes to:
//
// +254700000002
//
// Payment A MUST continue showing:
//
// +254700000001
//
// ========================================

    payment_instrument: {

      // ======================================
      // INSTRUMENT TYPE
      // ======================================

      instrument_type: {

        type:
          String,

        enum:
          PAYMENT_INSTRUMENT_TYPES,

        default:
          null

      },


      // ======================================
      // PROVIDER
      // ======================================

      provider: {

        type:
          String,

        trim:
          true,

        maxlength:
          100,

        default:
          null

      },


      // ======================================
      // DISPLAY LABEL
      // ======================================
//
// Safe human-readable description.
//
// Examples:
//
// "M-Pesa"
// "Equity Bank"
// "Visa ending 4242"
//
// Never store full sensitive card data.
//
// ======================================

      display_label: {

        type:
          String,

        trim:
          true,

        maxlength:
          150,

        default:
          null

      },


      // ======================================
      // PHONE NUMBER
      // ======================================
//
// Store normalized phone number when
// applicable.
//
// ======================================

      phone_number: {

        type:
          String,

        trim:
          true,

        maxlength:
          30,

        default:
          null

      },


      // ======================================
      // BANK NAME
      // ========================================

      bank_name: {

        type:
          String,

        trim:
          true,

        maxlength:
          150,

        default:
          null

      },


      // ======================================
      // BANK ACCOUNT NAME
      // ========================================

      bank_account_name: {

        type:
          String,

        trim:
          true,

        maxlength:
          150,

        default:
          null

      },


      // ======================================
      // BANK ACCOUNT LAST FOUR
      // ======================================
//
// Never store full bank account numbers
// unless the security architecture explicitly
// requires encrypted storage.
//
// ======================================

      bank_account_last4: {

        type:
          String,

        trim:
          true,

        maxlength:
          4,

        default:
          null

      },


      // ======================================
      // CARD BRAND
      // ========================================

      card_brand: {

        type:
          String,

        trim:
          true,

        maxlength:
          50,

        default:
          null

      },


      // ======================================
      // CARD LAST FOUR
      // ========================================
//
// Never store full PAN/card number.
//
// ========================================

      card_last4: {

        type:
          String,

        trim:
          true,

        maxlength:
          4,

        default:
          null

      },


      // ======================================
      // PROVIDER CUSTOMER ID
      // ========================================

      provider_customer_id: {

        type:
          String,

        trim:
          true,

        maxlength:
          200,

        default:
          null

      },


      // ======================================
      // PROVIDER INSTRUMENT ID
      // ========================================

      provider_instrument_id: {

        type:
          String,

        trim:
          true,

        maxlength:
          200,

        default:
          null

      }

    },


    // ========================================
    // PAYMENT STATUS
    // ========================================

    status: {

      type:
        String,

      enum:
        PAYMENT_STATUSES,

      required:
        true,

      default:
        'pending',

      index:
        true

    },


    // ========================================
    // PAYMENT DATE
    // ========================================
//
// Business date of the payment.
//
// ========================================

    paid_at: {

      type:
        Date,

      required:
        true,

      default:
        Date.now,

      index:
        true

    },


    // ========================================
    // INITIATED AT
    // ========================================

    initiated_at: {

      type:
        Date,

      default:
        null

    },


    // ========================================
    // COMPLETED AT
    // ========================================

    completed_at: {

      type:
        Date,

      default:
        null,

      index:
        true

    },


    // ========================================
    // FAILED AT
    // ========================================

    failed_at: {

      type:
        Date,

      default:
        null

    },


    // ========================================
    // FAILURE CODE
    // ========================================

    failure_code: {

      type:
        String,

      trim:
        true,

      maxlength:
        100,

      default:
        null

    },


    // ========================================
    // FAILURE MESSAGE
    // ========================================

    failure_message: {

      type:
        String,

      trim:
        true,

      maxlength:
        500,

      default:
        null

    },


    // ========================================
    // PAYMENT RECORDED BY
    // ========================================

    recorded_by: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'User',

      default:
        null

    },


    // ========================================
    // PAYMENT CREATED BY
    // ========================================

    created_by: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'User',

      required:
        true

    },


    // ========================================
    // PAYMENT VERIFIED BY
    // ========================================

    verified_by: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'User',

      default:
        null

    },


    // ========================================
    // PAYMENT VERIFIED AT
    // ========================================

    verified_at: {

      type:
        Date,

      default:
        null

    },


    // ========================================
    // FINANCIAL TRANSACTION
    // ========================================
//
// The accounting transaction associated
// with the completed payment.
//
// Do NOT delete or replace this reference
// when a payment is reversed.
//
// ========================================

    financial_transaction_id: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'FinancialTransaction',

      default:
        null

    },


    // ========================================
    // REVERSAL TRANSACTION
    // ========================================
//
// Separate compensating accounting event.
//
// The original financial transaction remains
// untouched.
//
// ========================================

    reversal_transaction_id: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'FinancialTransaction',

      default:
        null

    },


    // ========================================
    // REVERSAL
    // ========================================

    reversed_by: {

      type:
        mongoose.Schema.Types.ObjectId,

      ref:
        'User',

      default:
        null

    },


    // ========================================
    // REVERSED AT
    // ========================================

    reversed_at: {

      type:
        Date,

      default:
        null

    },


    // ========================================
    // REVERSAL REASON
    // ========================================

    reversal_reason: {

      type:
        String,

      trim:
        true,

      maxlength:
        500,

      default:
        null

    },


    // ========================================
    // PAYMENT ATTEMPTS
    // ========================================
//
// Operational history of attempts to process
// this contribution payment.
//
// Example:
//
// Attempt 1
//    mpesa
//    failed
//
// Attempt 2
//    mpesa
//    completed
//
// The payment itself remains one business
// payment record.
//
// ========================================

    attempts: [

      {

        attempt_number: {

          type:
            Number,

          required:
            true

        },


        // ====================================
        // ATTEMPT STATUS
        // ====================================

        status: {

          type:
            String,

          enum:
            PAYMENT_ATTEMPT_STATUSES,

          required:
            true,

          default:
            'initiated'

        },


        // ====================================
        // ATTEMPT PROVIDER
        // ====================================

        provider: {

          type:
            String,

          enum:
            PAYMENT_PROVIDERS,

          default:
            null

        },


        // ====================================
        // ATTEMPT CHANNEL
        // ====================================

        channel_type: {

          type:
            String,

          enum:
            CHANNEL_TYPES,

          required:
            true

        },


        // ====================================
        // ATTEMPT EXTERNAL REFERENCE
        // ====================================

        external_reference: {

          type:
            String,

          trim:
            true,

          maxlength:
            150,

          default:
            null

        },


        // ====================================
        // PROVIDER PAYMENT ID
        // ====================================

        provider_payment_id: {

          type:
            String,

          trim:
            true,

          maxlength:
            200,

          default:
            null

        },


        // ====================================
        // ATTEMPTED INSTRUMENT SNAPSHOT
        // ====================================
//
// Snapshot of the exact instrument used
// during this attempt.
//
// This is especially important when:
//
// Attempt 1 → old M-Pesa number
// Attempt 2 → new M-Pesa number
//
// ====================================

        instrument_snapshot: {

          instrument_type: {

            type:
              String,

            enum:
              PAYMENT_INSTRUMENT_TYPES,

            default:
              null

          },


          display_label: {

            type:
              String,

            trim:
              true,

            maxlength:
              150,

            default:
              null

          },


          phone_number: {

            type:
              String,

            trim:
              true,

            maxlength:
              30,

            default:
              null

          },


          bank_name: {

            type:
              String,

            trim:
              true,

            maxlength:
              150,

            default:
              null

          },


          bank_account_last4: {

            type:
              String,

            trim:
              true,

            maxlength:
              4,

            default:
              null

          },


          card_brand: {

            type:
              String,

            trim:
              true,

            maxlength:
              50,

            default:
              null

          },


          card_last4: {

            type:
              String,

            trim:
              true,

            maxlength:
              4,

            default:
              null

          }

        },


        // ====================================
        // ATTEMPT STARTED AT
        // ====================================

        started_at: {

          type:
            Date,

          default:
            Date.now

        },


        // ====================================
        // ATTEMPT COMPLETED AT
        // ====================================

        completed_at: {

          type:
            Date,

          default:
            null

        },


        // ====================================
        // FAILURE CODE
        // ====================================

        failure_code: {

          type:
            String,

          trim:
            true,

          maxlength:
            100,

          default:
            null

        },


        // ====================================
        // FAILURE MESSAGE
        // ====================================

        failure_message: {

          type:
            String,

          trim:
            true,

          maxlength:
            500,

          default:
            null

        }

      }

    ],


    // ========================================
    // DESCRIPTION / NOTES
    // ========================================

    notes: {

      type:
        String,

      trim:
        true,

      maxlength:
        1000,

      default:
        ''

    }

  },

  {

    timestamps:
      true

  }

);


// ========================================
// COMPOUND INDEXES
// ========================================


// ========================================
// OBLIGATION PAYMENT QUERY
// ========================================

contributionPaymentSchema.index({

  obligation_id:
    1,

  status:
    1,

  paid_at:
    -1,

  createdAt:
    -1

});


// ========================================
// OWNER PAYMENT QUERY
// ========================================

contributionPaymentSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  status:
    1,

  paid_at:
    -1,

  createdAt:
    -1

});


// ========================================
// PARTICIPANT PAYMENT QUERY
// ========================================

contributionPaymentSchema.index({

  participant_type:
    1,

  participant_id:
    1,

  status:
    1,

  paid_at:
    -1,

  createdAt:
    -1

});


// ========================================
// PAYMENT METHOD QUERY
// ========================================

contributionPaymentSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  payment_method:
    1,

  status:
    1,

  createdAt:
    -1

});


// ========================================
// PROVIDER PAYMENT LOOKUP
// ========================================

contributionPaymentSchema.index({

  payment_provider:
    1,

  provider_payment_id:
    1

});


// ========================================
// OWNER + EXTERNAL REFERENCE
// ========================================
//
// Prevents duplicate external payment
// references within the same owner.
//
// Sparse index allows multiple documents
// where external_reference is null/missing.
//
// ========================================

contributionPaymentSchema.index(

  {

    owner_type:
      1,

    owner_id:
      1,

    external_reference:
      1

  },

  {

    unique:
      true,

    sparse:
      true,

    name:
      'unique_external_reference_per_owner'

  }

);


// ========================================
// FINANCIAL TRANSACTION LOOKUP
// ========================================
//
// IMPORTANT:
//
// This is the ONLY index definition for
// financial_transaction_id.
//
// ========================================

contributionPaymentSchema.index(

  {

    financial_transaction_id:
      1

  },

  {

    name:
      'contribution_payment_financial_transaction_lookup'

  }

);


// ========================================
// REVERSAL TRANSACTION LOOKUP
// ========================================

contributionPaymentSchema.index(

  {

    reversal_transaction_id:
      1

  },

  {

    name:
      'contribution_payment_reversal_transaction_lookup'

  }

);


// ========================================
// OBLIGATION + PARTICIPANT
// ========================================

contributionPaymentSchema.index({

  obligation_id:
    1,

  participant_type:
    1,

  participant_id:
    1

});


// ========================================
// PRE-VALIDATION
// ========================================

contributionPaymentSchema.pre(

  'validate',

  function(next) {


    // ======================================
    // OWNER / PARTICIPANT COMPATIBILITY
    // ======================================

    if (

      this.owner_type ===
      'Chama' &&

      this.participant_type !==
      'ChamaMembership'

    ) {

      return next(

        new Error(

          'Chama contribution payments must use ChamaMembership participants'

        )

      );

    }


    if (

      this.owner_type ===
      'ContributionGroup' &&

      this.participant_type !==
      'ContributionGroupMember'

    ) {

      return next(

        new Error(

          'ContributionGroup contribution payments must use ContributionGroupMember participants'

        )

      );

    }


    // ======================================
    // PAYMENT METHOD / CHANNEL CONSISTENCY
    // ======================================

    if (

      this.payment_method ===
      'mpesa' &&

      ![

        'mpesa',

        'mobile_money'

      ].includes(

        this.channel_type

      )

    ) {

      return next(

        new Error(

          'M-Pesa payments must use mpesa or mobile_money channel types'

        )

      );

    }


    if (

      this.payment_method ===
      'card' &&

      this.channel_type !==
      'card'

    ) {

      return next(

        new Error(

          'Card payments must use the card channel type'

        )

      );

    }


    if (

      this.payment_method ===
      'bank' &&

      ![

        'bank_account',

        'bank_transfer'

      ].includes(

        this.channel_type

      )

    ) {

      return next(

        new Error(

          'Bank payments must use bank_account or bank_transfer channel types'

        )

      );

    }


    // ======================================
    // PAYMENT PROVIDER CONSISTENCY
    // ======================================

    if (

      this.processing_mode !==
      'manual' &&

      !this.payment_provider

    ) {

      return next(

        new Error(

          'Automated or webhook payments must have a payment provider'

        )

      );

    }


    // ======================================
    // PAYMENT INSTRUMENT CONSISTENCY
    // ======================================

    if (

      this.payment_instrument?.instrument_type ===
      'phone_number' &&

      !this.payment_instrument?.phone_number

    ) {

      return next(

        new Error(

          'Phone number is required for phone_number payment instruments'

        )

      );

    }


    if (

      this.payment_instrument?.instrument_type ===
      'bank_account' &&

      !this.payment_instrument?.bank_account_last4

    ) {

      return next(

        new Error(

          'Bank account last four digits are required for bank account payment instruments'

        )

      );

    }


    if (

      this.payment_instrument?.instrument_type ===
      'card' &&

      !this.payment_instrument?.card_last4

    ) {

      return next(

        new Error(

          'Card last four digits are required for card payment instruments'

        )

      );

    }


    // ======================================
    // VERIFICATION CONSISTENCY
    // ======================================

    if (

      this.verified_by &&

      !this.verified_at

    ) {

      return next(

        new Error(

          'verified_at is required when verified_by is set'

        )

      );

    }


    if (

      this.verified_at &&

      !this.verified_by

    ) {

      return next(

        new Error(

          'verified_by is required when verified_at is set'

        )

      );

    }


    // ======================================
    // COMPLETION CONSISTENCY
    // ======================================

    if (

      this.status ===
      'completed' &&

      !this.financial_transaction_id

    ) {

      return next(

        new Error(

          'Completed contribution payments must have a financial transaction'

        )

      );

    }


    // ======================================
    // COMPLETED AT CONSISTENCY
    // ======================================

    if (

      this.status ===
      'completed' &&

      !this.completed_at

    ) {

      return next(

        new Error(

          'Completed contribution payments must have completed_at'

        )

      );

    }


    // ======================================
    // FAILED PAYMENT CONSISTENCY
    // ======================================

    if (

      this.status ===
      'failed' &&

      !this.failed_at

    ) {

      return next(

        new Error(

          'Failed contribution payments must have failed_at'

        )

      );

    }


    // ======================================
    // REVERSAL CONSISTENCY
    // ======================================

    if (

      this.reversed_by &&

      !this.reversed_at

    ) {

      return next(

        new Error(

          'reversed_at is required when reversed_by is set'

        )

      );

    }


    if (

      this.reversed_at &&

      !this.reversed_by

    ) {

      return next(

        new Error(

          'reversed_by is required when reversed_at is set'

        )

      );

    }


    if (

      this.reversal_reason &&

      !this.reversed_by

    ) {

      return next(

        new Error(

          'reversed_by is required when reversal_reason is set'

        )

      );

    }


    // ======================================
    // REVERSED STATUS CONSISTENCY
    // ======================================

    if (

      this.status ===
      'reversed' &&

      !this.reversed_by

    ) {

      return next(

        new Error(

          'Reversed contribution payments must have reversed_by'

        )

      );

    }


    if (

      this.status ===
      'reversed' &&

      !this.reversed_at

    ) {

      return next(

        new Error(

          'Reversed contribution payments must have reversed_at'

        )

      );

    }


    if (

      this.status ===
      'reversed' &&

      !this.reversal_transaction_id

    ) {

      return next(

        new Error(

          'Reversed contribution payments must have a reversal transaction'

        )

      );

    }


    // ======================================
    // PAYMENT ATTEMPT NUMBER VALIDATION
    // ======================================

    if (

      this.attempts?.length

    ) {

      const attemptNumbers =
        this.attempts.map(

          attempt =>
            attempt.attempt_number

        );

      const uniqueAttemptNumbers =
        new Set(
          attemptNumbers
        );

      if (

        uniqueAttemptNumbers.size !==
        attemptNumbers.length

      ) {

        return next(

          new Error(

            'Payment attempt numbers must be unique'

          )

        );

      }

    }


    return next();

  }

);


// ========================================
// JSON TRANSFORMATION
// ========================================

contributionPaymentSchema.set(

  'toJSON',

  {

    transform:
      (_doc, ret) => {


        // ==================================
        // DECIMAL AMOUNT
        // ==================================

        if (

          ret.amount !==
          undefined &&

          ret.amount !==
          null

        ) {

          ret.amount =
            ret.amount.toString();

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
//
// Exporting these allows the service layer
// to use the exact same lifecycle definitions
// without duplicating them.
//
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

