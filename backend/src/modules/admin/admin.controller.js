import * as AdminService from './admin.service.js';

export const getOverviewStatsController = async (req, res, next) => {
  try {
    const stats = await AdminService.getOverviewStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

export const listUsersController = async (req, res, next) => {
  try {
    const { query, role, page, limit } = req.query;
    const result = await AdminService.listUsers({ query, role, page, limit });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const listSubAdminsController = async (req, res, next) => {
  try {
    const admins = await AdminService.listSubAdmins();
    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};

export const promoteSubAdminController = async (req, res, next) => {
  try {
    const { userId, permissions } = req.body;
    const result = await AdminService.promoteToSubAdmin(userId, permissions, req.user._id);
    res.status(200).json({
      success: true,
      message: `${result.user.name || result.user.phone} is now a Sub-Admin`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateSubAdminPermissionsController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;
    const adminDoc = await AdminService.updateSubAdminPermissions(userId, permissions);
    res.status(200).json({
      success: true,
      message: 'Sub-Admin permissions updated successfully',
      data: adminDoc,
    });
  } catch (error) {
    next(error);
  }
};

export const demoteSubAdminController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await AdminService.demoteSubAdmin(userId);
    res.status(200).json({
      success: true,
      message: `${user.name || user.phone} has been removed from Sub-Admins`,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const listWorkspaceRequestsController = async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await AdminService.listWorkspaceRequests({ status });
    res.status(200).json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

export const getWorkspaceRequestController = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = await AdminService.getWorkspaceRequestById(requestId);
    res.status(200).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const updateWorkspaceRequestController = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const request = await AdminService.updateWorkspaceRequest(requestId, req.body, req.user);
    res.status(200).json({
      success: true,
      message: 'Request details updated',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const approveWorkspaceRequestController = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    // Any edits the admin made in the approval dialog (corrected/added
    // details, extra members) are applied in the same step as approving.
    const request = await AdminService.approveWorkspaceRequest(requestId, req.user, req.body);
    res.status(200).json({
      success: true,
      message: 'Workspace created and request approved successfully',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

export const rejectWorkspaceRequestController = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { adminNotes } = req.body;
    const request = await AdminService.rejectWorkspaceRequest(requestId, adminNotes, req.user);
    res.status(200).json({
      success: true,
      message: 'Workspace request rejected',
      data: request,
    });
  } catch (error) {
    next(error);
  }
};
