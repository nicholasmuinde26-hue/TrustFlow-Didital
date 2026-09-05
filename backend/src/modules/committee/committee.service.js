import Committee from '../../models/Committee.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import PermissionAuditLog from '../../models/PermissionAuditLog.js';
import permissionService from '../../services/permission.service.js';

// ========================================
// COMMITTEE SERVICE
// ========================================
//
// Service for managing committee operations,
// member assignments, and committee-specific
// permissions and workflows.
//
// ========================================

// Default committee permissions per committee type
const COMMITTEE_PERMISSIONS = {
  finance: [
    'finance.transactions.view',
    'finance.transactions.create',
    'finance.accounts.view',
    'finance.reconcile',
    'loans.view',
    'loans.review',
    'loans.approve',
    'expenses.view',
    'expenses.approve',
    'reports.generate'
  ],
  welfare: [
    'welfare.view',
    'welfare.apply',
    'welfare.review',
    'welfare.approve',
    'welfare.disburse',
    'members.view'
  ],
  investment: [
    'finance.summary.view',
    'finance.transactions.view',
    'reports.view',
    'reports.generate',
    'meetings.view'
  ],
  discipline: [
    'members.view',
    'members.view_sensitive',
    'members.suspend',
    'audit.view',
    'audit.investigate',
    'meetings.view'
  ],
  general: [
    'meetings.view',
    'meetings.create',
    'minutes.create',
    'members.view',
    'reports.view'
  ]
};

class CommitteeService {
  /**
   * Create a new committee
   */
  async createCommittee({
    chamaId,
    committeeType,
    name,
    description,
    chairpersonId,
    memberIds,
    settings,
    createdBy
  }) {
    try {
      // Validate chairperson is a member of the chama
      const chairperson = await ChamaMembership.findOne({
        _id: chairpersonId,
        chama_id: chamaId,
        status: 'active'
      });

      if (!chairperson) {
        throw new Error('Chairperson must be an active member of the chama');
      }

      // Validate all members are chama members
      const members = await ChamaMembership.find({
        _id: { $in: memberIds },
        chama_id: chamaId,
        status: 'active'
      });

      if (members.length !== memberIds.length) {
        throw new Error('All committee members must be active chama members');
      }

      // Prepare committee members array
      const committeeMembers = memberIds.map((memberId, index) => ({
        membership_id: memberId,
        role: String(memberId) === String(chairpersonId) ? 'chair' : 'member',
        joined_at: new Date()
      }));

      // Create committee
      const committee = await Committee.create({
        chama_id: chamaId,
        committee_type: committeeType,
        name,
        description,
        members: committeeMembers,
        chairperson_id: chairpersonId,
        permissions: COMMITTEE_PERMISSIONS[committeeType] || [],
        settings: settings || {},
        created_by: createdBy,
        status: 'active'
      });

      // Log committee creation
      await this.logCommitteeAction({
        chamaId,
        actorMembershipId: createdBy,
        action: 'committee_created',
        committeeId: committee._id,
        details: {
          committeeType,
          name,
          chairpersonId,
          memberCount: memberIds.length
        }
      });

      // Grant committee-specific permissions to committee members
      await this.grantCommitteePermissions(chamaId, committeeType, memberIds, createdBy);

      return committee;

    } catch (error) {
      console.error('Create committee error:', error);
      throw new Error(`Failed to create committee: ${error.message}`);
    }
  }

  /**
   * Grant committee-specific permissions to members
   */
  async grantCommitteePermissions(chamaId, committeeType, memberIds, grantedBy) {
    try {
      const permissions = COMMITTEE_PERMISSIONS[committeeType] || [];

      for (const memberId of memberIds) {
        for (const permissionKey of permissions) {
          await permissionService.grantPermission(chamaId, 'committee_member', permissionKey, {
            scopeOverride: null,
            committeeType,
            grantedBy,
            reason: `Committee membership: ${committeeType}`
          });
        }
      }

    } catch (error) {
      console.error('Grant committee permissions error:', error);
      throw new Error(`Failed to grant committee permissions: ${error.message}`);
    }
  }

  /**
   * Add member to committee
   */
  async addMember(committeeId, membershipId, role = 'member', addedBy) {
    try {
      const committee = await Committee.findById(committeeId);
      if (!committee) {
        throw new Error('Committee not found');
      }

      const membership = await ChamaMembership.findById(membershipId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      // Validate membership is from same chama
      if (String(membership.chama_id) !== String(committee.chama_id)) {
        throw new Error('Membership must be from the same chama');
      }

      // Add member to committee
      await committee.addMember(membershipId, role);

      // Grant committee permissions
      await this.grantCommitteePermissions(
        committee.chama_id,
        committee.committee_type,
        [membershipId],
        addedBy
      );

      // Log member addition
      await this.logCommitteeAction({
        chamaId: committee.chama_id,
        actorMembershipId: addedBy,
        action: 'committee_member_added',
        committeeId: committee._id,
        targetMembershipId: membershipId,
        details: { role }
      });

      return committee;

    } catch (error) {
      console.error('Add committee member error:', error);
      throw new Error(`Failed to add committee member: ${error.message}`);
    }
  }

  /**
   * Remove member from committee
   */
  async removeMember(committeeId, membershipId, removedBy) {
    try {
      const committee = await Committee.findById(committeeId);
      if (!committee) {
        throw new Error('Committee not found');
      }

      // Remove member from committee
      await committee.removeMember(membershipId);

      // Revoke committee-specific permissions
      await this.revokeCommitteePermissions(
        committee.chama_id,
        committee.committee_type,
        [membershipId],
        removedBy
      );

      // Log member removal
      await this.logCommitteeAction({
        chamaId: committee.chama_id,
        actorMembershipId: removedBy,
        action: 'committee_member_removed',
        committeeId: committee._id,
        targetMembershipId: membershipId
      });

      return committee;

    } catch (error) {
      console.error('Remove committee member error:', error);
      throw new Error(`Failed to remove committee member: ${error.message}`);
    }
  }

  /**
   * Revoke committee-specific permissions from members
   */
  async revokeCommitteePermissions(chamaId, committeeType, memberIds, revokedBy) {
    try {
      const permissions = COMMITTEE_PERMISSIONS[committeeType] || [];

      for (const memberId of memberIds) {
        for (const permissionKey of permissions) {
          await permissionService.revokePermission(
            chamaId,
            'committee_member',
            permissionKey,
            revokedBy,
            `Committee membership ended: ${committeeType}`
          );
        }
      }

    } catch (error) {
      console.error('Revoke committee permissions error:', error);
      throw new Error(`Failed to revoke committee permissions: ${error.message}`);
    }
  }

  /**
   * Update committee chairperson
   */
  async updateChairperson(committeeId, newChairpersonId, updatedBy) {
    try {
      const committee = await Committee.findById(committeeId);
      if (!committee) {
        throw new Error('Committee not found');
      }

      const membership = await ChamaMembership.findById(newChairpersonId);
      if (!membership) {
        throw new Error('Membership not found');
      }

      // Validate membership is from same chama
      if (String(membership.chama_id) !== String(committee.chama_id)) {
        throw new Error('Membership must be from the same chama');
      }

      // Set new chairperson
      await committee.setChairperson(newChairpersonId);

      // Log chairperson change
      await this.logCommitteeAction({
        chamaId: committee.chama_id,
        actorMembershipId: updatedBy,
        action: 'committee_chairperson_changed',
        committeeId: committee._id,
        details: {
          oldChairpersonId: committee.chairperson_id,
          newChairpersonId
        }
      });

      return committee;

    } catch (error) {
      console.error('Update chairperson error:', error);
      throw new Error(`Failed to update chairperson: ${error.message}`);
    }
  }

  /**
   * Dissolve committee
   */
  async dissolveCommittee(committeeId, dissolvedBy, reason = '') {
    try {
      const committee = await Committee.findById(committeeId);
      if (!committee) {
        throw new Error('Committee not found');
      }

      const memberIds = committee.members.map(m => m.membership_id);

      // Revoke all committee permissions
      await this.revokeCommitteePermissions(
        committee.chama_id,
        committee.committee_type,
        memberIds,
        dissolvedBy
      );

      // Update committee status
      committee.status = 'dissolved';
      committee.dissolved_at = new Date();
      await committee.save();

      // Log committee dissolution
      await this.logCommitteeAction({
        chamaId: committee.chama_id,
        actorMembershipId: dissolvedBy,
        action: 'committee_dissolved',
        committeeId: committee._id,
        details: { reason, memberCount: memberIds.length }
      });

      return committee;

    } catch (error) {
      console.error('Dissolve committee error:', error);
      throw new Error(`Failed to dissolve committee: ${error.message}`);
    }
  }

  /**
   * Get committee details
   */
  async getCommittee(committeeId) {
    try {
      const committee = await Committee.findById(committeeId)
        .populate('chama_id')
        .populate('members.membership_id')
        .populate('chairperson_id')
        .populate('created_by');

      if (!committee) {
        throw new Error('Committee not found');
      }

      return committee;

    } catch (error) {
      console.error('Get committee error:', error);
      throw new Error(`Failed to get committee: ${error.message}`);
    }
  }

  /**
   * Get all committees for a chama
   */
  async getChamaCommittees(chamaId) {
    try {
      const committees = await Committee.getActiveChamaCommittees(chamaId)
        .populate('members.membership_id')
        .populate('chairperson_id');

      return committees;

    } catch (error) {
      console.error('Get chama committees error:', error);
      throw new Error(`Failed to get chama committees: ${error.message}`);
    }
  }

  /**
   * Get committees for a membership
   */
  async getMembershipCommittees(membershipId) {
    try {
      const committees = await Committee.getMembershipCommittees(membershipId)
        .populate('chama_id')
        .populate('members.membership_id');

      return committees;

    } catch (error) {
      console.error('Get membership committees error:', error);
      throw new Error(`Failed to get membership committees: ${error.message}`);
    }
  }

  /**
   * Check if committee has quorum
   */
  async checkQuorum(committeeId) {
    try {
      const committee = await Committee.findById(committeeId);
      if (!committee) {
        throw new Error('Committee not found');
      }

      return {
        hasQuorum: committee.hasQuorum(),
        currentMembers: committee.members.length,
        requiredQuorum: committee.settings.quorum_required
      };

    } catch (error) {
      console.error('Check quorum error:', error);
      throw new Error(`Failed to check quorum: ${error.message}`);
    }
  }

  /**
   * Log committee action
   */
  async logCommitteeAction({
    chamaId,
    actorMembershipId,
    action,
    committeeId,
    targetMembershipId,
    details
  }) {
    try {
      const membership = await ChamaMembership.findById(actorMembershipId);

      await PermissionAuditLog.create({
        chama_id: chamaId,
        actor_membership_id: actorMembershipId,
        actor_role: membership?.role || 'unknown',
        action,
        target_type: 'committee',
        target_id: committeeId,
        target_description: `Committee action: ${action}`,
        before_state: null,
        after_state: details,
        reason: details?.reason || ''
      });

    } catch (error) {
      console.error('Log committee action error:', error);
      // Don't throw - logging failures shouldn't break the main operation
    }
  }

  /**
   * Initialize default committees for a new chama
   */
  async initializeDefaultCommittees(chamaId, chairpersonId, treasurerId, secretaryId) {
    try {
      const committees = [];

      // Create Finance Committee (led by treasurer)
      const financeCommittee = await this.createCommittee({
        chamaId,
        committeeType: 'finance',
        name: 'Finance Committee',
        description: 'Oversight of financial operations and decisions',
        chairpersonId: treasurerId,
        memberIds: [treasurerId, chairpersonId],
        createdBy: chairpersonId
      });
      committees.push(financeCommittee);

      // Create General Committee (led by chairperson)
      const generalCommittee = await this.createCommittee({
        chamaId,
        committeeType: 'general',
        name: 'General Committee',
        description: 'General administrative and governance functions',
        chairpersonId: chairpersonId,
        memberIds: [chairpersonId, secretaryId, treasurerId],
        createdBy: chairpersonId
      });
      committees.push(generalCommittee);

      return committees;

    } catch (error) {
      console.error('Initialize default committees error:', error);
      throw new Error(`Failed to initialize default committees: ${error.message}`);
    }
  }
}

export default new CommitteeService();