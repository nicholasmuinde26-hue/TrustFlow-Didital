import mongoose from 'mongoose';
import PlatformInquiry from '../../models/PlatformInquiry.js';
import Chama from '../../models/Chama.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Business from '../../models/Business.js';
import ContributionGroup from '../../models/ContributionGroup.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import AppError from '../../utils/AppError.js';

/**
 * Helper to resolve workspace name and user's role in the workspace
 */
const resolveWorkspaceDetails = async (workspaceId, workspaceType, userId) => {
  let name = 'Workspace';
  let role = 'member';

  if (workspaceType === 'chama') {
    const chama = await Chama.findById(workspaceId).select('name created_by');
    if (chama) {
      name = chama.name;
    }
    const membership = await ChamaMembership.findOne({
      chama_id: workspaceId,
      user_id: userId,
    });
    if (membership) {
      role = membership.role || 'member';
    }
  } else if (workspaceType === 'business') {
    const business = await Business.findById(workspaceId).select('name created_by');
    if (business) {
      name = business.name;
      if (String(business.created_by) === String(userId)) {
        role = 'owner';
      }
    }
  } else if (workspaceType === 'contribution_group') {
    const group = await ContributionGroup.findById(workspaceId).select('name created_by');
    if (group) {
      name = group.name;
    }
    const member = await ContributionGroupMember.findOne({
      contribution_group_id: workspaceId,
      user_id: userId,
    });
    if (member) {
      role = member.role || 'member';
    }
  }

  return { name, role };
};

/**
 * Submit a new inquiry from a workspace
 */
export const createInquiry = async ({
  workspaceId,
  workspaceType,
  user,
  subject,
  category,
  message,
  priority = 'medium',
}) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError('Invalid workspace ID', 400);
  }

  if (!['chama', 'business', 'contribution_group'].includes(workspaceType)) {
    throw new AppError('Invalid workspace type', 400);
  }

  if (!subject?.trim()) {
    throw new AppError('Inquiry subject is required', 400);
  }

  if (!message?.trim()) {
    throw new AppError('Inquiry message is required', 400);
  }

  const { name: workspaceName, role: senderRole } = await resolveWorkspaceDetails(
    workspaceId,
    workspaceType,
    user._id
  );

  const inquiry = await PlatformInquiry.create({
    workspaceId,
    workspaceType,
    workspaceName,
    submittedBy: user._id,
    senderName: user.name || user.phone || 'Member',
    senderRole,
    senderPhone: user.phone || '',
    senderEmail: user.email || '',
    subject: subject.trim(),
    category: category || 'general_inquiry',
    priority: priority || 'medium',
    message: message.trim(),
    status: 'OPEN',
    responses: [],
  });

  return inquiry;
};

/**
 * Get all inquiries for a specific workspace (accessible by its members/chairperson)
 */
export const getWorkspaceInquiries = async (workspaceId, user) => {
  if (!mongoose.Types.ObjectId.isValid(workspaceId)) {
    throw new AppError('Invalid workspace ID', 400);
  }

  return PlatformInquiry.find({ workspaceId })
    .sort({ createdAt: -1 })
    .lean();
};

/**
 * List all inquiries across all chamas and workspaces (Platform Admin only)
 */
export const listAllInquiries = async ({
  status = '',
  workspaceType = '',
  search = '',
  page = 1,
  limit = 50,
}) => {
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status.toUpperCase();
  }

  if (workspaceType && workspaceType !== 'all') {
    filter.workspaceType = workspaceType.toLowerCase();
  }

  if (search?.trim()) {
    const term = search.trim();
    filter.$or = [
      { inquiryNumber: { $regex: term, $options: 'i' } },
      { workspaceName: { $regex: term, $options: 'i' } },
      { subject: { $regex: term, $options: 'i' } },
      { senderName: { $regex: term, $options: 'i' } },
      { senderPhone: { $regex: term, $options: 'i' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [inquiries, total] = await Promise.all([
    PlatformInquiry.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    PlatformInquiry.countDocuments(filter),
  ]);

  return { inquiries, total, page: Number(page), limit: Number(limit) };
};

/**
 * Get single inquiry details
 */
export const getInquiryById = async (inquiryId) => {
  if (!mongoose.Types.ObjectId.isValid(inquiryId)) {
    throw new AppError('Invalid inquiry ID', 400);
  }

  const inquiry = await PlatformInquiry.findById(inquiryId)
    .populate('submittedBy', 'name phone email')
    .populate('resolvedBy', 'name phone email')
    .populate('responses.sender', 'name phone email');

  if (!inquiry) {
    throw new AppError('Inquiry not found', 404);
  }

  return inquiry;
};

/**
 * Add a reply to an inquiry thread
 */
export const replyToInquiry = async (inquiryId, user, message, isAdmin = false) => {
  if (!mongoose.Types.ObjectId.isValid(inquiryId)) {
    throw new AppError('Invalid inquiry ID', 400);
  }

  if (!message?.trim()) {
    throw new AppError('Reply message is required', 400);
  }

  const inquiry = await PlatformInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new AppError('Inquiry not found', 404);
  }

  const replyObj = {
    sender: user._id,
    senderName: isAdmin ? 'Platform Support' : user.name || user.phone || 'Member',
    isAdmin: Boolean(isAdmin),
    message: message.trim(),
    createdAt: new Date(),
  };

  inquiry.responses.push(replyObj);

  // If replied by an admin, mark as IN_PROGRESS if it was OPEN
  if (isAdmin && inquiry.status === 'OPEN') {
    inquiry.status = 'IN_PROGRESS';
  }

  // If user replies to a resolved inquiry, reopen it
  if (!isAdmin && (inquiry.status === 'RESOLVED' || inquiry.status === 'CLOSED')) {
    inquiry.status = 'OPEN';
  }

  await inquiry.save();
  return inquiry;
};

/**
 * Update inquiry status (Platform Admin only)
 */
export const updateInquiryStatus = async (inquiryId, status, adminUser, adminNotes = '') => {
  if (!mongoose.Types.ObjectId.isValid(inquiryId)) {
    throw new AppError('Invalid inquiry ID', 400);
  }

  const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  const upperStatus = status.toUpperCase();

  if (!validStatuses.includes(upperStatus)) {
    throw new AppError('Invalid status value', 400);
  }

  const inquiry = await PlatformInquiry.findById(inquiryId);
  if (!inquiry) {
    throw new AppError('Inquiry not found', 404);
  }

  inquiry.status = upperStatus;
  if (adminNotes !== undefined) {
    inquiry.adminNotes = adminNotes;
  }

  if (upperStatus === 'RESOLVED' || upperStatus === 'CLOSED') {
    inquiry.resolvedAt = new Date();
    inquiry.resolvedBy = adminUser._id;
  } else {
    inquiry.resolvedAt = null;
    inquiry.resolvedBy = null;
  }

  await inquiry.save();
  return inquiry;
};

/**
 * Overview counts for the admin dashboard
 */
export const getInquiryStats = async () => {
  const [openCount, inProgressCount, resolvedCount, totalCount] = await Promise.all([
    PlatformInquiry.countDocuments({ status: 'OPEN' }),
    PlatformInquiry.countDocuments({ status: 'IN_PROGRESS' }),
    PlatformInquiry.countDocuments({ status: 'RESOLVED' }),
    PlatformInquiry.countDocuments(),
  ]);

  return {
    openCount,
    inProgressCount,
    resolvedCount,
    totalCount,
    pendingTotal: openCount + inProgressCount,
  };
};
