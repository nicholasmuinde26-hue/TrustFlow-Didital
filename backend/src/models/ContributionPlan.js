import mongoose from 'mongoose';
import { BEHAVIOR_VALUES } from '../constants/contributionBehavior.constants.js';


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

          'biweekly',

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

            'biweekly',

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
      // BEHAVIOUR  (what the system needs to know)
      // ========================================
      //
      // `name` is free text chosen by the chama. `behavior` is the small
      // fixed set the system reasons about. Never infer it from the name.
      //
      // ========================================

      // null = created before behaviour existed; readers fall back to
      // behaviorFromLegacy() until backfillContributionBehavior has run.
      behavior: {
        type: String,
        enum: [...BEHAVIOR_VALUES, null],
        default: null,
        index: true
      },

      // How the amount is read. fixed = exactly `amount` each period;
      // minimum = at least `amount`, more is welcome (extra carries forward
      // as advance); member_chooses = `amount` is the suggested floor the
      // member may exceed. Only fixed vs. not-fixed changes what the UI says;
      // the engine opens obligations at `amount` in every mode.
      amount_mode: {
        type: String,
        enum: ['fixed', 'minimum', 'member_chooses'],
        default: 'fixed'
      },

      // Set only on plans the platform itself relies on (today: 'savings',
      // the built-in member savings plan). Lets code find that plan without
      // matching on its display name.
      system_key: {
        type: String,
        enum: ['savings', 'late_penalties', null],
        default: null
      },

      // Which built-in template (constants/chamaTemplates.constants.js) this
      // plan was started from. Informational only: the plan's name, amounts
      // and rules are the chama's own once created.
      template_key: { type: String, trim: true, maxlength: 40, default: null },

      // Late penalty for this plan. Reuses the loan penalty pattern
      // (loans/Loanpenalty.service.js): starts once the obligation is past
      // due date + schedule.grace_days, then accrues per interval. Changing
      // the rule only affects penalties from then on; penalties already
      // raised are never reduced by an edit (use a waiver for that).
      late_penalty: {
        enabled: { type: Boolean, default: false },
        // fixed = KES per interval; percentage_of_due = % of what is still
        // unpaid on the obligation, per interval.
        type: { type: String, enum: ['fixed', 'percentage_of_due'], default: 'fixed' },
        amount: { type: Number, default: 0, min: 0 },
        // once = charged a single time; weekly / monthly = repeats.
        interval: { type: String, enum: ['once', 'weekly', 'monthly'], default: 'once' },
        // Optional ceiling per obligation (KES). 0 = no cap.
        max_amount: { type: Number, default: 0, min: 0 }
      },

      // Periods that opened while the plan was paused and are skipped on
      // resume, so members are not billed for months the plan was on hold.
      paused_period_keys: { type: [String], default: [] },

      // Dedicated ledger account for this plan's money (see
      // planLedgerAccount.service.js). Null = legacy shared account.
      ledger_account_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialAccount',
        default: null
      },
      // The fund this plan feeds (see models/Fund.js). Null = not part of a
      // fund. Several plans may share one fund; the fund's ledger account is
      // the money's home, so a plan that has a fund should post to it.
      fund_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fund',
        default: null,
        index: true
      },

      // Presentation only.
      display: {
        color: { type: String, trim: true, maxlength: 20, default: null },
        icon: { type: String, trim: true, maxlength: 30, default: null },
        sort_order: { type: Number, default: 0 }
      },

      // Who owes this contribution. 'all' = every active member.
      applies_to: {
        mode: { type: String, enum: ['all', 'selected'], default: 'all' },
        participant_ids: { type: [mongoose.Schema.Types.ObjectId], default: [] }
      },

      // Per-member amount (e.g. a member holding half a share).
      member_amount_overrides: {
        type: [
          new mongoose.Schema(
            {
              participant_id: { type: mongoose.Schema.Types.ObjectId, required: true },
              amount: { type: mongoose.Schema.Types.Decimal128, required: true, min: 0 },
              reason: { type: String, trim: true, maxlength: 200, default: '' },
              effective_from: { type: Date, default: null }
            },
            { _id: false }
          )
        ],
        default: []
      },

      // ========================================
      // CALENDAR SCHEDULE
      // ========================================
      //
      // NOTE: contributioncalendar.service.js reads and writes these fields.
      // If your ContributionPlan.js already defines `schedule`, delete this
      // block and keep yours (add `category` only if it is missing).
      //
      // ========================================

      schedule: {
        aligned_to_calendar: { type: Boolean, default: false, index: true },
        due_day: { type: Number, default: 5, min: 1, max: 31 },
        grace_days: { type: Number, default: 0, min: 0, max: 60 },
        reminder_days_before: { type: Number, default: 3, min: 0, max: 30 },
        category: { type: String, default: 'other' },
        timings_reset_at: { type: Date, default: null },
        timings_reset_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
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

          'cancelled',

          'archived'

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


      // Why it was paused (shown to leadership) and archive bookkeeping.
      // Archiving hides a plan and stops all activity but keeps every
      // obligation, payment and ledger entry. It can be restored.
      pause_reason: { type: String, trim: true, maxlength: 300, default: '' },
      archived_at: { type: Date, default: null },
      archived_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      archive_reason: { type: String, trim: true, maxlength: 300, default: '' },
      // Status to go back to on restore ('active' or 'paused').
      archived_from_status: { type: String, enum: ['active', 'paused', 'draft', null], default: null },

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

// ----------------------------------------
// Behaviour consistency + system-plan uniqueness
// ----------------------------------------
contributionPlanSchema.pre('validate', function () {
  // A merry-go-round type is always the 'rotation' behaviour, and only it is.
  if (this.contribution_type === 'merry_go_round') {
    this.behavior = 'rotation';
  } else if (this.behavior === 'rotation') {
    throw new Error("Behaviour 'rotation' requires contribution_type 'merry_go_round'");
  }
  if (this.system_key === 'savings' && this.behavior !== 'savings') {
    throw new Error("The built-in savings plan must use behaviour 'savings'");
  }
});

// One built-in plan per key per owner (savings today).
contributionPlanSchema.index(
  { owner_type: 1, owner_id: 1, system_key: 1 },
  { unique: true, partialFilterExpression: { system_key: { $type: 'string' } }, name: 'unique_system_plan_per_owner' }
);
contributionPlanSchema.index({ owner_type: 1, owner_id: 1, behavior: 1, status: 1 });


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