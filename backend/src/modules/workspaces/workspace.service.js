import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroup from "../../models/ContributionGroup.js";
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

    const activeMemberships = memberships.filter(membership => membership.chama_id);

    const chamaIds = activeMemberships.map(m => m.chama_id._id);

    const { countsByWorkspace, previewsByWorkspace } = await loadMemberSummaries(
        ChamaMembership,
        "chama_id",
        chamaIds
    );

    return activeMemberships.map(membership =>
        mapChamaWorkspace(
            membership,
            membership.chama_id,
            countsByWorkspace.get(String(membership.chama_id._id)) ?? 0,
            previewsByWorkspace.get(String(membership.chama_id._id)) ?? []
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

    const activeMemberships = memberships.filter(membership => membership.contribution_group_id);

    const groupIds = activeMemberships.map(m => m.contribution_group_id._id);

    const { countsByWorkspace, previewsByWorkspace } = await loadMemberSummaries(
        ContributionGroupMember,
        "contribution_group_id",
        groupIds
    );

    return activeMemberships.map(membership =>
        mapContributionWorkspace(
            membership,
            membership.contribution_group_id,
            countsByWorkspace.get(String(membership.contribution_group_id._id)) ?? 0,
            previewsByWorkspace.get(String(membership.contribution_group_id._id)) ?? []
        )
    );

}

/**
 * ==========================================================
 * Load live member counts + a small avatar preview for a
 * batch of workspaces in one query each, rather than one
 * query per workspace per user.
 *
 * Returns two Maps keyed by workspace id (as a string):
 *   countsByWorkspace   -> total ACTIVE member count
 *   previewsByWorkspace -> up to MEMBER_PREVIEW_LIMIT
 *                          { id, name, avatar } entries,
 *                          used for the avatar stack on the
 *                          Home page workspace cards.
 * ==========================================================
 */
const MEMBER_PREVIEW_LIMIT = 4;

async function loadMemberSummaries(MembershipModel, workspaceField, workspaceIds) {

    const countsByWorkspace = new Map();
    const previewsByWorkspace = new Map();

    if (!workspaceIds.length) {
        return { countsByWorkspace, previewsByWorkspace };
    }

    const allMembers = await MembershipModel
        .find({
            [workspaceField]: { $in: workspaceIds },
            status: WORKSPACE_STATUS.ACTIVE
        })
        .select(`${workspaceField} user_id role createdAt`)
        .populate("user_id", "name avatar_url")
        .sort({ createdAt: 1 });

    for (const member of allMembers) {
        const key = String(member[workspaceField]);

        countsByWorkspace.set(key, (countsByWorkspace.get(key) ?? 0) + 1);

        if (!member.user_id) continue;

        const preview = previewsByWorkspace.get(key) ?? [];
        if (preview.length < MEMBER_PREVIEW_LIMIT) {
            preview.push({
                id: member.user_id._id,
                name: member.user_id.name,
                avatar: member.user_id.avatar_url ?? null,
            });
            previewsByWorkspace.set(key, preview);
        }
    }

    return { countsByWorkspace, previewsByWorkspace };

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

/**
 * ==========================================================
 * Get Public/Platform Directory Workspaces by Type
 * Used by new users post-OTP to discover existing workspaces.
 * ==========================================================
 */
export async function getDirectoryWorkspaces(type, query = '') {
    const normalizedType = String(type || '').toLowerCase();
    const results = {
        chamas: [],
        businesses: [],
        contributionGroups: [],
    };

    const searchRegex = query ? new RegExp(query.trim(), 'i') : null;

    if (!normalizedType || normalizedType === 'chama') {
        const chamaFilter = { status: 'active' };
        if (searchRegex) {
            chamaFilter.$or = [
                { name: searchRegex },
                { description: searchRegex },
            ];
        }

        const chamas = await Chama.find(chamaFilter)
            .select('name monthly_savings chama_type status visibility join_code created_by createdAt')
            .populate('created_by', 'name phone email')
            .sort({ createdAt: -1 })
            .lean();

        const chamaIds = chamas.map(c => c._id);
        const memberCounts = await ChamaMembership.aggregate([
            { $match: { chama_id: { $in: chamaIds }, status: 'active' } },
            { $group: { _id: '$chama_id', count: { $sum: 1 } } }
        ]);
        const countsMap = new Map(memberCounts.map(m => [String(m._id), m.count]));

        results.chamas = chamas.map(c => ({
            ...c,
            id: c._id,
            type: 'chama',
            memberCount: countsMap.get(String(c._id)) || 0,
        }));
    }

    if (!normalizedType || normalizedType === 'business') {
        const bizFilter = {};
        if (searchRegex) {
            bizFilter.$or = [
                { name: searchRegex },
                { category: searchRegex },
                { location: searchRegex },
            ];
        }

        const businesses = await Business.find(bizFilter)
            .select('name category category_label currency location created_by createdAt')
            .populate('created_by', 'name phone email')
            .sort({ createdAt: -1 })
            .lean();

        results.businesses = businesses.map(b => ({
            ...b,
            id: b._id,
            type: 'business',
        }));
    }

    if (!normalizedType || normalizedType === 'contribution_group' || normalizedType === 'contribution') {
        const groupFilter = { status: 'active' };
        if (searchRegex) {
            groupFilter.$or = [
                { name: searchRegex },
                { group_type: searchRegex },
            ];
        }

        const groups = await ContributionGroup.find(groupFilter)
            .select('name group_type target_amount created_by createdAt')
            .populate('created_by', 'name phone email')
            .sort({ createdAt: -1 })
            .lean();

        const groupIds = groups.map(g => g._id);
        const memberCounts = await ContributionGroupMember.aggregate([
            { $match: { contribution_group_id: { $in: groupIds }, status: 'active' } },
            { $group: { _id: '$contribution_group_id', count: { $sum: 1 } } }
        ]);
        const countsMap = new Map(memberCounts.map(m => [String(m._id), m.count]));

        results.contributionGroups = groups.map(g => ({
            ...g,
            id: g._id,
            type: 'contribution-group',
            memberCount: countsMap.get(String(g._id)) || 0,
        }));
    }

    if (normalizedType === 'chama') return results.chamas;
    if (normalizedType === 'business') return results.businesses;
    if (normalizedType === 'contribution_group' || normalizedType === 'contribution') return results.contributionGroups;

    return results;
}