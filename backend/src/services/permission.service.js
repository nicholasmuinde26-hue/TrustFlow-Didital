import ChamaPermission from '../models/ChamaPermission.js';
import RolePermission from '../models/RolePermission.js';
import PermissionAuditLog from '../models/PermissionAuditLog.js';
import ChamaMembership from '../models/ChamaMembership.js';

// ========================================
// DEFAULT ROLE PERMISSIONS
// ========================================
//
// Based on the Kenyan chama governance model
// with separation of duties and scope restrictions.
//
// ========================================

const DEFAULT_ROLE_PERMISSIONS = {
  chairperson: [
    { key: 'members.view', scope: 'all' },
    { key: 'members.view_sensitive', scope: 'all' },
    { key: 'members.create', scope: 'all' },
    { key: 'members.update', scope: 'all' },
    { key: 'members.suspend', scope: 'all' },
    { key: 'meetings.view', scope: 'all' },
    { key: 'meetings.create', scope: 'all' },
    { key: 'meetings.manage', scope: 'all' },
    { key: 'meetings.close', scope: 'all' },
    { key: 'minutes.create', scope: 'all' },
    { key: 'minutes.edit', scope: 'all' },
    { key: 'minutes.publish', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'loans.view', scope: 'all' },
    { key: 'loans.apply', scope: 'own' },
    { key: 'loans.review', scope: 'all' },
    { key: 'loans.approve', scope: 'all' },
    { key: 'expenses.view', scope: 'all' },
    { key: 'expenses.create', scope: 'all' },
    { key: 'finance.summary.view', scope: 'all' },
    { key: 'finance.transactions.view', scope: 'all' },
    { key: 'welfare.view', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    { key: 'reports.generate', scope: 'all' },
    { key: 'roles.view', scope: 'all' },
    { key: 'roles.assign', scope: 'all' },
    { key: 'settings.view', scope: 'all' },
    { key: 'settings.manage', scope: 'all' }
  ],

  treasurer: [
    { key: 'members.view', scope: 'all' },
    { key: 'members.view_sensitive', scope: 'all' },
    { key: 'members.create', scope: 'all' },
    { key: 'members.update', scope: 'all' },
    { key: 'members.suspend', scope: 'all' },
    { key: 'members.remove', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'contributions.record', scope: 'all' },
    { key: 'contributions.reconcile', scope: 'all' },
    { key: 'loans.view', scope: 'all' },
    { key: 'loans.apply', scope: 'own' },
    { key: 'loans.disburse', scope: 'all' },
    { key: 'expenses.view', scope: 'all' },
    { key: 'expenses.create', scope: 'all' },
    { key: 'expenses.pay', scope: 'all' },
    { key: 'finance.summary.view', scope: 'all' },
    { key: 'finance.transactions.view', scope: 'all' },
    { key: 'finance.transactions.create', scope: 'all' },
    { key: 'finance.accounts.view', scope: 'all' },
    { key: 'finance.reconcile', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    { key: 'reports.generate', scope: 'all' },
    { key: 'reports.export', scope: 'all' },
    { key: 'roles.view', scope: 'all' },
    { key: 'roles.assign', scope: 'all' },
    { key: 'settings.view', scope: 'all' },
    { key: 'settings.manage', scope: 'all' }
  ],

  secretary: [
    { key: 'members.view', scope: 'all' },
    { key: 'meetings.view', scope: 'all' },
    { key: 'meetings.create', scope: 'all' },
    { key: 'minutes.create', scope: 'all' },
    { key: 'minutes.edit', scope: 'all' },
    { key: 'minutes.publish', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'loans.view', scope: 'all' },
    { key: 'welfare.view', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    { key: 'roles.view', scope: 'all' }
  ],

  auditor: [
    { key: 'members.view', scope: 'all' },
    { key: 'members.view_sensitive', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'loans.view', scope: 'all' },
    { key: 'expenses.view', scope: 'all' },
    { key: 'finance.summary.view', scope: 'all' },
    { key: 'finance.transactions.view', scope: 'all' },
    { key: 'finance.accounts.view', scope: 'all' },
    { key: 'audit.view', scope: 'all' },
    { key: 'audit.investigate', scope: 'all' },
    { key: 'audit.report', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    { key: 'reports.generate', scope: 'all' },
    { key: 'reports.export', scope: 'all' }
  ],

  committee_member: [
    { key: 'members.view', scope: 'all' },
    { key: 'meetings.view', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'loans.view', scope: 'all' },
    { key: 'welfare.view', scope: 'all' },
    { key: 'reports.view', scope: 'all' }
  ],

  member: [
    { key: 'members.view', scope: 'own' },
    { key: 'contributions.view', scope: 'own' },
    { key: 'loans.view', scope: 'own' },
    { key: 'loans.apply', scope: 'own' },
    { key: 'welfare.view', scope: 'own' },
    { key: 'welfare.apply', scope: 'own' },
    { key: 'meetings.view', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    { key: 'finance.summary.view', scope: 'limited' }
  ],

  patron: [
    { key: 'members.view', scope: 'all' },
    { key: 'meetings.view', scope: 'all' },
    { key: 'contributions.view', scope: 'all' },
    { key: 'reports.view', scope: 'all' },
    // Patrons don't take out loans, but the "My Chama" member dashboard
    // (GET /loans/me/summary) is shared by every Chama role — without
    // this, a patron sees the "My Chama" nav item but the page 403s.
    { key: 'loans.view', scope: 'own' }
  ]
};

class PermissionService {
  /**
   * Check if a membership has a specific permission
   */
  async hasPermission(membershipId, permissionKey, resource = null, scope = null) {
    try {
      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        return { granted: false, reason: 'Membership not found' };
      }

      if (membership.status !== 'active') {
        return { granted: false, reason: 'Membership is not active' };
      }

      // Get role permissions for this membership's role
      const rolePermissions = await RolePermission.find({
        chama_id: membership.chama_id,
        role: membership.role,
        permission_key: permissionKey,
        status: 'active'
      });

      if (rolePermissions.length === 0) {
        // No row for this exact (chama, role, key). Before denying, work
        // out WHY there's no row: either (a) this chama's RolePermission
        // table was never seeded for this role at all — e.g.
        // initializeDefaultPermissions() failed/was skipped when the
        // chama was created, or this chama predates the permission
        // system — or (b) permissions WERE configured for this role and
        // this key was deliberately left out / revoked. Only (a) should
        // fall back to the baked-in defaults; (b) is a real, intentional
        // denial and must stay denied.
        const anyPermissionForRole = await RolePermission.exists({
          chama_id: membership.chama_id,
          role: membership.role,
          status: 'active'
        });

        if (!anyPermissionForRole) {
          const fallbackDefaults = DEFAULT_ROLE_PERMISSIONS[membership.role] || [];
          const fallbackMatch = fallbackDefaults.find((perm) => perm.key === permissionKey);

          if (fallbackMatch) {
            await this.logPermissionCheck({
              chamaId: membership.chama_id,
              actorMembershipId: membershipId,
              actorRole: membership.role,
              permissionKey,
              result: 'granted',
              reason: 'Granted via built-in role defaults (chama permissions not yet initialized)',
              resource
            });

            if (scope && scope.resourceOwnerId) {
              const scopeCheck = this.checkScope(fallbackMatch.scope || 'all', membership._id, scope.resourceOwnerId);
              if (!scopeCheck.passed) {
                return { granted: false, reason: scopeCheck.reason };
              }
            }

            return { granted: true, scope: fallbackMatch.scope || 'all' };
          }
        }

        await this.logPermissionCheck({
          chamaId: membership.chama_id,
          actorMembershipId: membershipId,
          actorRole: membership.role,
          permissionKey,
          result: 'role_denied',
          reason: `Role ${membership.role} does not have permission ${permissionKey}`,
          resource
        });
        return { granted: false, reason: `Role ${membership.role} does not have this permission` };
      }

      // Find the applicable permission (considering committee assignments)
      let applicablePermission = rolePermissions[0];

      // Check committee-specific permissions
      if (scope && scope.committeeType) {
        const committeePermission = rolePermissions.find(rp =>
          rp.matchesCommittee && rp.matchesCommittee(scope.committeeType)
        );
        if (committeePermission) {
          applicablePermission = committeePermission;
        }
      }

      // Check scope restrictions
      const effectiveScope = applicablePermission.scope_override || 'all';
      if (scope && scope.resourceOwnerId) {
        const scopeCheck = this.checkScope(effectiveScope, membership._id, scope.resourceOwnerId);
        if (!scopeCheck.passed) {
          await this.logPermissionCheck({
            chamaId: membership.chama_id,
            actorMembershipId: membershipId,
            actorRole: membership.role,
            permissionKey,
            result: 'scope_denied',
            reason: scopeCheck.reason,
            resource
          });
          return { granted: false, reason: scopeCheck.reason };
        }
      }

      await this.logPermissionCheck({
        chamaId: membership.chama_id,
        actorMembershipId: membershipId,
        actorRole: membership.role,
        permissionKey,
        result: 'granted',
        resource
      });

      return { granted: true, scope: effectiveScope };

    } catch (error) {
      console.error('Permission check error:', error);
      return { granted: false, reason: 'Permission check failed' };
    }
  }

  /**
   * Check if action would be self-action (actor trying to act on their own resources)
   */
  checkSelfAction(actorMembershipId, targetMembershipId, permissionKey) {
    if (String(actorMembershipId) === String(targetMembershipId)) {
      // Define permissions that should block self-action
      const selfActionBlockedList = [
        'loans.approve',
        'loans.disburse',
        'expenses.approve',
        'expenses.pay',
        'members.suspend',
        'members.remove',
        'roles.assign'
      ];

      if (selfActionBlockedList.includes(permissionKey)) {
        return {
          blocked: true,
          reason: 'Self-action is not permitted for this permission'
        };
      }
    }

    return { blocked: false };
  }

  /**
   * Check scope restrictions
   */
  checkScope(scope, actorId, resourceOwnerId) {
    switch (scope) {
      case 'all':
        return { passed: true };
      case 'own':
        if (String(actorId) === String(resourceOwnerId)) {
          return { passed: true };
        }
        return { passed: false, reason: 'Permission limited to own resources only' };
      case 'committee':
        // Would need committee context to fully implement
        return { passed: true }; // Placeholder for committee logic
      case 'limited':
        // Limited access - allows viewing but not modifying
        if (String(actorId) === String(resourceOwnerId)) {
          return { passed: true };
        }
        return { passed: true, reason: 'Limited access granted' };
      case 'none':
        return { passed: false, reason: 'Permission scope is set to none' };
      default:
        return { passed: true };
    }
  }

  /**
   * Grant permission to a role
   */
  async grantPermission(chamaId, role, permissionKey, options = {}) {
    const {
      scopeOverride = null,
      committeeType = null,
      grantedBy = null,
      expiresAt = null,
      reason = ''
    } = options;

    try {
      // Check if permission already exists
      const existing = await RolePermission.findOne({
        chama_id: chamaId,
        role,
        permission_key: permissionKey
      });

      if (existing) {
        // Update existing permission
        const beforeState = existing.toObject();

        if (scopeOverride !== null) existing.scope_override = scopeOverride;
        if (committeeType !== null) existing.committee_type = committeeType;
        if (expiresAt !== null) existing.expires_at = expiresAt;
        if (existing.status === 'revoked' || existing.status === 'expired') {
          existing.status = 'active';
        }
        existing.granted_by = grantedBy;
        existing.granted_at = new Date();

        await existing.save();

        const afterState = existing.toObject();

        await this.logPermissionChange({
          chamaId,
          actorMembershipId: grantedBy,
          action: 'permission_granted',
          targetType: 'permission',
          targetId: existing._id,
          targetDescription: `${role} - ${permissionKey}`,
          beforeState,
          afterState,
          permissionKey,
          reason
        });

        return existing;
      }

      // Create new permission
      const permission = await RolePermission.create({
        chama_id: chamaId,
        role,
        permission_key: permissionKey,
        scope_override: scopeOverride,
        committee_type: committeeType,
        granted_by: grantedBy,
        expires_at: expiresAt,
        status: 'active'
      });

      await this.logPermissionChange({
        chamaId,
        actorMembershipId: grantedBy,
        action: 'permission_granted',
        targetType: 'permission',
        targetId: permission._id,
        targetDescription: `${role} - ${permissionKey}`,
        beforeState: null,
        afterState: permission.toObject(),
        permissionKey,
        reason
      });

      return permission;

    } catch (error) {
      console.error('Grant permission error:', error);
      throw new Error(`Failed to grant permission: ${error.message}`);
    }
  }

  /**
   * Revoke permission from a role
   */
  async revokePermission(chamaId, role, permissionKey, revokedBy, reason = '') {
    try {
      const permission = await RolePermission.findOne({
        chama_id: chamaId,
        role,
        permission_key: permissionKey,
        status: 'active'
      });

      if (!permission) {
        throw new Error('Active permission not found');
      }

      const beforeState = permission.toObject();
      permission.status = 'revoked';
      await permission.save();

      await this.logPermissionChange({
        chamaId,
        actorMembershipId: revokedBy,
        action: 'permission_revoked',
        targetType: 'permission',
        targetId: permission._id,
        targetDescription: `${role} - ${permissionKey}`,
        beforeState,
        afterState: permission.toObject(),
        permissionKey,
        reason
      });

      return permission;

    } catch (error) {
      console.error('Revoke permission error:', error);
      throw new Error(`Failed to revoke permission: ${error.message}`);
    }
  }

  /**
   * Initialize default permissions for a new chama
   */
  async initializeDefaultPermissions(chamaId, initializedBy) {
    try {
      const permissions = [];

      for (const [role, rolePerms] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        for (const perm of rolePerms) {
          const permission = await this.grantPermission(chamaId, role, perm.key, {
            scopeOverride: perm.scope,
            grantedBy: initializedBy,
            reason: 'Default permission initialization'
          });
          permissions.push(permission);
        }
      }

      return permissions;

    } catch (error) {
      console.error('Initialize permissions error:', error);
      throw new Error(`Failed to initialize default permissions: ${error.message}`);
    }
  }

  /**
   * Get all permissions for a role in a chama
   */
  async getRolePermissions(chamaId, role) {
    try {
      const permissions = await RolePermission.find({
        chama_id: chamaId,
        role,
        status: 'active'
      }).sort({ permission_key: 1 });

      return permissions;

    } catch (error) {
      console.error('Get role permissions error:', error);
      throw new Error(`Failed to get role permissions: ${error.message}`);
    }
  }

  /**
   * Get all permissions for a membership (considering role and committee assignments)
   */
  async getMembershipPermissions(membershipId) {
    try {
      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      // Get role-based permissions
      const rolePermissions = await RolePermission.find({
        chama_id: membership.chama_id,
        role: membership.role,
        status: 'active'
      });

      // Get committee-specific permissions if applicable
      let committeePermissions = [];
      if (membership.committee_assignments && membership.committee_assignments.length > 0) {
        const committeeTypes = membership.committee_assignments.map(ca => ca.committee_type);
        committeePermissions = await RolePermission.find({
          chama_id: membership.chama_id,
          role: 'committee_member',
          committee_type: { $in: committeeTypes },
          status: 'active'
        });
      }

      // Combine and deduplicate permissions
      const allPermissions = [...rolePermissions];
      for (const committeePerm of committeePermissions) {
        const exists = allPermissions.find(p => p.permission_key === committeePerm.permission_key);
        if (!exists) {
          allPermissions.push(committeePerm);
        }
      }

      return allPermissions;

    } catch (error) {
      console.error('Get membership permissions error:', error);
      throw new Error(`Failed to get membership permissions: ${error.message}`);
    }
  }

  /**
   * Log permission change
   */
  async logPermissionChange({
    chamaId,
    actorMembershipId,
    action,
    targetType,
    targetId,
    targetDescription,
    beforeState,
    afterState,
    permissionKey,
    reason,
    ipAddress,
    userAgent
  }) {
    try {
      const membership = await ChamaMembership.findById(actorMembershipId);

      await PermissionAuditLog.create({
        chama_id: chamaId,
        actor_membership_id: actorMembershipId,
        actor_role: membership?.role || 'unknown',
        action,
        target_type: targetType,
        target_id: targetId,
        target_description: targetDescription,
        before_state: beforeState,
        after_state: afterState,
        permission_key: permissionKey,
        reason,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    } catch (error) {
      console.error('Log permission change error:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Log permission check
   */
  async logPermissionCheck({
    chamaId,
    actorMembershipId,
    actorRole,
    permissionKey,
    result,
    reason,
    resource,
    ipAddress,
    userAgent
  }) {
    try {
      await PermissionAuditLog.create({
        chama_id: chamaId,
        actor_membership_id: actorMembershipId,
        actor_role: actorRole,
        action: result === 'granted' ? 'permission_check_granted' : 'permission_check_denied',
        target_type: 'permission',
        target_id: null,
        target_description: permissionKey,
        permission_key: permissionKey,
        resource_type: resource?.type,
        resource_id: resource?.id,
        check_result: result,
        denial_reason: result !== 'granted' ? reason : null,
        ip_address: ipAddress,
        user_agent: userAgent
      });

    } catch (error) {
      console.error('Log permission check error:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Clean up expired permissions
   */
  async cleanupExpiredPermissions() {
    try {
      const result = await RolePermission.updateMany(
        {
          expires_at: { $lt: new Date() },
          status: 'active'
        },
        {
          status: 'expired'
        }
      );

      return result;

    } catch (error) {
      console.error('Cleanup expired permissions error:', error);
      throw new Error(`Failed to cleanup expired permissions: ${error.message}`);
    }
  }
}

export default new PermissionService();