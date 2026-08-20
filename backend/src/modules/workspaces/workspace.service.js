import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";
import Business from "../../models/Business.js";

import {
    mapChamaWorkspace,
    mapContributionWorkspace
} from "./workspace.mapper.js";
import { mapBusinessWorkspace } from "./workspace.mapper.js";

import {
    WORKSPACE_STATUS
} from "./workspace.constants.js";

/**
 * ==========================================================
 * Resolve every workspace accessible by a user.
 *
 * A Workspace is NOT a database model.
 *
 * It aggregates:
 *  • Chamas
 *  • Contribution Groups
 * ==========================================================
 */
export async function getUserWorkspaces(userId) {

    const [chamas, contributionGroups, businesses] = await Promise.all([
        loadChamaWorkspaces(userId),
        loadContributionGroupWorkspaces(userId),
        Business.find({ created_by: userId })
    ]);

    return [
        ...chamas,
        ...contributionGroups,
        ...businesses.map(mapBusinessWorkspace)
    ].sort(sortWorkspaces);

}

/**
 * ==========================================================
 * Load Chama Workspaces
 * ==========================================================
 */
async function loadChamaWorkspaces(userId) {

    const memberships = await ChamaMembership
        .find({
            user_id: userId,
            status: WORKSPACE_STATUS.ACTIVE
        })
        .populate("chama_id");

    return memberships
        // Ignore memberships whose chama has been deleted
        .filter(membership => membership.chama_id)
        .map(membership =>
            mapChamaWorkspace(
                membership,
                membership.chama_id
            )
        );

}

/**
 * ==========================================================
 * Load Contribution Group Workspaces
 * ==========================================================
 */
async function loadContributionGroupWorkspaces(userId) {

    const memberships = await ContributionGroupMember
        .find({
            user_id: userId,
            status: WORKSPACE_STATUS.ACTIVE
        })
        .populate("contribution_group_id");

    return memberships
        // Ignore memberships whose group has been deleted
        .filter(membership => membership.contribution_group_id)
        .map(membership =>
            mapContributionWorkspace(
                membership,
                membership.contribution_group_id
            )
        );

}

/**
 * ==========================================================
 * Workspace Sorting
 *
 * Most recently active workspaces appear first.
 * If activity dates are unavailable,
 * fall back to alphabetical order.
 * ==========================================================
 */
function sortWorkspaces(a, b) {

    if (a.lastActivity && b.lastActivity) {
        return (
            new Date(b.lastActivity) -
            new Date(a.lastActivity)
        );
    }

    return a.name.localeCompare(b.name);

}
