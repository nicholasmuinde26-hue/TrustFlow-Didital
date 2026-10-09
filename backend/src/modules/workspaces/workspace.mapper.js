import {
    WORKSPACE_TYPES
} from "./workspace.constants.js";
import { WORKSPACE_STATUS } from "./workspace.constants.js";
import { getEnabledModules } from "../../constants/workspaceModules.constants.js";

export function mapChamaWorkspace(
    membership,
    chama,
    memberCount = 0,
    members = []
){

    return{

        id:chama._id,

        workspaceId:chama._id,

        type:
            chama.chama_type === 'burial'
                ? WORKSPACE_TYPES.BURIAL_CHAMA
                : WORKSPACE_TYPES.CHAMA,

        name:chama.name,

        description:chama.description,

        role:membership.role,

        // The viewer's own membership id within this workspace — the
        // frontend needs this to tell "is this loan/action mine?" apart
        // from "is this someone else's?" (e.g. conflict-of-interest
        // recusal checks on the loan approvals queue).
        membershipId:membership._id,

        currency:chama.currency,

        status:chama.status,

        // The feature modules this chama's workspace contains. The frontend
        // builds navigation, route guards and the command palette from this,
        // so a chama without loans never sees a Loans link anywhere. Always
        // present: chamas with no stored config resolve to their legacy set.
        modules:getEnabledModules(chama),

        modulePreset:chama.workspace_config?.preset ?? null,

        config: chama.workspace_config || {
            preset: chama.workspace_config?.preset || (chama.chama_type === 'burial' ? 'burial' : 'standard'),
            modules: getEnabledModules(chama).reduce((acc, k) => ({ ...acc, [k]: { enabled: true } }), {}),
            terminology: { workspace: 'Chama' },
            version: 1
        },

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

        // See mapChamaWorkspace — the viewer's own membership id in this
        // workspace, used by the frontend for "is this mine?" checks.
        membershipId:membership._id,

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

export function mapBusinessWorkspace(business, chamaMembership = null, chamaName = null) {
    const isChamaOwned = business.owner_type === "chama";
    const chamaRole = chamaMembership?.role || "member";
    return {
        id: business._id,
        workspaceId: business._id,
        type: WORKSPACE_TYPES.BUSINESS,
        name: business.name,
        role: business.owner_type === "chama" ? (chamaMembership?.role || "member") : "owner",
        ownerType: business.owner_type || "user",
        chamaId: isChamaOwned ? business.owner_id : null,
        // Shown as the "Chama-owned" badge. The business is owned by the chama,
        // never by the officer who requested it.
        chamaName: isChamaOwned ? chamaName : null,
        isChamaOwned,
        // Leaders manage; other members are read-only (the server enforces this too).
        canManage: isChamaOwned ? ["chairperson", "treasurer"].includes(chamaRole) : true,
        category: business.category,
        // Business workspaces already store which nav sections they show; ship it
        // so the sidebar can actually apply it.
        workspaceSettings: business.workspace_settings ?? null,
        category_label: business.category_label,
        currency: business.currency,
        status: WORKSPACE_STATUS.ACTIVE,
        lastActivity: business.updatedAt
    };
}
