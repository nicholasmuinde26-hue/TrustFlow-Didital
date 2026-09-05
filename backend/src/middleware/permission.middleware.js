import permissionService from '../services/permission.service.js';

// ========================================
// PERMISSION MIDDLEWARE
// ========================================
//
// Middleware functions for enforcing permission-based
// access control following the architecture:
// ROLE + PERMISSION + RESOURCE + ACTION + SCOPE + APPROVAL
//
// ========================================

/**
 * Require specific permission for access
 *
 * Usage: router.get('/endpoint', requirePermission('loans.view'), controller)
 *
 * @param {string} permissionKey - The permission key required
 * @param {object} options - Additional options
 * @param {string} options.scopeParam - Request parameter name for resource owner ID (default: 'resourceOwnerId')
 * @param {function} options.getResourceOwnerId - Function to extract resource owner ID from request
 * @param {boolean} options.checkSelfAction - Whether to check for self-action prevention (default: true)
 */
export const requirePermission = (permissionKey, options = {}) => {
  const {
    scopeParam = 'resourceOwnerId',
    getResourceOwnerId = null,
    checkSelfAction = true
  } = options;

  return async (req, res, next) => {
    try {
      // Ensure request has membership context
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required for permission check'
        });
      }

      // Extract resource owner ID for scope checking
      let resourceOwnerId = null;
      if (getResourceOwnerId && typeof getResourceOwnerId === 'function') {
        resourceOwnerId = await getResourceOwnerId(req);
      } else if (req.params[scopeParam]) {
        resourceOwnerId = req.params[scopeParam];
      } else if (req.body && req.body[scopeParam]) {
        resourceOwnerId = req.body[scopeParam];
      }

      // Build scope object
      const scope = {};
      if (resourceOwnerId) {
        scope.resourceOwnerId = resourceOwnerId;
      }

      // Check committee context if available
      if (req.membership.committee_assignments && req.membership.committee_assignments.length > 0) {
        scope.committeeType = req.membership.committee_assignments[0].committee_type;
      }

      // Check permission
      const permissionResult = await permissionService.hasPermission(
        req.membership._id,
        permissionKey,
        {
          type: req.method,
          id: req.params.id || req.params.resourceId,
          path: req.path
        },
        scope
      );

      if (!permissionResult.granted) {
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          message: permissionResult.reason || 'You do not have permission to perform this action',
          permissionKey,
          requiredScope: permissionResult.scope
        });
      }

      // Check self-action prevention if required
      if (checkSelfAction && resourceOwnerId) {
        const selfActionCheck = permissionService.checkSelfAction(
          req.membership._id,
          resourceOwnerId,
          permissionKey
        );

        if (selfActionCheck.blocked) {
          // Log the self-action block attempt
          await permissionService.logPermissionCheck({
            chamaId: req.chama._id,
            actorMembershipId: req.membership._id,
            actorRole: req.membership.role,
            permissionKey,
            result: 'self_action_blocked',
            reason: selfActionCheck.reason,
            resource: {
              type: req.method,
              id: req.params.id || req.params.resourceId,
              path: req.path
            },
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
          });

          return res.status(403).json({
            success: false,
            code: 'SELF_ACTION_BLOCKED',
            message: selfActionCheck.reason,
            permissionKey
          });
        }
      }

      // Attach permission result to request for use in controllers
      req.permissionResult = permissionResult;
      next();

    } catch (error) {
      console.error('Permission middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'PERMISSION_CHECK_ERROR',
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Require resource ownership or specific permission
 *
 * Usage: router.patch('/resource/:id', requireResourceOwnership('members.update', 'membershipId'), controller)
 *
 * @param {string} permissionKey - The permission key required for non-owners
 * @param {string} ownerIdParam - Request parameter name for resource owner ID
 */
export const requireResourceOwnership = (permissionKey, ownerIdParam = 'membershipId') => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      const resourceOwnerId = req.params[ownerIdParam] || req.body[ownerIdParam];

      // Allow if user is the resource owner
      if (resourceOwnerId && String(req.membership._id) === String(resourceOwnerId)) {
        return next();
      }

      // Otherwise, require the specified permission
      return requirePermission(permissionKey)(req, res, next);

    } catch (error) {
      console.error('Resource ownership middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'RESOURCE_OWNERSHIP_CHECK_ERROR',
        message: 'Error checking resource ownership'
      });
    }
  };
};

/**
 * Prevent self-action for specific operations
 *
 * Usage: router.post('/loans/:id/approve', preventSelfAction('loans.approve'), controller)
 *
 * @param {string} permissionKey - The permission key being checked
 * @param {function} getTargetId - Function to extract target ID from request
 */
export const preventSelfAction = (permissionKey, getTargetId = null) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      // Extract target ID
      let targetId = null;
      if (getTargetId && typeof getTargetId === 'function') {
        targetId = await getTargetId(req);
      } else {
        // Default: try to get from params
        targetId = req.params.id || req.params.targetId || req.params.membershipId;
      }

      if (!targetId) {
        // If no target ID, proceed (might not be applicable)
        return next();
      }

      // Check self-action
      const selfActionCheck = permissionService.checkSelfAction(
        req.membership._id,
        targetId,
        permissionKey
      );

      if (selfActionCheck.blocked) {
        await permissionService.logPermissionCheck({
          chamaId: req.chama._id,
          actorMembershipId: req.membership._id,
          actorRole: req.membership.role,
          permissionKey,
          result: 'self_action_blocked',
          reason: selfActionCheck.reason,
          resource: {
            type: req.method,
            id: targetId,
            path: req.path
          },
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });

        return res.status(403).json({
          success: false,
          code: 'SELF_ACTION_BLOCKED',
          message: selfActionCheck.reason,
          permissionKey
        });
      }

      next();

    } catch (error) {
      console.error('Self-action prevention middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'SELF_ACTION_CHECK_ERROR',
        message: 'Error checking self-action prevention'
      });
    }
  };
};

/**
 * Require committee access for specific committee type
 *
 * Usage: router.get('/finance/reports', requireCommitteeAccess('finance'), controller)
 *
 * @param {string} committeeType - The required committee type
 */
export const requireCommitteeAccess = (committeeType) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      // Check if user is in the required committee
      const isInCommittee = req.membership.committee_assignments?.some(
        assignment => assignment.committee_type === committeeType
      );

      // Chairperson has access to all committees
      const isChairperson = req.membership.role === 'chairperson';

      if (!isInCommittee && !isChairperson) {
        return res.status(403).json({
          success: false,
          code: 'COMMITTEE_ACCESS_REQUIRED',
          message: `You must be a member of the ${committeeType} committee to perform this action`,
          requiredCommittee: committeeType
        });
      }

      // Attach committee context to request
      req.committeeContext = {
        type: committeeType,
        isMember: isInCommittee,
        isChairperson: isChairperson
      };

      next();

    } catch (error) {
      console.error('Committee access middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'COMMITTEE_ACCESS_CHECK_ERROR',
        message: 'Error checking committee access'
      });
    }
  };
};

/**
 * Require any of the specified permissions (OR logic)
 *
 * Usage: router.get('/endpoint', requireAnyPermission(['members.view', 'members.view_sensitive']), controller)
 *
 * @param {string[]} permissionKeys - Array of permission keys (any one will grant access)
 */
export const requireAnyPermission = (permissionKeys) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      // Check each permission until one is granted
      for (const permissionKey of permissionKeys) {
        const permissionResult = await permissionService.hasPermission(
          req.membership._id,
          permissionKey,
          {
            type: req.method,
            id: req.params.id || req.params.resourceId,
            path: req.path
          }
        );

        if (permissionResult.granted) {
          req.permissionResult = permissionResult;
          req.grantedPermission = permissionKey;
          return next();
        }
      }

      // None of the permissions were granted
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        message: 'You do not have any of the required permissions',
        requiredPermissions: permissionKeys
      });

    } catch (error) {
      console.error('Any permission middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'PERMISSION_CHECK_ERROR',
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Require all of the specified permissions (AND logic)
 *
 * Usage: router.post('/endpoint', requireAllPermissions(['loans.approve', 'finance.transactions.create']), controller)
 *
 * @param {string[]} permissionKeys - Array of permission keys (all must be granted)
 */
export const requireAllPermissions = (permissionKeys) => {
  return async (req, res, next) => {
    try {
      if (!req.membership) {
        return res.status(401).json({
          success: false,
          code: 'MEMBERSHIP_CONTEXT_REQUIRED',
          message: 'Membership context required'
        });
      }

      const permissionResults = [];
      let allGranted = true;

      // Check each permission
      for (const permissionKey of permissionKeys) {
        const permissionResult = await permissionService.hasPermission(
          req.membership._id,
          permissionKey,
          {
            type: req.method,
            id: req.params.id || req.params.resourceId,
            path: req.path
          }
        );

        permissionResults.push({
          permissionKey,
          granted: permissionResult.granted,
          reason: permissionResult.reason
        });

        if (!permissionResult.granted) {
          allGranted = false;
        }
      }

      if (!allGranted) {
        return res.status(403).json({
          success: false,
          code: 'PERMISSION_DENIED',
          message: 'You do not have all the required permissions',
          requiredPermissions: permissionKeys,
          permissionResults
        });
      }

      req.permissionResults = permissionResults;
      next();

    } catch (error) {
      console.error('All permissions middleware error:', error);
      return res.status(500).json({
        success: false,
        code: 'PERMISSION_CHECK_ERROR',
        message: 'Error checking permissions'
      });
    }
  };
};

/**
 * Conditional permission check (used within controllers)
 *
 * This doesn't block access but can be used to conditionally
 * show/hide features or data within a controller.
 *
 * Usage: const canEdit = await checkPermission(req.membership._id, 'members.update');
 */
export const checkPermission = async (membershipId, permissionKey, resource = null, scope = null) => {
  return await permissionService.hasPermission(membershipId, permissionKey, resource, scope);
};

export default {
  requirePermission,
  requireResourceOwnership,
  preventSelfAction,
  requireCommitteeAccess,
  requireAnyPermission,
  requireAllPermissions,
  checkPermission
};