import mongoose from 'mongoose';


// ========================================
// CONTRIBUTION GROUP INVITATION SCHEMA
// ========================================
//
// Represents an invitation sent to a user
// to join a ContributionGroup.
//
// IMPORTANT:
//
// Invitation != Membership
//
// The user only becomes a member after
// accepting the invitation.
//
// ========================================
//
// INVITATION FLOW:
//
// pending
//    │
//    ├── accepted
//    │
//    └── declined
//
// ========================================


const contributionGroupInvitationSchema =

  new mongoose.Schema(

    {

      // ======================================
      // CONTRIBUTION GROUP
      // ======================================

      contribution_group_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'ContributionGroup',

        required: true,

        index: true

      },


      // ======================================
      // INVITED USER
      // ======================================
      //
      // The user receiving the invitation.
      //
      // ======================================

      invited_user_id: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required: true,

        index: true

      },


      // ======================================
      // INVITED BY
      // ======================================
      //
      // Organizer or co-organizer who
      // created the invitation.
      //
      // ======================================

      invited_by: {

        type:
          mongoose.Schema.Types.ObjectId,

        ref:
          'User',

        required: true

      },


      // ======================================
      // INVITATION STATUS
      // ======================================

      status: {

        type: String,

        enum: [

          'pending',

          'accepted',

          'declined',

          'cancelled',

          'expired'

        ],

        default:
          'pending',

        index: true

      },


      // ======================================
      // INVITATION MESSAGE
      // ======================================

      message: {

        type: String,

        trim: true,

        maxlength: 500,

        default: null

      },


      // ======================================
      // RESPONDED AT
      // ======================================

      responded_at: {

        type: Date,

        default: null

      },


      // ======================================
      // EXPIRES AT
      // ======================================
      //
      // Optional invitation expiration.
      //
      // We can use this later for automatic
      // expiration.
      //
      // ======================================

      expires_at: {

        type: Date,

        default: null

      }

    },

    {

      timestamps: true

    }

  );


// ========================================
// ONE PENDING INVITATION PER USER/GROUP
// ========================================
//
// A user should not receive multiple
// active pending invitations to the same
// contribution group.
//
// Example:
//
// Group A + User B
//      ↓
// ONE pending invitation
//
// After accepted/declined/cancelled,
// another invitation can be created.
//
// ========================================

contributionGroupInvitationSchema.index(

  {

    contribution_group_id: 1,

    invited_user_id: 1,

    status: 1

  },

  {

    unique: true,

    partialFilterExpression: {

      status: 'pending'

    },

    name:
      'unique_pending_group_invitation'

  }

);


// ========================================
// USER INVITATION LOOKUP
// ========================================
//
// Useful for:
//
// GET /invitations
//
// Find all invitations received by
// a particular user.
//
// ========================================

contributionGroupInvitationSchema.index({

  invited_user_id: 1,

  status: 1,

  createdAt: -1

});


// ========================================
// GROUP INVITATION LOOKUP
// ========================================
//
// Useful for organizers to see invitations
// sent by their group.
//
// ========================================

contributionGroupInvitationSchema.index({

  contribution_group_id: 1,

  status: 1,

  createdAt: -1

});


// ========================================
// EXPORT MODEL
// ========================================

const ContributionGroupInvitation =

  mongoose.model(

    'ContributionGroupInvitation',

    contributionGroupInvitationSchema

  );


export default ContributionGroupInvitation;