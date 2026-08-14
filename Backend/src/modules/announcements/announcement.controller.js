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
    return { workspaceType: "chama", canManage };
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
    return { workspaceType: "contribution-group", canManage };
  }

  // 3. Check if it's a Business
  const business = await Business.findById(workspaceId).select("created_by");
  if (business) {
    const isOwner = String(business.created_by) === String(userId);
    if (!isOwner) {
      throw new AppError("You do not have access to this Business workspace", 403);
    }
    // The business owner/creator has full management access
    return { workspaceType: "business", canManage: true };
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
    await getWorkspaceContext(workspaceId, req.user._id);

    const announcements = await Announcement.find({ workspace_id: workspaceId })
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

    let announcement = await Announcement.create(announcementData);
    announcement = await announcement.populate("created_by", "name");

    res.status(201).json({
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
