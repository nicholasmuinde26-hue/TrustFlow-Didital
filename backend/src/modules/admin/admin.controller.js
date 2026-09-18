import * as AdminService from './admin.service.js';

export const createAdminStepUpController = async (req, res, next) => {
  try {
    const token = await AdminService.createAdminStepUp(req.user._id, req.body.password);
    res.status(200).json({ success: true, data: { token } });
  } catch (error) { next(error); }
};
export const listMyAdminSessionsController = async (req, res, next) => { try { res.json({ success: true, data: await AdminService.listMyAdminSessions(req.user._id) }); } catch (error) { next(error); } };
export const revokeMyAdminSessionController = async (req, res, next) => { try { res.json({ success: true, data: await AdminService.revokeMyAdminSession(req.user._id, req.params.sessionId) }); } catch (error) { next(error); } };

export const getMyAdminProfileController = async (req, res, next) => {
  try {
    const profile = await AdminService.getMyAdminProfile(req.user);
    if (!profile) {
      return res.status(403).json({ success: false, code: 'ADMIN_ACCESS_REQUIRED', message: 'Access denied: Admin privileges required.' });
    }
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const listAdminCategoriesController = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: AdminService.listAdminCategories() });
  } catch (error) {
    next(error);
  }
};

export const suspendSubAdminController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    const record = await AdminService.suspendSubAdmin(userId, req.user._id, reason);
    res.status(200).json({ success: true, message: 'Sub-Admin access suspended', data: record });
  } catch (error) {
    next(error);
  }
};

export const reinstateSubAdminController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const record = await AdminService.reinstateSubAdmin(userId, req.user._id);
    res.status(200).json({ success: true, message: 'Sub-Admin access reinstated', data: record });
  } catch (error) {
    next(error);
  }
};

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

export const getExecutiveOverviewController = async (req, res, next) => {
  try {
    const stats = await AdminService.getExecutiveOverview();
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

export const listAdminActivityController = async (req, res, next) => {
  try {
    const result = await AdminService.listAdminActivity(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

export const promoteSubAdminController = async (req, res, next) => {
  try {
    const { userId, permissions, category, notes } = req.body;
    const result = await AdminService.promoteToSubAdmin(userId, permissions, req.user._id, { category, notes });
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
    const { permissions, category, notes } = req.body;
    const adminDoc = await AdminService.updateSubAdminPermissions(userId, permissions, req.user._id, { category, notes });
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
    const user = await AdminService.demoteSubAdmin(userId, req.user._id);
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

export const getEntityDetailController = async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const detail = await AdminService.getEntityDetail(type, id);
    res.status(200).json({
      success: true,
      data: detail,
    });
  } catch (error) {
    next(error);
  }
};

export const updateChamaMemberController = async (req, res, next) => {
  try {
    const { chamaId, membershipId } = req.params;
    const { role, status } = req.body;
    const detail = await AdminService.updateChamaMemberRole(chamaId, membershipId, { role, status }, req.user);
    res.status(200).json({
      success: true,
      message: role === 'chairperson' ? 'Chairperson updated successfully' : 'Member updated successfully',
      data: detail,
    });
  } catch (error) {
    next(error);
  }
};

export const searchPeopleController = async (req, res, next) => {
  try {
    const { query, page, limit } = req.query;
    const result = await AdminService.searchPeople({ query, page, limit });
    res.status(200).json({
      success: true,
      data: result,
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
