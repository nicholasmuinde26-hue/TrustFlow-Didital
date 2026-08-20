import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";

export async function canAccessWorkspace(
  userId,
  workspaceId,
  workspaceType
) {

  if (workspaceType === "chama") {

    const exists =
      await ChamaMembership.exists({

        chama_id: workspaceId,

        user_id: userId,

        status: "active",

      });

    return !!exists;
  }

  const exists =
    await ContributionGroupMember.exists({

      contribution_group_id:
        workspaceId,

      user_id: userId,

      status: "active",

    });

  return !!exists;
}