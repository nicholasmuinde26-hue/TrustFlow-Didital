import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION PLAN SCHEMA
// ========================================
//
// A ContributionPlan defines the rules
// governing expected contributions.
//
// It does NOT represent:
//   - A contribution obligation
//   - A payment
//   - An accounting transaction
//
// It defines:
//
// - Who owns the plan
// - Which participant architecture it uses
// - What the plan is for
// - How much members should contribute
// - How often they contribute
// - How long the plan runs
// - Whether the plan is active
// - Whether it is a Merry-Go-Round plan
//
// Architecture:
//
// Owner
//   │
//   ├── ContributionPlan
//   │       │
//   │       ├── ContributionObligation
//   │       │       │
//   │       │       └── ContributionPayment
//   │       │
//   │       └── Financial Recognition
//   │
//   └── Participants
//
// IMPORTANT:
//
// ContributionPlan
//     = RULES
//
// ContributionObligation
//     = MONEY THAT IS DUE
//
// ContributionPayment
//     = MONEY ACTUALLY RECEIVED
//
// FinancialTransaction
//     = ACCOUNTING EVENT
//
// LedgerEntry
//     = DOUBLE-ENTRY RECORD
//
// ========================================
//
// PARTICIPANT ARCHITECTURE
//
// The plan uses the same participant
// abstraction as ContributionObligation
// and ContributionPayment.
//
// participant_type:
//
//   ChamaMembership
//   ContributionGroupMember
//
// The actual participant records are
// connected later through obligations.
//
// This allows the same contribution engine
// to support:
//
//   Chama
//   ContributionGroup
//
// without coupling ContributionGroup
// directly to the Chama membership model.
//
// ========================================


const contributionPlanSchema =

  new mongoose.Schema(

    {

      // ========================================
      // OWNER TYPE
      // ========================================
      //
      // Identifies the financial owner of
      // the contribution plan.
      //
      // ========================================

      owner_type: {

        type:
          String,

        enum: [

          'Chama',

          'ContributionGroup'

        ],

        required:
          true,

        index:
          true

      },


      // ========================================
      // OWNER ID
      // ========================================
      //
      // Identifies the actual Chama or
      // ContributionGroup.
      //
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
      //
      // Defines the membership architecture
      // used by this contribution plan.
      //
      // Chama
      //     → ChamaMembership
      //
      // ContributionGroup
      //     → ContributionGroupMember
      //
      // ========================================

      participant_type: {

        type:
          String,

        enum: [

          'ChamaMembership',

          'ContributionGroupMember'

        ],

        required:
          true,

        index:
          true

      },


      // ========================================
      // PLAN CREATOR
      // ========================================
      //
      // User who originally created the plan.
      //
      // ========================================

      created_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required:
          true,

        index:
          true

      },


      // ========================================
      // LAST UPDATED BY
      // ========================================
      //
      // User responsible for the latest
      // meaningful plan configuration change.
      //
      // ========================================

      updated_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // PLAN NAME
      // ========================================

      name: {

        type:
          String,

        required:
          true,

        trim:
          true,

        minlength:
          2,

        maxlength:
          150

      },


      // ========================================
      // PLAN DESCRIPTION
      // ========================================

      description: {

        type:
          String,

        default:
          '',

        trim:
          true,

        maxlength:
          500

      },


      // ========================================
      // CURRENCY
      // ========================================
      //
      // Currency used by the contribution plan.
      //
      // All generated obligations must use
      // the same currency unless a future
      // multi-currency architecture explicitly
      // supports otherwise.
      //
      // ========================================

      currency: {

        type:
          String,

        default:
          'KES',

        uppercase:
          true,

        trim:
          true,

        minlength:
          3,

        maxlength:
          3,

        required:
          true,

        index:
          true

      },


      // ========================================
      // CONTRIBUTION TYPE
      // ========================================
      //
      // fixed:
      //     Every obligation uses a fixed amount.
      //
      // free_will:
      //     Members may contribute voluntarily.
      //
      // target:
      //     Contributions work toward a target.
      //
      // merry_go_round:
      //     Contributions are collected and
      //     distributed according to a rotation.
      //
      // ========================================

      contribution_type: {

        type:
          String,

        enum: [

          'fixed',

          'free_will',

          'target',

          'merry_go_round'

        ],

        required:
          true,

        index:
          true

      },


      // ========================================
      // CONTRIBUTION FREQUENCY
      // ========================================
      //
      // Defines how frequently obligations
      // should normally be generated.
      //
      // ========================================

      frequency: {

        type:
          String,

        enum: [

          'once',

          'daily',

          'weekly',

          'monthly',

          'quarterly',

          'yearly',

          'custom'

        ],

        default:
          'once',

        required:
          true,

        index:
          true

      },


      // ========================================
      // FIXED CONTRIBUTION AMOUNT
      // ========================================
      //
      // Used primarily for fixed contribution
      // plans.
      //
      // Example:
      //
      // $1,000 per month
      //
      // For KES-based systems this would
      // normally be represented as:
      //
      // 1000 KES
      //
      // ========================================

      amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          null,

        min:
          0

      },


      // ========================================
      // TARGET AMOUNT
      // ========================================
      //
      // Used for target-based contribution plans.
      //
      // ========================================

      target_amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          null,

        min:
          0

      },


      // ========================================
      // MINIMUM CONTRIBUTION AMOUNT
      // ========================================
      //
      // Minimum amount a participant can
      // contribute.
      //
      // Particularly useful for:
      //
      // - Free-will contributions
      // - Target plans
      //
      // ========================================

      minimum_amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          null,

        min:
          0

      },


      // ========================================
      // MAXIMUM CONTRIBUTION AMOUNT
      // ========================================
      //
      // Maximum amount allowed for a
      // contribution.
      //
      // ========================================

      maximum_amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          null,

        min:
          0

      },


      // ========================================
      // CUSTOM FREQUENCY
      // ========================================
      //
      // Used only when:
      //
      // frequency = custom
      //
      // Example:
      //
      // Every 14 days
      //
      // ========================================

      custom_frequency_days: {

        type:
          Number,

        default:
          null,

        min:
          1,

        max:
          3650

      },


      // ========================================
      // PLAN START DATE
      // ========================================
      //
      // Date from which the plan becomes
      // eligible for contribution obligations.
      //
      // ========================================

      start_date: {

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
      // PLAN END DATE
      // ========================================
      //
      // Required for finite plans.
      //
      // Must be greater than start_date.
      //
      // Permanent plans may leave this null.
      //
      // ========================================

      end_date: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // PERMANENT PLAN
      // ========================================
      //
      // If true:
      //
      // - end_date should normally be null
      // - the plan continues indefinitely
      //
      // ========================================

      is_permanent: {

        type:
          Boolean,

        default:
          false,

        index:
          true

      },


      // ========================================
      // MERRY-GO-ROUND SETTINGS
      // ========================================
      //
      // Configuration for rotating payouts.
      //
      // A Merry-Go-Round plan may define:
      //
      // - payout interval
      // - custom payout interval
      //
      // The actual payout schedule should be
      // managed by the rotations domain.
      //
      // ========================================

      merry_go_round: {

        enabled: {

          type:
            Boolean,

          default:
            false

        },


        payout_interval: {

          type:
            String,

          enum: [

            'weekly',

            'monthly',

            'quarterly',

            'yearly',

            'custom'

          ],

          default:
            null

        },


        payout_interval_days: {

          type:
            Number,

          default:
            null,

          min:
            1,

          max:
            3650

        }

      },


      // ========================================
      // PLAN STATUS
      // ========================================
      //
      // draft:
      //     Plan is being configured.
      //
      // active:
      //     Plan can generate obligations.
      //
      // paused:
      //     Temporarily stopped.
      //
      // completed:
      //     Naturally finished.
      //
      // cancelled:
      //     Permanently cancelled.
      //
      // ========================================

      status: {

        type:
          String,

        enum: [

          'draft',

          'active',

          'paused',

          'completed',

          'cancelled'

        ],

        default:
          'draft',

        required:
          true,

        index:
          true

      },


      // ========================================
      // ACTIVATED AT
      // ========================================
      //
      // Timestamp when the plan first became
      // active.
      //
      // ========================================

      activated_at: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // ACTIVATED BY
      // ========================================

      activated_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // PAUSED AT
      // ========================================

      paused_at: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // PAUSED BY
      // ========================================

      paused_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

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
          null

      },


      // ========================================
      // COMPLETED BY
      // ========================================

      completed_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // CANCELLED AT
      // ========================================

      cancelled_at: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // CANCELLED BY
      // ========================================

      cancelled_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // PLAN VERSION
      // ========================================
      //
      // Useful for future optimistic concurrency
      // and detecting configuration changes.
      //
      // ========================================

      version: {

        type:
          Number,

        default:
          1,

        min:
          1

      }

    },

    {

      timestamps:
        true

    }

  );


// ========================================
// SCHEMA VALIDATION
// ========================================
//
// Cross-field validation belongs here only
// where it represents pure data integrity.
//
// Business workflow validation remains in:
//
// contributionPlan.service.js
//
// ========================================


contributionPlanSchema.pre(

  'validate',

  function() {

    // ======================================
    // OWNER / PARTICIPANT COMPATIBILITY
    // ======================================

    if (

      this.owner_type ===

      'Chama' &&

      this.participant_type !==

      'ChamaMembership'

    ) {

      throw new Error('Chama contribution plans must use ChamaMembership participants');

    }


    if (

      this.owner_type ===

      'ContributionGroup' &&

      this.participant_type !==

      'ContributionGroupMember'

    ) {

      throw new Error('ContributionGroup contribution plans must use ContributionGroupMember participants');

    }


    // ======================================
    // DATE VALIDATION
    // ======================================

    if (

      this.end_date &&

      this.start_date &&

      this.end_date <=

      this.start_date

    ) {

      throw new Error('Plan end date must be later than plan start date');

    }


    // ======================================
    // PERMANENT PLAN VALIDATION
    // ======================================

    if (

      this.is_permanent &&

      this.end_date

    ) {

      throw new Error('Permanent contribution plans cannot have an end date');

    }


    // ======================================
    // CUSTOM FREQUENCY VALIDATION
    // ======================================

    if (

      this.frequency ===

      'custom' &&

      !this.custom_frequency_days

    ) {

      throw new Error('Custom contribution frequency requires custom_frequency_days');

    }


    if (

      this.frequency !==

      'custom' &&

      this.custom_frequency_days

    ) {

      throw new Error('custom_frequency_days can only be used with custom frequency');

    }


    // ======================================
    // AMOUNT RELATIONSHIP VALIDATION
    // ======================================

    if (

      this.minimum_amount &&

      this.maximum_amount &&

      this.minimum_amount.gt(

        this.maximum_amount

      )

    ) {

      throw new Error('Minimum contribution amount cannot exceed maximum contribution amount');

    }


    // ======================================
    // FIXED PLAN VALIDATION
    // ======================================

    if (

      this.contribution_type ===

      'fixed' &&

      !this.amount

    ) {

      throw new Error('Fixed contribution plans require an amount');

    }


    // ======================================
    // TARGET PLAN VALIDATION
    // ======================================

    if (

      this.contribution_type ===

      'target' &&

      !this.target_amount

    ) {

      throw new Error('Target contribution plans require a target amount');

    }


    // ======================================
    // MERRY-GO-ROUND TYPE VALIDATION
    // ======================================

    if (

      this.contribution_type ===

      'merry_go_round' &&

      !this.merry_go_round?.enabled

    ) {

      throw new Error('Merry-Go-Round contribution plans must enable merry_go_round settings');

    }


    // ======================================
    // MERRY-GO-ROUND SETTINGS VALIDATION
    // ======================================

    if (

      this.merry_go_round?.enabled &&

      !this.merry_go_round?.payout_interval

    ) {

      throw new Error('Merry-Go-Round plans require a payout interval');

    }


    // ======================================
    // CUSTOM MERRY-GO-ROUND INTERVAL
    // ======================================

    if (

      this.merry_go_round?.payout_interval ===

      'custom' &&

      !this.merry_go_round?.payout_interval_days

    ) {

      throw new Error('Custom Merry-Go-Round payout interval requires payout_interval_days');

    }


    if (

      this.merry_go_round?.payout_interval !==

      'custom' &&

      this.merry_go_round?.payout_interval_days

    ) {

      throw new Error('payout_interval_days can only be used with a custom payout interval');

    }


  }

);


// ========================================
// OWNER PLAN LOOKUP
// ========================================
//
// Find plans belonging to an owner.
//
// ========================================

contributionPlanSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  status:
    1

});


// ========================================
// OWNER + PARTICIPANT PLAN LOOKUP
// ========================================
//
// Useful for retrieving plans applicable
// to a specific membership architecture.
//
// ========================================

contributionPlanSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  participant_type:
    1,

  status:
    1

});


// ========================================
// OWNER PLAN CREATION LOOKUP
// ========================================

contributionPlanSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  createdAt:
    -1

});


// ========================================
// ACTIVE PLAN LOOKUP
// ========================================
//
// Frequently used by obligation generation
// services.
//
// ========================================

contributionPlanSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  status:
    1,

  start_date:
    1,

  end_date:
    1

});


// ========================================
// PLAN TYPE LOOKUP
// ========================================
//
// Useful for filtering:
//
// - Fixed plans
// - Target plans
// - Free-will plans
// - Merry-Go-Round plans
//
// ========================================

contributionPlanSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  contribution_type:
    1,

  status:
    1

});


// ========================================
// TO JSON TRANSFORM
// ========================================
//
// Convert Decimal128 values into strings.
//
// This avoids exposing MongoDB Decimal128
// objects directly through API responses.
//
// IMPORTANT:
//
// Financial calculations should still happen
// using Decimal.js in the service layer.
//
// ========================================

contributionPlanSchema.set(

  'toJSON',

  {

    transform:

      (_doc, ret) => {

        if (

          ret.amount

        ) {

          ret.amount =

            ret.amount.toString();

        }


        if (

          ret.target_amount

        ) {

          ret.target_amount =

            ret.target_amount.toString();

        }


        if (

          ret.minimum_amount

        ) {

          ret.minimum_amount =

            ret.minimum_amount.toString();

        }


        if (

          ret.maximum_amount

        ) {

          ret.maximum_amount =

            ret.maximum_amount.toString();

        }


        return ret;

      }

  }

);


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(

  'ContributionPlan',

  contributionPlanSchema

);
