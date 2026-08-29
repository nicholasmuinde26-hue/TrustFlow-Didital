import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION GROUP MEMBER SCHEMA
// ========================================
//
// This model represents a USER'S
// PARTICIPATION in a ContributionGroup.
//
// It does NOT determine whether a user
// owns/created an active group.
//
// Ownership is determined ONLY by:
//
//     ContributionGroup.created_by
//
// ========================================
//
// VALID ROLES
//
// organizer
//     The primary organizer.
//
// co_organizer
//     A trusted user helping manage
//     the group.
//
// member
//     A normal participant.
//
// ========================================
//
// BUSINESS RULES
//
// 1. The creator automatically receives
//    an `organizer` membership.
//
// 2. A user can be a `member` in unlimited
//    groups.
//
// 3. A user can be a `co_organizer` in
//    unlimited groups.
//
// 4. A user can only have ONE membership
//    record per group.
//
// 5. The organizer role represents the
//    creator's membership in that group.
//
// 6. The organizer ownership rule itself
//    is enforced by:
//
//    ContributionGroup.created_by
//
// ========================================


const contributionGroupMemberSchema =

  new mongoose.Schema(

    {

      // ======================================
      // USER
      // ======================================
      //
      // The user participating in the group.
      //
      // ======================================

      user_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required: true

      },


      // ======================================
      // CONTRIBUTION GROUP
      // ======================================
      //
      // The group this membership belongs to.
      //
      // ======================================

      contribution_group_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'ContributionGroup',

        required: true

      },


      // ======================================
      // MEMBER ROLE
      // ======================================
      //
      // organizer
      // co_organizer
      // member
      //
      // ======================================

      role: {

        type: String,

        enum: [

          'organizer',

          'co_organizer',

          'treasurer',

          'member'

        ],

        default: 'member',

        required: true

      },


      // ======================================
      // MEMBERSHIP STATUS
      // ======================================

      status: {

  type: String,

  enum: [

    'active',

    'removed'

  ],

  default: 'active',

  index: true

},


      // ======================================
      // JOINED DATE
      // ======================================

      joined_at: {

        type: Date,

        default: null

      },

      accepted_at: {
  type: Date,
  default: null
},


      // ======================================
      // INVITED BY
      // ======================================

      invited_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        default: null

      }

    },

    {

      timestamps: true

    }

  );


// ========================================
// ONE MEMBERSHIP PER USER PER GROUP
// ========================================
//
// A user cannot have multiple membership
// records for the same group.
//
// Example:
//
// User A + Group 1
//     -> ONE membership
//
// User A + Group 2
//     -> ONE membership
//
// User A + Group 3
//     -> ONE membership
//
// But User A can belong to unlimited
// different groups.
//
// ========================================

contributionGroupMemberSchema.index(

  {

    user_id: 1,

    contribution_group_id: 1

  },

  {

    unique: true,

    name:
      'unique_user_contribution_group_membership'

  }

);


// ========================================
// USER MEMBERSHIP LOOKUP
// ========================================
//
// Find all groups where a user belongs.
//
// ========================================

contributionGroupMemberSchema.index({

  user_id: 1,

  status: 1

});


// ========================================
// GROUP MEMBERSHIP LOOKUP
// ========================================
//
// Find all members of a group.
//
// ========================================

contributionGroupMemberSchema.index({

  contribution_group_id: 1,

  status: 1

});


// ========================================
// GROUP ROLE LOOKUP
// ========================================
//
// Useful for finding organizers,
// co-organizers, etc.
//
// ========================================

contributionGroupMemberSchema.index({

  contribution_group_id: 1,

  role: 1,

  status: 1

});


// ========================================
// EXPORT MODEL
// ========================================

const ContributionGroupMember =

  mongoose.model(

    'ContributionGroupMember',

    contributionGroupMemberSchema

  );


export default ContributionGroupMember;
