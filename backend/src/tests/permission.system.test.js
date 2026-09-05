/**
 * ============================================================================
 * PERMISSION SYSTEM INTEGRATION TESTS
 * ============================================================================
 *
 * Comprehensive testing suite for the permission architecture implementation.
 * Tests cover:
 * - Permission checks and scope restrictions
 * - Self-action prevention
 * - Privacy wall functionality
 * - Committee system
 * - Enhanced approval workflows
 * - Audit logging
 *
 * ============================================================================
 */

import mongoose from 'mongoose';
import permissionService from '../services/permission.service.js';
import privacyWallService from '../services/privacyWall.service.js';
import committeeService from '../modules/committee/committee.service.js';
import approvalService from '../modules/approval/approval.service.js';
import ChamaPermission from '../models/ChamaPermission.js';
import RolePermission from '../models/RolePermission.js';
import PermissionAuditLog from '../models/PermissionAuditLog.js';
import Committee from '../models/Committee.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import ChamaMembership from '../models/ChamaMembership.js';
import Chama from '../models/Chama.js';

// Test data setup
const testChamaData = {
  name: 'Test Chama for Permission Tests',
  description: 'Chama created for testing permission system',
  type: 'investment',
  contribution_amount: 1000,
  contribution_frequency: 'monthly'
};

const testMembershipData = {
  role: 'member',
  status: 'active'
};

describe('Permission System Integration Tests', () => {
  let testChama;
  let chairpersonMembership;
  let treasurerMembership;
  let memberMembership;
  let testMembershipId;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager_test');

    // Create test chama
    testChama = await Chama.create(testChamaData);

    // Create test memberships
    chairpersonMembership = await ChamaMembership.create({
      ...testMembershipData,
      chama_id: testChama._id,
      role: 'chairperson',
      user_id: new mongoose.Types.ObjectId()
    });

    treasurerMembership = await ChamaMembership.create({
      ...testMembershipData,
      chama_id: testChama._id,
      role: 'treasurer',
      user_id: new mongoose.Types.ObjectId()
    });

    memberMembership = await ChamaMembership.create({
      ...testMembershipData,
      chama_id: testChama._id,
      role: 'member',
      user_id: new mongoose.Types.ObjectId()
    });

    testMembershipId = memberMembership._id;

    // Initialize default permissions
    await permissionService.initializeDefaultPermissions(testChama._id, chairpersonMembership._id);
  });

  afterAll(async () => {
    // Cleanup test data
    await ChamaMembership.deleteMany({ chama_id: testChama._id });
    await RolePermission.deleteMany({ chama_id: testChama._id });
    await ChamaPermission.deleteMany({ chama_id: testChama._id });
    await Committee.deleteMany({ chama_id: testChama._id });
    await ApprovalRequest.deleteMany({ chama_id: testChama._id });
    await PermissionAuditLog.deleteMany({ chama_id: testChama._id });
    await Chama.deleteOne({ _id: testChama._id });

    await mongoose.disconnect();
  });

  describe('Permission Service Tests', () => {
    test('should grant permission to authorized role', async () => {
      const result = await permissionService.hasPermission(
        chairpersonMembership._id,
        'members.view',
        null,
        null
      );

      expect(result.granted).toBe(true);
      expect(result.scope).toBeDefined();
    });

    test('should deny permission to unauthorized role', async () => {
      const result = await permissionService.hasPermission(
        memberMembership._id,
        'members.create',
        null,
        null
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('does not have this permission');
    });

    test('should enforce scope restrictions', async () => {
      const result = await permissionService.hasPermission(
        memberMembership._id,
        'members.view',
        null,
        { resourceOwnerId: new mongoose.Types.ObjectId() }
      );

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('own resources only');
    });

    test('should allow own resource access with scope own', async () => {
      const result = await permissionService.hasPermission(
        memberMembership._id,
        'members.view',
        null,
        { resourceOwnerId: testMembershipId }
      );

      expect(result.granted).toBe(true);
    });

    test('should prevent self-action for sensitive permissions', async () => {
      const check = permissionService.checkSelfAction(
        treasurerMembership._id,
        treasurerMembership._id,
        'loans.approve'
      );

      expect(check.blocked).toBe(true);
      expect(check.reason).toContain('not permitted');
    });

    test('should allow self-action for non-sensitive permissions', async () => {
      const check = permissionService.checkSelfAction(
        memberMembership._id,
        memberMembership._id,
        'members.view'
      );

      expect(check.blocked).toBe(false);
    });

    test('should grant permission to role', async () => {
      const permission = await permissionService.grantPermission(
        testChama._id,
        'member',
        'loans.view',
        {
          scopeOverride: 'own',
          grantedBy: chairpersonMembership._id,
          reason: 'Test permission grant'
        }
      );

      expect(permission).toBeDefined();
      expect(permission.permission_key).toBe('loans.view');
      expect(permission.scope_override).toBe('own');
    });

    test('should revoke permission from role', async () => {
      await permissionService.grantPermission(
        testChama._id,
        'member',
        'loans.apply',
        {
          grantedBy: chairpersonMembership._id
        }
      );

      const revoked = await permissionService.revokePermission(
        testChama._id,
        'member',
        'loans.apply',
        chairpersonMembership._id,
        'Test revocation'
      );

      expect(revoked.status).toBe('revoked');
    });

    test('should get role permissions', async () => {
      const permissions = await permissionService.getRolePermissions(
        testChama._id,
        'chairperson'
      );

      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    test('should get membership permissions', async () => {
      const permissions = await permissionService.getMembershipPermissions(
        chairpersonMembership._id
      );

      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  describe('Privacy Wall Service Tests', () => {
    test('should get privacy config for role', () => {
      const config = privacyWallService.getPrivacyConfig('chairperson', false);

      expect(config).toBeDefined();
      expect(config.level).toBeDefined();
      expect(config.allowedFields).toBeDefined();
    });

    test('should check field access permissions', () => {
      const canAccess = privacyWallService.canAccessField(
        'chairperson',
        'member',
        'name',
        false
      );

      expect(canAccess).toBe(true);
    });

    test('should restrict sensitive fields for members', () => {
      const canAccess = privacyWallService.canAccessField(
        'member',
        'member',
        'mpesa_credentials',
        false
      );

      expect(canAccess).toBe(false);
    });

    test('should mask sensitive field values', () => {
      const masked = privacyWallService.maskSensitiveField('phone', '0712345678');

      expect(masked).toContain('*');
      expect(masked).toContain('5678');
    });

    test('should get visible fields for role', () => {
      const fields = privacyWallService.getVisibleFields('treasurer', false, 'financial');

      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    test('should check category access', () => {
      const canAccess = privacyWallService.canAccessCategory('treasurer', 'financial', false);

      expect(canAccess).toBe(true);
    });
  });

  describe('Committee Service Tests', () => {
    test('should create committee', async () => {
      const committee = await committeeService.createCommittee({
        chamaId: testChama._id,
        committeeType: 'finance',
        name: 'Test Finance Committee',
        description: 'Test committee for finance',
        chairpersonId: treasurerMembership._id,
        memberIds: [treasurerMembership._id, chairpersonMembership._id],
        createdBy: chairpersonMembership._id
      });

      expect(committee).toBeDefined();
      expect(committee.committee_type).toBe('finance');
      expect(committee.members.length).toBe(2);
    });

    test('should add member to committee', async () => {
      const committee = await Committee.getCommitteeByType(testChama._id, 'finance');

      const updatedCommittee = await committeeService.addMember(
        committee._id,
        memberMembership._id,
        'member',
        chairpersonMembership._id
      );

      expect(updatedCommittee.members.length).toBeGreaterThan(2);
    });

    test('should get chama committees', async () => {
      const committees = await committeeService.getChamaCommittees(testChama._id);

      expect(Array.isArray(committees)).toBe(true);
      expect(committees.length).toBeGreaterThan(0);
    });

    test('should check committee quorum', async () => {
      const committee = await Committee.getCommitteeByType(testChama._id, 'finance');

      const quorumStatus = await committeeService.checkQuorum(committee._id);

      expect(quorumStatus).toBeDefined();
      expect(quorumStatus.hasQuorum).toBeDefined();
      expect(quorumStatus.currentMembers).toBeDefined();
    });

    test('should update committee chairperson', async () => {
      const committee = await Committee.getCommitteeByType(testChama._id, 'finance');

      const updated = await committeeService.updateChairperson(
        committee._id,
        chairpersonMembership._id,
        chairpersonMembership._id
      );

      expect(String(updated.chairperson_id)).toBe(String(chairpersonMembership._id));
    });
  });

  describe('Enhanced Approval Workflow Tests', () => {
    test('should create approval request with permission context', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'LOAN_DISBURSEMENT',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Test Loan Disbursement',
        description: 'Test approval request',
        amount: 50000,
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'loans.disburse',
        requiredCommittee: 'finance'
      });

      expect(request).toBeDefined();
      expect(request.permission_key).toBe('loans.disburse');
      expect(request.committee_context.required_committee).toBe('finance');
    });

    test('should perform self-action checks on approval request', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'LOAN_DISBURSEMENT',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Self-Action Test',
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'loans.disburse'
      });

      expect(request.self_action_checks.length).toBeGreaterThan(0);
      expect(request.self_action_prevented).toBe(true);
    });

    test('should detect conflicts of interest', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'MGR_PAYOUT',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Conflict Test',
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'finance.transactions.create'
      });

      expect(request.conflict_management.has_conflicts).toBe(true);
      expect(request.conflict_management.detected_conflicts.length).toBeGreaterThan(0);
    });

    test('should submit approval with enhanced checks', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'EXPENSE',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Test Expense',
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'expenses.approve'
      });

      const approved = await approvalService.submitSignoff({
        requestId: request._id,
        approverMembershipId: chairpersonMembership._id,
        status: 'approved',
        comment: 'Test approval'
      });

      expect(approved.approvals.length).toBeGreaterThan(0);
      expect(approved.permission_check_log.length).toBeGreaterThan(0);
    });

    test('should prevent self-approval', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'EXPENSE',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Self-Approval Test',
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'expenses.approve'
      });

      await expect(
        approvalService.submitSignoff({
          requestId: request._id,
          approverMembershipId: treasurerMembership._id,
          status: 'approved'
        })
      ).rejects.toThrow('cannot approve their own request');
    });

    test('should resolve conflict', async () => {
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'MGR_PAYOUT',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Conflict Resolution Test',
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'finance.transactions.create'
      });

      const resolved = await approvalService.resolveConflict(
        request._id,
        treasurerMembership._id,
        'waived'
      );

      expect(resolved).toBeDefined();
    });

    test('should get pending approvals for membership', async () => {
      const pending = await approvalService.getPendingApprovalsForMembership(
        chairpersonMembership._id
      );

      expect(Array.isArray(pending)).toBe(true);
    });
  });

  describe('Audit Logging Tests', () => {
    test('should log permission changes', async () => {
      const initialCount = await PermissionAuditLog.countDocuments({
        chama_id: testChama._id
      });

      await permissionService.grantPermission(
        testChama._id,
        'member',
        'reports.view',
        {
          grantedBy: chairpersonMembership._id,
          reason: 'Audit test'
        }
      );

      const finalCount = await PermissionAuditLog.countDocuments({
        chama_id: testChama._id
      });

      expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('should log permission checks', async () => {
      const initialCount = await PermissionAuditLog.countDocuments({
        chama_id: testChama._id,
        action: { $in: ['permission_check_granted', 'permission_check_denied'] }
      });

      await permissionService.hasPermission(
        memberMembership._id,
        'members.view',
        null,
        null
      );

      const finalCount = await PermissionAuditLog.countDocuments({
        chama_id: testChama._id,
        action: { $in: ['permission_check_granted', 'permission_check_denied'] }
      });

      expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('should get chama audit logs', async () => {
      const logs = await PermissionAuditLog.getChamaAuditLogs(testChama._id, {
        limit: 10
      });

      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    test('should get security events', async () => {
      const events = await PermissionAuditLog.getSecurityEvents(testChama._id, {
        limit: 10
      });

      expect(Array.isArray(events)).toBe(true);
    });

    test('should get permission history', async () => {
      const history = await PermissionAuditLog.getPermissionHistory(
        testChama._id,
        'members.view'
      );

      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete permission workflow', async () => {
      // 1. Create approval request
      const request = await approvalService.createRequest({
        chamaId: testChama._id,
        resourceType: 'EXPENSE',
        resourceId: new mongoose.Types.ObjectId(),
        title: 'Integration Test Expense',
        amount: 10000,
        initiatedByMembershipId: treasurerMembership._id,
        permissionKey: 'expenses.approve',
        requiredCommittee: 'finance'
      });

      // 2. Check if chairperson can approve
      const canApprove = request.canApprove(
        chairpersonMembership._id,
        'chairperson'
      );

      expect(canApprove.canApprove).toBe(true);

      // 3. Submit approval
      const approved = await approvalService.submitSignoff({
        requestId: request._id,
        approverMembershipId: chairpersonMembership._id,
        status: 'approved',
        comment: 'Integration test approval'
      });

      // 4. Verify audit log was created
      const auditLogs = await PermissionAuditLog.getChamaAuditLogs(testChama._id, {
        action: 'permission_check_granted',
        limit: 5
      });

      expect(auditLogs.length).toBeGreaterThan(0);
    });

    test('should enforce privacy walls on member data', async () => {
      const testData = {
        name: 'Test Member',
        phone: '0712345678',
        mpesa_credentials: 'secret123',
        financial_data: {
          balance: 50000,
          account_number: '1234567890'
        }
      };

      const filtered = await privacyWallService.filterData(
        testData,
        memberMembership._id,
        testChama._id
      );

      expect(filtered).toBeDefined();
      // Members should not see sensitive credentials of others
      expect(filtered.mpesa_credentials).toBeUndefined();
    });

    test('should handle committee-based permissions', async () => {
      // Create finance committee
      const committee = await committeeService.createCommittee({
        chamaId: testChama._id,
        committeeType: 'welfare',
        name: 'Test Welfare Committee',
        chairpersonId: chairpersonMembership._id,
        memberIds: [chairpersonMembership._id],
        createdBy: chairpersonMembership._id
      });

      // Check committee-specific permissions
      const permissions = await permissionService.getMembershipPermissions(
        chairpersonMembership._id
      );

      expect(permissions.length).toBeGreaterThan(0);
    });
  });
});

// Export for use in test runners
export default {};