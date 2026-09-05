import * as InquiryService from './inquiry.service.js';

export const createInquiryController = async (req, res, next) => {
  try {
    const { workspaceId, workspaceType, subject, category, message, priority } = req.body;
    const inquiry = await InquiryService.createInquiry({
      workspaceId,
      workspaceType,
      user: req.user,
      subject,
      category,
      message,
      priority,
    });
    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully to Platform Administration',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceInquiriesController = async (req, res, next) => {
  try {
    const { workspaceId } = req.params;
    const inquiries = await InquiryService.getWorkspaceInquiries(workspaceId, req.user);
    res.status(200).json({
      success: true,
      data: inquiries,
    });
  } catch (error) {
    next(error);
  }
};

export const replyToInquiryController = async (req, res, next) => {
  try {
    const { inquiryId } = req.params;
    const { message } = req.body;
    const isAdmin =
      req.user.systemRole === 'super_admin' || req.user.systemRole === 'sub_admin';

    const inquiry = await InquiryService.replyToInquiry(
      inquiryId,
      req.user,
      message,
      isAdmin
    );

    res.status(200).json({
      success: true,
      message: 'Reply sent successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const listAllInquiriesController = async (req, res, next) => {
  try {
    const { status, workspaceType, search, page, limit } = req.query;
    const result = await InquiryService.listAllInquiries({
      status,
      workspaceType,
      search,
      page,
      limit,
    });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getInquiryByIdController = async (req, res, next) => {
  try {
    const { inquiryId } = req.params;
    const inquiry = await InquiryService.getInquiryById(inquiryId);
    res.status(200).json({
      success: true,
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const updateInquiryStatusController = async (req, res, next) => {
  try {
    const { inquiryId } = req.params;
    const { status, adminNotes } = req.body;
    const inquiry = await InquiryService.updateInquiryStatus(
      inquiryId,
      status,
      req.user,
      adminNotes
    );
    res.status(200).json({
      success: true,
      message: `Inquiry status updated to ${status}`,
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
};

export const getInquiryStatsController = async (req, res, next) => {
  try {
    const stats = await InquiryService.getInquiryStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
