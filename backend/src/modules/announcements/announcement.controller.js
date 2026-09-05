import mongoose from "mongoose";
import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";
import Business from "../../models/Business.js";
import Announcement from "../../models/Announcement.js";
import AppError from "../../utils/AppError.js";

// ==========================================================
// DTO TRANSLATION HELPER
// ==========================================================
function toAnnouncementDTO(announcement) {
  if (!announcement) return null;

  return {
    id: announcement._id,
    workspaceId: announcement.workspace_id,
    workspaceType: announcement.workspace_type,
    title: announcement.title,
    content: announcement.content,
    createdBy: {
      id: announcement.created_by?._id || announcement.created_by,
      name: announcement.created_by?.name || null,
    },
    isPinned: announcement.is_pinned,
    pinnedAt: announcement.pinned_at,
    status: announcement.status,
    approvedBy: announcement.approved_by || null,
    approvedAt: announcement.approved_at || null,
    rejectedBy: announcement.rejected_by || null,
    rejectedAt: announcement.rejected_at || null,
    rejectionReason: announcement.rejection_reason || null,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
    chamaDetails: announcement.workspace_type === "chama" && announcement.chama_details ? {
      transparencyReason: announcement.chama_details.transparency_reason,
      financialImpact: announcement.chama_details.financial_impact,
      consensusVoted: announcement.chama_details.consensus_voted,
      consensusLink: announcement.chama_details.consensus_link,
    } : null,
    contributionDetails: announcement.workspace_type === "contribution-group" && announcement.contribution_details ? {
      deadline: announcement.contribution_details.deadline,
      penaltyDetails: announcement.contribution_details.penalty_details,
      actionItems: announcement.contribution_details.action_items,
      accountabilityChecklist: announcement.contribution_details.accountability_checklist,
    } : null,
    businessDetails: announcement.workspace_type === "business" && announcement.business_details ? {
      decisionMade: announcement.business_details.decision_made,
      growthMetrics: announcement.business_details.growth_metrics,
      complianceReference: announcement.business_details.compliance_reference,
      authorizedBy: announcement.business_details.authorized_by,
    } : null,
  };
}

// ==========================================================
// ANNOUNCEMENT APPROVAL ROLES
// ==========================================================
// For workspace types listed here, only the roles in the array can
// post an announcement directly. Any other manage-eligible role has
// their announcement land as "pending" until one of these roles
// approves or rejects it. Business has no entry, so it always
// publishes immediately (single owner — nobody to approve against).
//
//   chama:               Chairperson / Secretary approve; Treasurer's
//                         posts need sign-off.
//   contribution-group:  Organizer approves; a Co-organizer's posts
//                         need sign-off (Organizer is the sole primary
//                         owner — see canManageMembers comments).
const ANNOUNCEMENT_APPROVER_ROLES = {
  chama: ["chairperson", "secretary"],
  "contribution-group": ["organizer"],
};

function getApproverRoles(workspaceType) {
  return ANNOUNCEMENT_APPROVER_ROLES[workspaceType] || null;
}

function isApprover(context) {
  const approverRoles = getApproverRoles(context.workspaceType);
  return !approverRoles || approverRoles.includes(context.role);
}

function announcementNeedsApproval(context) {
  const approverRoles = getApproverRoles(context.workspaceType);
  return !!approverRoles && !approverRoles.includes(context.role);
}

// ==========================================================
// WORKSPACE AUTHORIZATION & CONTEXT HELPER
// ==========================================================
async function getWorkspaceContext(workspaceId, userId) {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError("Invalid workspace ID", 400);
  }

  // 1. Check if it's a Chama
  if (await Chama.exists({ _id: workspaceId })) {
    const membership = await ChamaMembership.findOne({
      chama_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) {
      throw new AppError("You are not an active member of this Chama workspace", 403);
    }
    // Chairperson, Secretary, and Treasurer can manage announcements
    const allowedRoles = ["chairperson", "secretary", "treasurer"];
    const canManage = allowedRoles.includes(membership.role);
    return { workspaceType: "chama", canManage, role: membership.role };
  }

  // 2. Check if it's a Contribution Group
  if (await ContributionGroup.exists({ _id: workspaceId })) {
    const membership = await ContributionGroupMember.findOne({
      contribution_group_id: workspaceId,
      user_id: userId,
      status: "active",
    }).select("role");
    if (!membership) {
      throw new AppError("You are not an active member of this Contribution Group workspace", 403);
    }
    // Organizer and Co-organizer can manage announcements
    const allowedRoles = ["organizer", "co_organizer"];
    const canManage = allowedRoles.includes(membership.role);
    return { workspaceType: "contribution-group", canManage, role: membership.role };
  }

  // 3. Check if it's a Business
  const business = await Business.findById(workspaceId).select("created_by");
  if (business) {
    const isOwner = String(business.created_by) === String(userId);
    if (!isOwner) {
      throw new AppError("You do not have access to this Business workspace", 403);
    }
    // The business owner/creator has full management access
    return { workspaceType: "business", canManage: true, role: "owner" };
  }

  throw new AppError("Workspace not found", 404);
}

// ==========================================================
// CONTROLLERS
// ==========================================================

/**
 * List announcements for a workspace
 * Sorted by: pinned first, then by date descending
 */
export async function listAnnouncements(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    const filter = { workspace_id: workspaceId };

    // Pending/rejected announcements are only visible to that
    // workspace's approvers (see ANNOUNCEMENT_APPROVER_ROLES) and to
    // whoever authored them. Everyone else only ever sees announcements
    // that have been approved.
    if (!isApprover(context)) {
      filter.$or = [{ status: "approved" }, { created_by: req.user._id }];
    }

    const announcements = await Announcement.find(filter)
      .sort({ is_pinned: -1, createdAt: -1 })
      .populate("created_by", "name");

    res.json({
      success: true,
      data: {
        announcements: announcements.map(toAnnouncementDTO),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new announcement in a workspace
 */
export async function createAnnouncement(req, res, next) {
  try {
    const { workspaceId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    if (!context.canManage) {
      throw new AppError("You do not have authorization to post announcements in this workspace", 403);
    }

    const { title, content } = req.body || {};
    if (typeof title !== "string" || title.trim().length < 3) {
      throw new AppError("Announcement title must be at least 3 characters long", 400);
    }
    if (typeof content !== "string" || content.trim().length < 3) {
      throw new AppError("Announcement content must be at least 3 characters long", 400);
    }

    // Build workspace type details (tastes validation)
    const announcementData = {
      workspace_id: workspaceId,
      workspace_type: context.workspaceType,
      title: title.trim(),
      content: content.trim(),
      created_by: req.user._id,
    };

    if (context.workspaceType === "chama") {
      const { chamaDetails } = req.body || {};
      if (!chamaDetails || typeof chamaDetails.transparencyReason !== "string" || chamaDetails.transparencyReason.trim().length === 0) {
        throw new AppError("Chama announcements require a transparency reason to build trust", 400);
      }

      announcementData.chama_details = {
        transparency_reason: chamaDetails.transparencyReason.trim(),
        financial_impact: chamaDetails.financialImpact?.trim() || null,
        consensus_voted: !!chamaDetails.consensusVoted,
        consensus_link: chamaDetails.consensusLink?.trim() || null,
      };

      if (announcementData.chama_details.consensus_link && !/^https?:\/\//i.test(announcementData.chama_details.consensus_link)) {
        throw new AppError("Consensus link must be a valid URL starting with http:// or https://", 400);
      }
    } else if (context.workspaceType === "contribution-group") {
      const { contributionDetails } = req.body || {};
      if (!contributionDetails || typeof contributionDetails.penaltyDetails !== "string" || contributionDetails.penaltyDetails.trim().length === 0) {
        throw new AppError("Contribution group announcements require penalty details for accountability", 400);
      }

      const deadline = contributionDetails.deadline ? new Date(contributionDetails.deadline) : null;
      if (contributionDetails.deadline && Number.isNaN(deadline.getTime())) {
        throw new AppError("Deadline must be a valid date and time", 400);
      }

      announcementData.contribution_details = {
        deadline,
        penalty_details: contributionDetails.penaltyDetails.trim(),
        action_items: Array.isArray(contributionDetails.actionItems) 
          ? contributionDetails.actionItems.map(item => String(item).trim()).filter(Boolean) 
          : [],
        accountability_checklist: Array.isArray(contributionDetails.accountabilityChecklist)
          ? contributionDetails.accountabilityChecklist.map(item => String(item).trim()).filter(Boolean)
          : [],
      };
    } else if (context.workspaceType === "business") {
      const { businessDetails } = req.body || {};
      if (!businessDetails) {
        throw new AppError("Business announcements require decision/growth details", 400);
      }
      if (typeof businessDetails.decisionMade !== "string" || businessDetails.decisionMade.trim().length === 0) {
        throw new AppError("Business announcements must specify the decision made", 400);
      }
      if (typeof businessDetails.authorizedBy !== "string" || businessDetails.authorizedBy.trim().length === 0) {
        throw new AppError("Business announcements must specify the authorizing entity/person", 400);
      }

      announcementData.business_details = {
        decision_made: businessDetails.decisionMade.trim(),
        growth_metrics: businessDetails.growthMetrics?.trim() || null,
        compliance_reference: businessDetails.complianceReference?.trim() || null,
        authorized_by: businessDetails.authorizedBy.trim(),
      };
    }

    // Approval gate: an approver role for this workspace type (see
    // ANNOUNCEMENT_APPROVER_ROLES) publishes immediately; anyone else
    // with manage rights (Treasurer in a Chama, Co-organizer in a
    // Contribution Group) needs an approver to sign off first.
    const needsApproval = announcementNeedsApproval(context);

    if (needsApproval) {
      announcementData.status = "pending";
    } else {
      announcementData.status = "approved";
      announcementData.approved_by = req.user._id;
      announcementData.approved_at = new Date();
    }

    let announcement = await Announcement.create(announcementData);
    announcement = await announcement.populate("created_by", "name");

    res.status(201).json({
      success: true,
      message: needsApproval
        ? "Announcement submitted for approval."
        : "Announcement posted.",
      data: {
        announcement: toAnnouncementDTO(announcement),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Approve a pending announcement.
 * Restricted to that workspace type's approver role(s) — see
 * ANNOUNCEMENT_APPROVER_ROLES.
 */
export async function approveAnnouncement(req, res, next) {
  try {
    const { workspaceId, announcementId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    if (!getApproverRoles(context.workspaceType) || !isApprover(context)) {
      throw new AppError("You do not have authorization to approve announcements in this workspace", 403);
    }

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new AppError("Invalid announcement ID", 400);
    }

    const announcement = await Announcement.findOne({
      _id: announcementId,
      workspace_id: workspaceId,
    });

    if (!announcement) {
      throw new AppError("Announcement not found in this workspace", 404);
    }

    if (announcement.status !== "pending") {
      throw new AppError("Only pending announcements can be approved", 400);
    }

    announcement.status = "approved";
    announcement.approved_by = req.user._id;
    announcement.approved_at = new Date();
    announcement.rejected_by = null;
    announcement.rejected_at = null;
    announcement.rejection_reason = null;
    await announcement.save();
    await announcement.populate("created_by", "name");

    res.json({
      success: true,
      data: {
        announcement: toAnnouncementDTO(announcement),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Reject a pending announcement.
 * Restricted to that workspace type's approver role(s) — see
 * ANNOUNCEMENT_APPROVER_ROLES.
 */
export async function rejectAnnouncement(req, res, next) {
  try {
    const { workspaceId, announcementId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    if (!getApproverRoles(context.workspaceType) || !isApprover(context)) {
      throw new AppError("You do not have authorization to reject announcements in this workspace", 403);
    }

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new AppError("Invalid announcement ID", 400);
    }

    const { reason } = req.body || {};

    const announcement = await Announcement.findOne({
      _id: announcementId,
      workspace_id: workspaceId,
    });

    if (!announcement) {
      throw new AppError("Announcement not found in this workspace", 404);
    }

    if (announcement.status !== "pending") {
      throw new AppError("Only pending announcements can be rejected", 400);
    }

    announcement.status = "rejected";
    announcement.rejected_by = req.user._id;
    announcement.rejected_at = new Date();
    announcement.rejection_reason =
      typeof reason === "string" && reason.trim().length > 0 ? reason.trim() : null;
    announcement.approved_by = null;
    announcement.approved_at = null;
    await announcement.save();
    await announcement.populate("created_by", "name");

    res.json({
      success: true,
      data: {
        announcement: toAnnouncementDTO(announcement),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle pin state of an announcement
 */
export async function togglePinAnnouncement(req, res, next) {
  try {
    const { workspaceId, announcementId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    if (!context.canManage) {
      throw new AppError("You do not have authorization to pin announcements in this workspace", 403);
    }

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new AppError("Invalid announcement ID", 400);
    }

    const announcement = await Announcement.findOne({
      _id: announcementId,
      workspace_id: workspaceId,
    });

    if (!announcement) {
      throw new AppError("Announcement not found in this workspace", 404);
    }

    if (announcement.status !== "approved") {
      throw new AppError("Only approved announcements can be pinned", 400);
    }

    announcement.is_pinned = !announcement.is_pinned;
    announcement.pinned_at = announcement.is_pinned ? new Date() : null;
    await announcement.save();

    await announcement.populate("created_by", "name");

    res.json({
      success: true,
      data: {
        announcement: toAnnouncementDTO(announcement),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete an announcement
 */
export async function deleteAnnouncement(req, res, next) {
  try {
    const { workspaceId, announcementId } = req.params;
    const context = await getWorkspaceContext(workspaceId, req.user._id);

    if (!context.canManage) {
      throw new AppError("You do not have authorization to delete announcements in this workspace", 403);
    }

    if (!mongoose.Types.ObjectId.isValid(announcementId)) {
      throw new AppError("Invalid announcement ID", 400);
    }

    const announcement = await Announcement.findOneAndDelete({
      _id: announcementId,
      workspace_id: workspaceId,
    });

    if (!announcement) {
      throw new AppError("Announcement not found in this workspace", 404);
    }

    res.json({
      success: true,
      message: "Announcement successfully deleted",
    });
  } catch (error) {
    next(error);
  }
}
