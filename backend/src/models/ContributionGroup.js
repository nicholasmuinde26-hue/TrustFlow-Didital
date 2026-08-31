import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION GROUP SCHEMA
// ========================================
//
// BUSINESS RULES
//
// 1. A user can create ONE ACTIVE
//    ContributionGroup.
//
// 2. The user stored in `created_by` is
//    the PRIMARY ORGANIZER.
//
// 3. The creator automatically receives
//    a ContributionGroupMember record
//    with role: `organizer`.
//
// 4. A user can be a `member` in unlimited
//    other ContributionGroups.
//
// 5. A user can be a `co_organizer` in
//    unlimited other ContributionGroups.
//
// 6. Once the user's group is completed,
//    cancelled, or archived, they may
//    create another active group.
//
// ========================================
//
// SOURCE OF TRUTH
//
// The ONLY source of truth for whether a
// user owns/created an active group is:
//
//     created_by
//
// ContributionGroupMember.role = organizer
//
// is a membership representation of the
// creator's relationship with that group.
//
// It is NOT used to determine whether the
// user can create another group.
//
// ========================================


const contributionGroupSchema =
  new mongoose.Schema(

    {

      // ======================================
      // GROUP NAME
      // ======================================

      name: {

        type: String,

        required: [

          true,

          'Contribution group name is required'

        ],

        trim: true,

        minlength: 2,

        maxlength: 100

      },


      // ======================================
      // GROUP DESCRIPTION
      // ======================================

      description: {

        type: String,

        trim: true,

        maxlength: 1000,

        default: null

      },


      // ======================================
      // GROUP TYPE
      // ======================================

      type: {

        type: String,

        enum: [

          'party',

          'wedding',

          'graduation',

          'funeral',

          'birthday',

          'emergency',

          'medical_emergency',

          'fundraiser',

          'community',

          'other'

        ],

        default: 'other',

        index: true

      },


      // ======================================
      // PRIMARY ORGANIZER / CREATOR
      // ======================================
      //
      // SOURCE OF TRUTH
      //
      // This field determines which user
      // owns/created the group.
      //
      // The partial unique index below
      // guarantees that one user can have
      // only ONE ACTIVE group.
      //
      // A user may still belong to unlimited
      // other groups as:
      //
      // member
      // co_organizer
      //
      // ======================================

      created_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required: true

      },


      // ======================================
      // GROUP STATUS
      // ======================================

      status: {

        type: String,

        enum: [

          'active',

          'closing_review',

          'completed',

          'cancelled',

          'archived'

        ],

        default: 'active',

        index: true

      },


      // ======================================
      // GROUP VISIBILITY
      // ======================================

      visibility: {

        type: String,

        enum: [

          'private',

          'invite_only',

          'public'

        ],

        default: 'invite_only'

      },


      // ======================================
      // EVENT DATE
      // ======================================

      event_date: {

        type: Date,

        default: null

      },

      // A time-bound group uses this as its contribution deadline. event_date
      // may be later (for example, a wedding date) and must not be used as
      // the financial close date.
      contribution_end_date: {
        type: Date,
        default: null,
        index: true
      },

      start_date: {
        type: Date,
        default: Date.now
      },

      beneficiary: {
        type: String,
        trim: true,
        maxlength: 150,
        default: null
      },

      target_amount: {
        type: mongoose.Schema.Types.Decimal128,
        default: null,
        min: 0
      },

      // The group is archived only after this post-deadline window and only
      // when there are no arrears or payments still being processed.
      grace_period_days: {
        type: Number,
        default: 7,
        min: 1,
        max: 90
      },

      reminder_policy: {
        organizer_days_before: { type: [Number], default: [14, 7, 3, 1] },
        member_days_before: { type: [Number], default: [7, 3, 1] },
        cooldown_hours: { type: Number, default: 24, min: 1, max: 168 }
      },

      extended_at: { type: Date, default: null },
      extended_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      archived_at: { type: Date, default: null },
      archive_reason: { type: String, trim: true, maxlength: 250, default: null },


      // ======================================
      // LOCATION
      // ======================================

      location: {

        type: String,

        trim: true,

        maxlength: 255,

        default: null

      },

      // ======================================
      // SHAREABLE JOIN CODE
      // ======================================

      join_code: {

        type: String,

        uppercase: true,

        trim: true,

        sparse: true,

        index: true,

        unique: true,

        default: null

      }

    },

    {

      timestamps: true

    }

  );

contributionGroupSchema.pre('save', function (next) {
  if (!this.join_code) {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = 'CG-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    this.join_code = code;
  }
  next();
});


// ========================================
// ONE ACTIVE GROUP PER CREATOR
// ========================================
//
// THIS IS THE PRIMARY BUSINESS RULE.
//
// SOURCE OF TRUTH:
//
//     created_by
//
// Example:
//
// User A
//   -> Group 1 -> active
//
// User A
//   -> Group 2 -> rejected
//
// User B
//   -> Group 2 -> active
//
// If Group 1 becomes:
//
// completed
// cancelled
// archived
//
// User A can create another active group.
//
// ========================================

contributionGroupSchema.index(

  {

    created_by: 1

  },

  {

    unique: true,

    partialFilterExpression: {

      status: 'active'

    },

    name:
      'unique_active_contribution_group_creator'

  }

);


// ========================================
// QUERY INDEX
// ========================================
//
// Useful for retrieving a user's groups
// by status.
//
// ========================================

contributionGroupSchema.index({

  created_by: 1,

  status: 1

});

contributionGroupSchema.index({ status: 1, contribution_end_date: 1 });

contributionGroupSchema.set('toJSON', {
  transform: (_doc, ret) => {
    if (ret.target_amount !== undefined && ret.target_amount !== null) {
      ret.target_amount = ret.target_amount.toString();
    }
    return ret;
  }
});


// ========================================
// TYPE + STATUS
// ========================================

contributionGroupSchema.index({

  type: 1,

  status: 1

});


// ========================================
// EXPORT MODEL
// ========================================

const ContributionGroup =

  mongoose.model(

    'ContributionGroup',

    contributionGroupSchema

  );


export default ContributionGroup;
