import {
    WORKSPACE_TYPES
} from "./workspace.constants.js";
import { WORKSPACE_STATUS } from "./workspace.constants.js";

export function mapChamaWorkspace(
    membership,
    chama,
    memberCount = 0,
    members = []
){

    return{

        id:chama._id,

        workspaceId:chama._id,

        type:WORKSPACE_TYPES.CHAMA,

        name:chama.name,

        description:chama.description,

        role:membership.role,

        currency:chama.currency,

        status:chama.status,

        memberCount,

        members,

        avatar:
            chama.logo ?? null,

        lastActivity:
            chama.updatedAt

    };

}

export function mapContributionWorkspace(
    membership,
    group,
    memberCount = 0,
    members = []
){

    return{

        id:group._id,

        workspaceId:group._id,

        type:WORKSPACE_TYPES.CONTRIBUTION_GROUP,

        name:group.name,

        description:group.description,

        role:membership.role,

        currency:group.currency,

        status:group.status,

        memberCount,

        members,

        avatar:
            group.logo ?? null,

        lastActivity:
            group.updatedAt

    };

}

export function mapBusinessWorkspace(business) {
    return {
        id: business._id,
        workspaceId: business._id,
        type: WORKSPACE_TYPES.BUSINESS,
        name: business.name,
        role: "owner",
        category: business.category,
        category_label: business.category_label,
        currency: business.currency,
        status: WORKSPACE_STATUS.ACTIVE,
        lastActivity: business.updatedAt
    };
}