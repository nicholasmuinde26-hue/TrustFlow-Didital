
import mongoose from "mongoose";

import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";

// ============================================================================
// HELPERS
// ============================================================================

function toObjectId(value) {
  if (!value) return null;

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return null;
  }

  return new mongoose.Types.ObjectId(value);
}

// ============================================================================
// WORKSPACE ACCESS
// ============================================================================

export async function canAccessWorkspace(
  userId,
  workspaceId,
  workspaceType
) {
  const userObjectId = toObjectId(userId);
  const workspaceObjectId = toObjectId(workspaceId);

  if (!userObjectId || !workspaceObjectId) {
    return false;
  }

  // --------------------------------------------------------------------------
  // CHAMA
  // --------------------------------------------------------------------------

  if (workspaceType === "chama") {
    const exists =
      await ChamaMembership.exists({
        chama_id: workspaceObjectId,
        user_id: userObjectId,
        status: "active",
      });

    return !!exists;
  }

  // --------------------------------------------------------------------------
  // CONTRIBUTION GROUP
  // --------------------------------------------------------------------------

  if (workspaceType === "contribution-group") {
    const exists =
      await ContributionGroupMember.exists({
        contribution_group_id:
          workspaceObjectId,

        user_id: userObjectId,

        status: "active",
      });

    return !!exists;
  }

  return false;
}

// ============================================================================
// DIRECT MESSAGE ACCESS
// ============================================================================
//
// Two users can direct-message each other when:
//
// 1. They are different users.
// 2. Both are active members of at least one shared Chama
//    OR
// 3. Both are active members of at least one shared Contribution Group.
//
// Contribution Groups are independent from Chamas.
//
// ============================================================================

export async function canDirectMessage(
  userAId,
  userBId
) {
  const userAObjectId = toObjectId(userAId);
  const userBObjectId = toObjectId(userBId);

  // --------------------------------------------------------------------------
  // Invalid IDs
  // --------------------------------------------------------------------------

  if (!userAObjectId || !userBObjectId) {
    return false;
  }

  // --------------------------------------------------------------------------
  // Prevent self messaging
  // --------------------------------------------------------------------------

  if (
    userAObjectId.equals(userBObjectId)
  ) {
    return false;
  }

  // --------------------------------------------------------------------------
  // Find shared Chama or Contribution Group
  //
  // We use ObjectIds explicitly because aggregation does not give us the
  // same convenient casting behavior that normal Mongoose queries provide.
  // --------------------------------------------------------------------------

  const [sharedChama, sharedGroup] =
    await Promise.all([
      // ======================================================================
      // SHARED CHAMA
      // ======================================================================

      ChamaMembership.aggregate([
        {
          $match: {
            user_id: {
              $in: [
                userAObjectId,
                userBObjectId,
              ],
            },

            status: "active",
          },
        },

        {
          $group: {
            _id: "$chama_id",

            users: {
              $addToSet: "$user_id",
            },
          },
        },

        {
          $match: {
            users: {
              $all: [
                userAObjectId,
                userBObjectId,
              ],
            },
          },
        },

        {
          $limit: 1,
        },
      ]),

      // ======================================================================
      // SHARED CONTRIBUTION GROUP
      // ======================================================================

      ContributionGroupMember.aggregate([
        {
          $match: {
            user_id: {
              $in: [
                userAObjectId,
                userBObjectId,
              ],
            },

            status: "active",
          },
        },

        {
          $group: {
            _id: "$contribution_group_id",

            users: {
              $addToSet: "$user_id",
            },
          },
        },

        {
          $match: {
            users: {
              $all: [
                userAObjectId,
                userBObjectId,
              ],
            },
          },
        },

        {
          $limit: 1,
        },
      ]),
    ]);

  // --------------------------------------------------------------------------
  // Authorization result
  // --------------------------------------------------------------------------

  return (
    sharedChama.length > 0 ||
    sharedGroup.length > 0
  );
}
