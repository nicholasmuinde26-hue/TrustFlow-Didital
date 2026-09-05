import AppError from '../utils/AppError.js';
import PlatformAdmin from '../models/PlatformAdmin.js';

/**
 * Ensures the authenticated user has system admin privileges
 * (either super_admin or sub_admin/PLATFORM_ADMIN).
 */
export const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const role = req.user.systemRole;
  if (role === 'super_admin' || role === 'sub_admin') {
    return next();
  }

  // Check PlatformAdmin record
  const adminDoc = await PlatformAdmin.findOne({ userId: req.user._id, status: 'ACTIVE' });
  if (adminDoc) {
    req.platformAdmin = adminDoc;
    return next();
  }

  return res.status(403).json({
    success: false,
    code: 'ADMIN_ACCESS_REQUIRED',
    message: 'Access denied: Admin privileges required to perform this action.',
  });
};

/**
 * Ensures the authenticated user is the Super Admin.
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (req.user.systemRole !== 'super_admin') {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_REQUIRED',
      message: 'Access denied: Only the Super Admin can perform this action.',
    });
  }

  next();
};

/**
 * Checks granular permissions for platform admins:
 * e.g. requireAdminPermission('chamas'), requireAdminPermission('finance'), etc.
 */
export const requireAdminPermission = (permissionKey) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.systemRole === 'super_admin') {
      return next();
    }

    const adminDoc = await PlatformAdmin.findOne({ userId: req.user._id, status: 'ACTIVE' });
    if (!adminDoc) {
      return res.status(403).json({
        success: false,
        code: 'ADMIN_ACCESS_REQUIRED',
        message: 'Access denied: Admin privileges required.',
      });
    }

    req.platformAdmin = adminDoc;

    if (adminDoc.adminRole === 'SUPER_ADMIN' || adminDoc.permissions?.[permissionKey] === true) {
      return next();
    }

    return res.status(403).json({
      success: false,
      code: 'PERMISSION_DENIED',
      message: `Access denied: You do not have '${permissionKey}' administrative permission.`,
    });
  };
};
