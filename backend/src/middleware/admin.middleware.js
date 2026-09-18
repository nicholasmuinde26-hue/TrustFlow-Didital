import AppError from '../utils/AppError.js';
import PlatformAdmin from '../models/PlatformAdmin.js';
import AdminAccessSession from '../models/AdminAccessSession.js';
import { verifyAccessToken } from '../utils/jwt.js';

const clientIp = (req) => String(req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
const allowlistedIps = () => (process.env.SUPER_ADMIN_IP_ALLOWLIST || '').split(',').map((ip) => ip.trim()).filter(Boolean);
const enforceSuperAdminIpAllowlist = (req, res) => {
  const allowed = allowlistedIps();
  if (!allowed.length || allowed.includes(clientIp(req))) return true;
  res.status(403).json({ success: false, code: 'SUPER_ADMIN_IP_NOT_ALLOWED', message: 'This Super Admin account is not permitted from the current network.' });
  return false;
};

/**
 * Ensures the authenticated user has system admin privileges
 * (either super_admin, or a sub_admin whose PlatformAdmin record is
 * currently ACTIVE).
 *
 * Deliberately does NOT let `systemRole === 'sub_admin'` through on its
 * own: a sub-admin can be suspended (see suspendSubAdmin) without their
 * systemRole being rolled back, precisely so access can be pulled during
 * an investigation without erasing their configured scope. The only role
 * that is trusted without a DB round-trip is super_admin, since that
 * account must never be capable of locking itself out.
 */
export const requireAdmin = async (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  const deviceId = req.headers['x-device-id'] || 'unidentified-device';
  const session = await AdminAccessSession.findOne({ userId: req.user._id, deviceId });
  if (session?.status === 'REVOKED') return res.status(403).json({ success: false, code: 'ADMIN_SESSION_REVOKED', message: 'This administrative device session was revoked.' });
  await AdminAccessSession.findOneAndUpdate({ userId: req.user._id, deviceId }, { $set: { ip: clientIp(req), userAgent: req.get('user-agent'), status: 'ACTIVE', lastSeenAt: new Date(), revokedAt: null } }, { upsert: true });
  if (req.user.systemRole === 'super_admin') {
    if (!enforceSuperAdminIpAllowlist(req, res)) return;
    return next();
  }

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

  if (!enforceSuperAdminIpAllowlist(req, res)) return;

  next();
};

export const requireAdminStepUp = (req, res, next) => {
  const token = req.headers['x-admin-step-up'];
  if (!token) return res.status(401).json({ success: false, code: 'ADMIN_STEP_UP_REQUIRED', message: 'Re-enter your password to continue with this administrative action.' });
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== 'admin_step_up' || String(payload.id) !== String(req.user?._id)) throw new Error('invalid step-up');
    return next();
  } catch {
    return res.status(401).json({ success: false, code: 'ADMIN_STEP_UP_REQUIRED', message: 'Administrative step-up has expired. Re-enter your password to continue.' });
  }
};

/**
 * Checks granular permissions for platform admins:
 * e.g. requireAdminPermission('chamas'), requireAdminPermission('finance'),
 * or requireAdminPermission('security') / ('support') / ('onboarding') to
 * gate an entire category's console. This is what actually separates the
 * six admin workspaces from one another — everything else is UI dressing.
 */
export const requireAdminPermission = (permissionKey) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (req.user.systemRole === 'super_admin') {
      return next();
    }

    // requireAdmin (when chained earlier in the same route) already loaded
    // this; avoid a second round-trip if so.
    const adminDoc = req.platformAdmin || (await PlatformAdmin.findOne({ userId: req.user._id, status: 'ACTIVE' }));
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
