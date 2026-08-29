import {

  createContributionGroup,
  inviteUserToContributionGroup,
  getMyContributionGroupInvitations,
  acceptContributionGroupInvitation,
   getContributionGroupById,
   getMyContributionGroups,
   updateContributionGroup,
   updateContributionGroupStatus

} from './contributionGroup.service.js';


import {

  addContributionGroupMember,

  getContributionGroupMembers,

  removeContributionGroupMember,

  updateContributionGroupMemberRole,



} from './contributionGroupMember.service.js';

import User from '../../models/User.js';
import { formatPhone, isValidKenyanPhone } from '../../utils/phone.js';




// ========================================
// CREATE CONTRIBUTION GROUP
// ========================================
//
// POST
// /api/v1/contribution-groups
//
// REQUIREMENTS:
//
// 1. User must be authenticated
// 2. User does NOT need Chama membership
// 3. User can create only ONE active
//    Contribution Group
// 4. The authenticated user automatically
//    becomes the organizer
// 5. The creator is automatically added to
//    ContributionGroupMember as:
//
//    role: organizer
//
// ========================================

export const createContributionGroupController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 2. VALIDATE AUTHENTICATION
    // ======================================

    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:
          false,

        message:
          'Authenticated user is required'

      });

    }


    // ======================================
    // 3. EXTRACT REQUEST BODY
    // ======================================

    const {

      name,

      description,

      type,

      event_date,

      location,

      visibility

    } =

      req.body;


    // ======================================
    // 4. CREATE CONTRIBUTION GROUP
    // ======================================

    const result =

      await createContributionGroup({

        actorUserId,

        name,

        description,

        type,

        event_date,

        location,

        visibility

      });


    // ======================================
    // 5. RETURN SUCCESS RESPONSE
    // ======================================

    return res.status(201).json({

      success:
        true,

      message:
        'Contribution group created successfully',

      data: {

        group:
          result.group,

        membership:
          result.organizerMembership

      }

    });


  } catch (error) {

    // ======================================
    // 6. PASS ERROR TO EXPRESS ERROR HANDLER
    // ======================================

    return next(

      error

    );

  }

};



// ========================================
// ADD MEMBER TO CONTRIBUTION GROUP
// ========================================
//
// POST
// /api/v1/contribution-groups/:groupId/members
//
// REQUIREMENTS:
//
// 1. User must be authenticated
// 2. Actor must be an active member
// 3. Actor must be organizer or co_organizer
// 4. Target user must exist
// 5. Target user must be active
// 6. Target user cannot already belong
//    to this group
//
// The new member is automatically created as:
//
// role:
// member
//
// status:
// active
//
// ========================================

export const addContributionGroupMemberController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 2. GET GROUP ID
    // ======================================

    const groupId =

      req.params.groupId;


    // ======================================
    // 3. GET TARGET USER ID
    // ======================================

    const { userId, phone } = req.body;


    // ======================================
    // 4. VALIDATE AUTHENTICATION
    // ======================================

    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:
          false,

        message:
          'Authentication required'

      });

    }


    // ======================================
    // 5. VALIDATE GROUP ID
    // ======================================

    if (

      !groupId

    ) {

      return res.status(400).json({

        success:
          false,

        message:
          'Contribution group ID is required'

      });

    }


    // ======================================
    // 6. VALIDATE TARGET USER ID
    // ======================================

    let targetUserId = userId;

    if (!targetUserId && phone) {
      const normalizedPhone = formatPhone(phone);

      if (!isValidKenyanPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid Kenyan phone number' });
      }

      const registeredUser = await User.findOne({ phone: normalizedPhone }).select('_id status');
      if (!registeredUser) {
        return res.status(404).json({ success: false, message: 'No account is registered with this phone number' });
      }
      if (registeredUser.status !== 'active') {
        return res.status(403).json({ success: false, message: 'This user account is not active' });
      }
      targetUserId = registeredUser._id;
    }

    if (!targetUserId) {

      return res.status(400).json({

        success:
          false,

        message:
          'A registered user ID or phone number is required'

      });

    }


    // ======================================
    // 7. ADD MEMBER
    // ======================================

    const result =

      await addContributionGroupMember({

        actorUserId,

        groupId,

        userId: targetUserId

      });


    // ======================================
    // 9. RETURN SUCCESS RESPONSE
    // ======================================

    return res.status(201).json({

      success:
        true,

      message:
        'Member added to contribution group successfully',

      data: {

        membership:
          result.membership

      }

    });


  } catch (error) {

    // ======================================
    // 10. PASS ERROR TO EXPRESS ERROR HANDLER
    // ======================================

    return next(

      error

    );

  }

};

// ========================================
// GET CONTRIBUTION GROUP MEMBERS
// ========================================
//
// GET
// /api/v1/contribution-groups/:groupId/members
//
// Requirements:
//
// 1. User must be authenticated.
// 2. User must be an active member.
//
// Any active member can view the members
// of the group.
//
// ========================================

export const getContributionGroupMembersController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET GROUP ID
    // ======================================

    const groupId =

      req.params.groupId;


    // ======================================
    // 2. GET MEMBERS
    // ======================================

    const result =

      await getContributionGroupMembers({

        groupId

      });


    // ======================================
    // 3. RETURN SUCCESS RESPONSE
    // ======================================

    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group members retrieved successfully',

      data: {

        group:

          result.group,

        members:

          result.members,

        total:

          result.total

      }

    });


  } catch (error) {

    return next(

      error

    );

  }

};



// ========================================
// REMOVE CONTRIBUTION GROUP MEMBER
// ========================================
//
// DELETE
// /api/v1/contribution-groups/:groupId/members/:memberId
//
// Requirements:
//
// 1. User must be authenticated.
// 2. User must be an active group member.
// 3. User must have management privileges.
// 4. Target membership must exist.
// 5. Target membership must be active.
// 6. Organizer cannot be removed.
//
// The membership is soft removed:
//
// active
//    ↓
// removed
//
// ========================================

export const removeContributionGroupMemberController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET GROUP ID
    // ======================================

    const groupId =

      req.params.groupId;


    // ======================================
    // 2. GET MEMBERSHIP ID
    // ======================================

    const memberId =

      req.params.memberId;


    // ======================================
    // 3. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 4. REMOVE MEMBER
    // ======================================

    const result =

      await removeContributionGroupMember({

        groupId,

        memberId,

        actorUserId

      });


    // ======================================
    // 5. RETURN SUCCESS
    // ======================================

    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group member removed successfully',

      data: {

        group:

          result.group,

        membership:

          result.membership

      }

    });


  } catch (error) {

    return next(

      error

    );

  }

};


// ========================================
// UPDATE CONTRIBUTION GROUP MEMBER ROLE
// ========================================
//
// PATCH
// /api/v1/contribution-groups/:groupId/members/:memberId/role
//
// Body:
//
// {
//   "role": "co_organizer"
// }
//
// OR:
//
// {
//   "role": "member"
// }
//
// ========================================

export const updateContributionGroupMemberRoleController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET GROUP ID
    // ======================================

    const groupId =

      req.params.groupId;


    // ======================================
    // 2. GET MEMBERSHIP ID
    // ======================================

    const memberId =

      req.params.memberId;


    // ======================================
    // 3. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 4. GET REQUESTED ROLE
    // ======================================

    const {

      role

    } =

      req.body;


    // ======================================
    // 5. UPDATE MEMBER ROLE
    // ======================================

    const result =

      await updateContributionGroupMemberRole({

        groupId,

        memberId,

        actorUserId,

        role

      });


    // ======================================
    // 6. RETURN SUCCESS
    // ======================================

    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group member role updated successfully',

      data: {

        group:

          result.group,

        membership:

          result.membership,

        previousRole:

          result.previousRole,

        newRole:

          result.newRole

      }

    });


  } catch (error) {

    return next(

      error

    );

  }

};
// ========================================
// INVITE USER TO CONTRIBUTION GROUP
// ========================================
//
// POST
// /api/v1/contribution-groups/:groupId/invitations
//
// Allowed:
// - organizer
// - co_organizer
//
// The invited user receives a pending
// invitation.
//
// The user does NOT become a member yet.
//
// ========================================

export const inviteUserToContributionGroupController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 2. GET GROUP ID
    // ======================================

    const groupId =

      req.params.groupId;


    // ======================================
    // 3. GET REQUEST BODY
    // ======================================

    const {

      userId,

      phone,

      message,

      expiresAt

    } =

      req.body;


    let invitedUserId = userId;

    if (!invitedUserId && phone) {
      const normalizedPhone = formatPhone(phone);

      if (!isValidKenyanPhone(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Enter a valid Kenyan phone number' });
      }

      const invitedUser = await User.findOne({ phone: normalizedPhone }).select('_id');

      if (!invitedUser) {
        return res.status(404).json({ success: false, message: 'No account is registered with this phone number' });
      }

      invitedUserId = invitedUser._id;
    }

    if (!invitedUserId) {
      return res.status(400).json({ success: false, message: 'A phone number is required' });
    }

    // ======================================
    // 4. VALIDATE AUTHENTICATION
    // ======================================

    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:

          false,

        message:

          'Authenticated user is required'

      });

    }


    // ======================================
    // 5. INVITE USER
    // ======================================

    const result =

      await inviteUserToContributionGroup({

        actorUserId,

        groupId,

        invitedUserId,

        message,

        expiresAt

      });


    // ======================================
    // 6. SUCCESS RESPONSE
    // ======================================

    return res.status(201).json({

      success:

        true,

      message:

        'Contribution group invitation sent successfully',

      data: {

        invitation:

          result.invitation

      }

    });

  } catch (error) {

    next(error);

  }

};

// ========================================
// GET MY CONTRIBUTION GROUP INVITATIONS
// ========================================
//
// GET
// /api/v1/contribution-groups/invitations
//
// GET
// /api/v1/contribution-groups/invitations
// ?status=pending
//
// Any authenticated user can view their
// own invitations.
//
// ========================================

export const getMyContributionGroupInvitationsController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 2. VALIDATE AUTHENTICATION
    // ======================================

    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:

          false,

        message:

          'Authenticated user is required'

      });

    }


    // ======================================
    // 3. GET OPTIONAL STATUS FILTER
    // ======================================

    const {

      status

    } =

      req.query;


    // ======================================
    // 4. GET INVITATIONS
    // ======================================

    const result =

      await getMyContributionGroupInvitations({

        actorUserId,

        status

      });


    // ======================================
    // 5. RETURN SUCCESS RESPONSE
    // ======================================

    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group invitations retrieved successfully',

      data: {

        invitations:

          result.invitations,

        total:

          result.total

      }

    });

  } catch (error) {

    next(error);

  }

};

// ========================================
// ACCEPT CONTRIBUTION GROUP INVITATION
// ========================================
//
// PATCH
// /api/v1/contribution-groups/invitations/:invitationId/accept
//
// Only the invited user can accept
// their own invitation.
//
// ========================================

export const acceptContributionGroupInvitationController = async (

  req,

  res,

  next

) => {

  try {

    // ======================================
    // 1. GET AUTHENTICATED USER
    // ======================================

    const actorUserId =

      req.user?._id;


    // ======================================
    // 2. GET INVITATION ID
    // ======================================

    const {

      invitationId

    } =

      req.params;


    // ======================================
    // 3. VALIDATE AUTHENTICATION
    // ======================================

    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:

          false,

        message:

          'Authenticated user is required'

      });

    }


    // ======================================
    // 4. ACCEPT INVITATION
    // ======================================

    const result =

      await acceptContributionGroupInvitation({

        invitationId,

        actorUserId

      });


    // ======================================
    // 5. SUCCESS RESPONSE
    // ======================================

    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group invitation accepted successfully',

      data: {

        invitation:

          result.invitation,

        membership:

          result.membership,

        group:

          result.group

      }

    });

  }

  catch (error) {

    return next(

      error

    );

  }

};

// ========================================
// DECLINE CONTRIBUTION GROUP INVITATION
// ========================================
//
// PATCH
// /api/v1/contribution-groups/invitations/:invitationId/decline
//
// Only the invited user can decline
// their own invitation.
//
// ========================================

export const declineContributionGroupInvitationController = async (

  req,

  res,

  next

) => {

  try {

    const actorUserId = req.user?._id;

    const { invitationId } = req.params;

    if (!actorUserId) {
      return res.status(401).json({
        success: false,
        message: 'Authenticated user is required'
      });
    }

    const result = await declineContributionGroupInvitation({
      invitationId,
      actorUserId
    });

    return res.status(200).json({
      success: true,
      message: 'Contribution group invitation declined',
      data: {
        invitation: result.invitation
      }
    });

  } catch (error) {

    return next(error);

  }

};

// ========================================
// GET CONTRIBUTION GROUP
// ========================================
//
// GET
// /api/v1/contribution-groups/:groupId
//
// ========================================

export const getContributionGroupController = async (

  req,

  res,

  next

) => {

  try {

    const actorUserId =

      req.user?._id;


    const {

      groupId

    } =

      req.params;


    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:

          false,

        message:

          'Authenticated user is required'

      });

    }


    const result =

      await getContributionGroupById({

        groupId,

        actorUserId

      });


    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group retrieved successfully',

      data: {

        group:

          result.group,

        membership:

          result.membership,

        memberCount:

          result.memberCount

      }

    });

  }

  catch (error) {

    return next(error);

  }

};

// ========================================
// GET MY CONTRIBUTION GROUPS
// ========================================
//
// GET
// /api/v1/contribution-groups/my-groups
//
// ========================================

export const getMyContributionGroupsController = async (

  req,

  res,

  next

) => {

  try {

    const actorUserId =

      req.user?._id;


    if (

      !actorUserId

    ) {

      return res.status(401).json({

        success:

          false,

        message:

          'Authenticated user is required'

      });

    }


    const result =

      await getMyContributionGroups({

        actorUserId

      });


    return res.status(200).json({

      success:

        true,

      message:

        'Your contribution groups retrieved successfully',

      data: {

        groups:

          result.groups,

        total:

          result.total

      }

    });

  }

  catch (error) {

    return next(error);

  }

};

// ========================================
// UPDATE CONTRIBUTION GROUP
// ========================================
//
// PATCH
// /api/v1/contribution-groups/:groupId
//
// ========================================

export const updateContributionGroupController = async (

  req,

  res,

  next

) => {

  try {

    const actorUserId =

      req.user?._id;


    const {

      groupId

    } =

      req.params;


    const {

      name,

      description,

      type,

      event_date,

      location,

      visibility

    } =

      req.body;


    const result =

      await updateContributionGroup({

        groupId,

        actorUserId,

        name,

        description,

        type,

        event_date,

        location,

        visibility

      });


    return res.status(200).json({

      success:

        true,

      message:

        'Contribution group updated successfully',

      data: {

        group:

          result.group

      }

    });

  }

  catch (error) {

    return next(error);

  }

};

// ========================================
// UPDATE CONTRIBUTION GROUP STATUS
// ========================================
//
// PATCH
// /api/v1/contribution-groups/:groupId/status
//
// Primary organizer only.
//
// ========================================

export const updateContributionGroupStatusController = async (

  req,

  res,

  next

) => {

  try {

    const actorUserId =

      req.user?._id;


    const {

      groupId

    } =

      req.params;


    const {

      status

    } =

      req.body;


    const result =

      await updateContributionGroupStatus({

        groupId,

        actorUserId,

        status

      });


    return res.status(200).json({

      success:

        true,

      message:

        `Contribution group marked as ${status} successfully`,

      data: {

        group:

          result.group

      }

    });

  }

  catch (error) {

    return next(error);

  }

};