import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION OBLIGATION SCHEMA
// ========================================
//
// Represents a financial obligation assigned
// to a specific participant under a
// ContributionPlan.
//
// Architecture:
//
// Chama / ContributionGroup
//          │
//          ▼
// ContributionPlan
//          │
//          ▼
// ContributionObligation
//          │
//          ▼
// ContributionPayment
//          │
//          ▼
// FinancialTransaction
//          │
//          ▼
// LedgerEntry
//
// IMPORTANT:
//
// An obligation represents MONEY THAT IS DUE.
//
// It does NOT represent money that has already
// been received.
//
// Actual money received is represented by:
//
// ContributionPayment
//
// FinancialTransaction
//
// LedgerEntry
//
// ========================================
//
// PARTICIPANT ARCHITECTURE
//
// The finance engine does NOT directly assume
// that every participant is a `Member`.
//
// Instead, the participant is represented by:
//
// participant_type
// participant_id
//
// Examples:
//
// Chama membership:
//
// participant_type:
//   'ChamaMembership'
//
// participant_id:
//   <ChamaMembership._id>
//
// Contribution Group membership:
//
// participant_type:
//   'ContributionGroupMember'
//
// participant_id:
//   <ContributionGroupMember._id>
//
// This keeps Contribution Groups independent
// from the Chama architecture.
//
// ========================================


const contributionObligationSchema =

  new mongoose.Schema(

    {

      // ========================================
      // CONTRIBUTION PLAN
      // ========================================
      //
      // The plan that generated this obligation.
      //
      // Example:
      //
      // Monthly Savings Plan
      //
      // Weekly Welfare Plan
      //
      // Merry-Go-Round Plan
      //
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
      // CONTRIBUTION GROUP / CHAMA OWNER
      // ========================================
      //
      // Denormalized owner reference.
      //
      // This allows the finance engine to
      // efficiently query obligations without
      // always resolving the ContributionPlan.
      //
      // The owner can be:
      //
      // Chama
      // ContributionGroup
      //
      // IMPORTANT:
      //
      // This follows the same polymorphic
      // ownership architecture used by
      // ContributionPlan and FinancialAccount.
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
      // Identifies the Chama or ContributionGroup
      // that owns the financial obligation.
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
      // Determines which membership model
      // participant_id belongs to.
      //
      // Supported participant types:
      //
      // ChamaMembership
      // ContributionGroupMember
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
      // PARTICIPANT ID
      // ========================================
      //
      // The membership record responsible for
      // fulfilling this obligation.
      //
      // IMPORTANT:
      //
      // This intentionally does NOT reference
      // User directly.
      //
      // The participant is the user's membership
      // within the financial owner.
      //
      // This allows the same User to participate
      // in multiple Chamas and ContributionGroups
      // without mixing financial identities.
      //
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
      // EXPECTED AMOUNT
      // ========================================
      //
      // The amount the participant is expected
      // to contribute.
      //
      // IMPORTANT:
      //
      // Decimal128 is used to avoid JavaScript
      // floating-point money precision issues.
      //
      // ========================================

      expected_amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        required:
          true,

        min:
          0

      },


      // ========================================
      // PAID AMOUNT
      // ========================================
      //
      // Total amount successfully paid toward
      // this obligation.
      //
      // This is a cached aggregate.
      //
      // The authoritative payment history remains
      // ContributionPayment.
      //
      // ========================================

      paid_amount: {

        type:
          mongoose.Schema.Types.Decimal128,

        default:
          0,

        min:
          0

      },


      // ========================================
      // CURRENCY
      // ========================================
      //
      // Default currency is KES because
      // ChamaManager is primarily designed
      // for the Kenyan financial ecosystem.
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
          true

      },


      // ========================================
      // FINANCIAL TRANSACTION LINK
      // ========================================
      //
      // The FinancialTransaction that recorded
      // this obligation being recognized
      // (transaction_type: 'contribution_obligation'):
      //
      // DR 1300/1310 Receivable
      // CR 3000 Contributions / Member Contributions
      //
      // IMPORTANT:
      //
      // This field was missing for a period of
      // time while contributionObligation.service.js
      // already set it after posting the
      // recognition transaction. Under Mongoose's
      // default strict mode, assigning a field
      // that isn't declared on the schema is
      // silently dropped on save() — it does not
      // throw, and does not persist. Every
      // obligation created during that time has
      // financial_transaction_id = null even
      // though a real, correctly posted
      // FinancialTransaction exists for it
      // (queryable via
      // FinancialTransaction.find({ source_type:
      // 'ContributionObligation', source_id })).
      //
      // Do not remove this field without also
      // checking contributionObligation.service.js.
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
      // DUE DATE
      // ========================================
      //
      // The date by which the obligation should
      // be fulfilled.
      //
      // ========================================

      due_date: {

        type:
          Date,

        required:
          true,

        index:
          true

      },


      // ========================================
      // OBLIGATION STATUS
      // ========================================
      //
      // pending
      //
      // partially_paid
      //
      // paid
      //
      // overdue
      //
      // waived
      //
      // cancelled
      //
      // ========================================

      status: {

        type:
          String,

        enum: [

          'pending',

          'partially_paid',

          'paid',

          'overdue',

          'waived',

          'cancelled'

        ],

        default:
          'pending',

        required:
          true,

        index:
          true

      },


      // ========================================
      // PERIOD START
      // ========================================
      //
      // Start of the contribution period.
      //
      // Example:
      //
      // January 1
      //
      // ========================================

      period_start: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // PERIOD END
      // ========================================
      //
      // End of the contribution period.
      //
      // Example:
      //
      // January 31
      //
      // ========================================

      period_end: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // NOTES
      // ========================================

      notes: {

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
      // WAIVED BY
      // ========================================
      //
      // User who waived the obligation.
      //
      // ========================================

      waived_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default:
          null

      },


      // ========================================
      // WAIVED AT
      // ========================================

      waived_at: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // WAIVER REASON
      // ========================================

      waiver_reason: {

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
      // CANCELLED AT
      // ========================================

      cancelled_at: {

        type:
          Date,

        default:
          null

      },


      // ========================================
      // CANCELLATION REASON
      // ========================================

      cancellation_reason: {

        type:
          String,

        default:
          '',

        trim:
          true,

        maxlength:
          500

      }

    },

    {

      timestamps:
        true

    }

  );


// ========================================
// PLAN + PARTICIPANT LOOKUP
// ========================================
//
// Find obligations belonging to a specific
// participant under a specific plan.
//
// ========================================

contributionObligationSchema.index({

  plan_id:
    1,

  participant_type:
    1,

  participant_id:
    1

});


// ========================================
// OWNER + PARTICIPANT LOOKUP
// ========================================
//
// Find all obligations belonging to a
// participant within a Chama or
// ContributionGroup.
//
// ========================================

contributionObligationSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  participant_type:
    1,

  participant_id:
    1,

  status:
    1

});


// ========================================
// PARTICIPANT + DUE DATE LOOKUP
// ========================================
//
// Useful for:
//
// - Upcoming obligations
// - Overdue obligations
// - Member financial dashboards
//
// ========================================

contributionObligationSchema.index({

  participant_type:
    1,

  participant_id:
    1,

  due_date:
    1,

  status:
    1

});


// ========================================
// OWNER + DUE DATE LOOKUP
// ========================================
//
// Useful for:
//
// - Group financial dashboards
// - Treasurer reports
// - Outstanding obligations
// - Overdue contribution reports
//
// ========================================

contributionObligationSchema.index({

  owner_type:
    1,

  owner_id:
    1,

  due_date:
    1,

  status:
    1

});


// ========================================
// PLAN + PERIOD LOOKUP
// ========================================
//
// Useful for identifying obligations
// generated for a specific contribution
// period.
//
// ========================================

contributionObligationSchema.index({

  plan_id:
    1,

  period_start:
    1,

  period_end:
    1

});


// ========================================
// PREVENT DUPLICATE OBLIGATIONS
// ========================================
//
// A participant should normally have only
// ONE obligation for a specific plan and
// contribution period.
//
// Example:
//
// Plan:
//   Monthly Savings
//
// Participant:
//   ContributionGroupMember X
//
// Period:
//   January 2026
//
// Only ONE obligation should exist.
//
// IMPORTANT:
//
// This index only applies when period_start
// and period_end are present.
//
// One-time plans may use null periods and
// should be handled explicitly by the service.
//
// ========================================

contributionObligationSchema.index(

  {

    plan_id:
      1,

    participant_type:
      1,

    participant_id:
      1,

    period_start:
      1,

    period_end:
      1

  },

  {

    unique:
      true,

    partialFilterExpression: {

      period_start: {

        $type:
          'date'

      },

      period_end: {

        $type:
          'date'

      }

    },

    name:
      'unique_participant_plan_contribution_period'

  }

);


// ========================================
// JSON TRANSFORM
// ========================================
// Mongoose Decimal128 fields serialize by default as
// { $numberDecimal: "1000" } — an object, not a number. Frontend code
// doing Number(obligation.expected_amount) on that gets NaN. Convert to a
// plain string here, matching the pattern already used on
// FinancialAccount/FinancialTransaction/ContributionPayment, so every
// consumer of this model (e.g. RecordContributionPage) gets a value that
// Number()/parseFloat() actually understands.
contributionObligationSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.expected_amount !== undefined && ret.expected_amount !== null) {
      ret.expected_amount = ret.expected_amount.toString();
    }
    if (ret.paid_amount !== undefined && ret.paid_amount !== null) {
      ret.paid_amount = ret.paid_amount.toString();
    }
    return ret;
  }
});


// ========================================
// EXPORT MODEL
// ========================================

export default mongoose.model(

  'ContributionObligation',

  contributionObligationSchema

);