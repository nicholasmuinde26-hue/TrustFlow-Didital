import MgrPolicy from '../../models/MgrPolicy.js';
import MgrRound from '../../models/MgrRound.js';
import MgrAuditLog from '../../models/MgrAuditLog.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Payout from '../../models/Payout.js';
import approvalService from '../approval/approval.service.js';
import mgrEligibilityService from './mgrEligibility.service.js';
import mgrReconciliationService from './mgrReconciliation.service.js';
import paymentService from '../../payment/payment.service.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';

class MgrService {
  /**
   * Create a new MGR Policy draft
   */
  async createPolicy({ chamaId, userId, policyData }) {
    const existingActive = await MgrPolicy.findOne({ chama_id: chamaId, status: 'active' });
    if (existingActive) {
      throw new Error('An active MGR Policy already exists for this Chama. Archive or complete it before creating a new policy.');
    }

    const versionCount = await MgrPolicy.countDocuments({ chama_id: chamaId });

    const policy = await MgrPolicy.create({
      chama_id: chamaId,
      version: versionCount + 1,
      name: policyData.name,
      description: policyData.description || '',
      currency: policyData.currency || 'KES',
      frequency: policyData.frequency || 'monthly',
      start_date: policyData.start_date || new Date(),
      contribution_deadline_day: policyData.contribution_deadline_day || 5,
      grace_period_days: policyData.grace_period_days || 3,
      participants: policyData.participants || [],
      contribution_rule: policyData.contribution_rule || {
        type: 'uniform',
        uniform_amount: policyData.uniform_amount || 5000,
      },
      rotation_rule: policyData.rotation_rule || { order_type: 'fixed', lock_on_activation: true },
      payout_rule: policyData.payout_rule || {
        calculation: 'actual_collected',
        allow_payout_before_100_pct: false,
        min_collection_threshold_pct: 100,
        unpaid_handling: 'carry_forward',
      },
      eligibility_rule: policyData.eligibility_rule || {
        require_active_membership: true,
        require_full_contributions: true,
        check_overdue_loans: false,
        check_outstanding_penalties: false,
        check_minimum_savings: false,
      },
      penalty_rule: policyData.penalty_rule || {
        penalty_type: 'fixed',
        penalty_amount: 100,
        grace_days: 3,
        default_action: 'keep_schedule',
      },
      approval_rule: policyData.approval_rule || {
        required_approvals: 2,
        eligible_roles: ['chairperson', 'secretary', 'treasurer'],
        allow_initiator_approval: false,
      },
      status: 'draft',
      created_by: userId,
    });

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policy._id,
      actor_id: userId,
      event_type: 'POLICY_CREATED',
      summary: `MGR Policy v${policy.version} "${policy.name}" created as draft`,
      details: { policyId: policy._id, participantsCount: policy.participants.length },
    });

    return policy;
  }

  /**
   * Update (re-edit) an MGR Policy (draft or active)
   */
  async updatePolicy({ chamaId, policyId, userId, policyData }) {
    const policy = await MgrPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new Error('MGR Policy not found');

    const allowed = [
      'name', 'description', 'currency', 'frequency', 'start_date',
      'contribution_deadline_day', 'grace_period_days', 'participants',
      'contribution_rule', 'rotation_rule', 'payout_rule',
      'eligibility_rule', 'penalty_rule', 'approval_rule',
    ];

    for (const field of allowed) {
      if (policyData[field] !== undefined) {
        policy[field] = policyData[field];
      }
    }

    await policy.save();

    // If active policy, update the associated ContributionPlan if uniform amount changed
    if (policy.status === 'active') {
      const amountVal = policy.contribution_rule?.uniform_amount;
      if (amountVal) {
        await ContributionPlan.updateMany(
          { owner_id: chamaId, contribution_type: 'merry_go_round' },
          { $set: { amount: amountVal, frequency: policy.frequency } }
        );
      }
    }

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policy._id,
      actor_id: userId,
      event_type: 'POLICY_UPDATED',
      summary: `MGR Policy v${policy.version} "${policy.name}" updated by official`,
    });

    return policy;
  }

  /**
   * Send payment reminders to unpaid/partial members for the current round
   */
  async sendReminders({ roundId, actorUserId }) {
    const round = await MgrRound.findById(roundId);
    if (!round) throw new Error('Round not found');

    const obligations = await ContributionObligation.find({
      plan_id: round.contribution_plan_id,
      status: { $in: ['pending', 'partially_paid', 'overdue'] },
    }).populate({
      path: 'participant_id',
      populate: { path: 'user_id', select: 'name phone email' },
    });

    const unpaidCount = obligations.length;

    await MgrAuditLog.create({
      chama_id: round.chama_id,
      policy_id: round.policy_id,
      round_id: round._id,
      actor_id: actorUserId,
      event_type: 'REMINDERS_SENT',
      summary: `Payment reminders sent to ${unpaidCount} unpaid/partial member(s) for Round #${round.round_number}`,
    });

    return {
      remindedCount: unpaidCount,
      members: obligations.map(o => o.participant_id?.user_id?.name || 'Member'),
    };
  }

  /**
   * Activate an MGR Policy and generate all round objects
   */
  async activatePolicy({ chamaId, policyId, userId }) {
    const policy = await MgrPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new Error('MGR Policy not found');
    if (policy.status === 'active') throw new Error('Policy is already active');

    policy.status = 'active';
    await policy.save();

    // Create associated ContributionPlan
    const amountVal = policy.contribution_rule?.uniform_amount || 5000;
    const plan = await ContributionPlan.create({
      owner_type: 'Chama',
      owner_id: chamaId,
      participant_type: 'ChamaMembership',
      created_by: userId,
      name: `MGR Plan - ${policy.name}`,
      description: `Contribution plan for MGR Policy v${policy.version}`,
      currency: policy.currency,
      contribution_type: 'merry_go_round',
      frequency: policy.frequency,
      amount: amountVal,
      start_date: policy.start_date,
      status: 'active',
      merry_go_round: {
        enabled: true,
        payout_interval: policy.frequency,
      },
    });

    // Generate MgrRound database objects for each participant
    const rounds = [];
    const startDate = new Date(policy.start_date);

    for (let i = 0; i < policy.participants.length; i++) {
      const recipientId = policy.participants[i];
      const dueDate = new Date(startDate);
      if (policy.frequency === 'monthly') {
        dueDate.setMonth(startDate.getMonth() + i);
      } else if (policy.frequency === 'weekly') {
        dueDate.setDate(startDate.getDate() + i * 7);
      } else {
        dueDate.setMonth(startDate.getMonth() + i);
      }

      const expectedAmount = Number(amountVal) * policy.participants.length;

      const round = await MgrRound.create({
        chama_id: chamaId,
        policy_id: policy._id,
        round_number: i + 1,
        recipient_id: recipientId,
        due_date: dueDate,
        expected_amount: expectedAmount,
        collected_amount: 0,
        status: i === 0 ? 'collecting' : 'upcoming',
        contribution_plan_id: plan._id,
      });

      rounds.push(round);

      // Create obligations for Round 1
      if (i === 0) {
        for (const partId of policy.participants) {
          await ContributionObligation.create({
            plan_id: plan._id,
            owner_type: 'Chama',
            owner_id: chamaId,
            participant_type: 'ChamaMembership',
            participant_id: partId,
            expected_amount: amountVal,
            currency: policy.currency,
            due_date: dueDate,
            status: 'pending',
          });
        }
      }
    }

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policy._id,
      actor_id: userId,
      event_type: 'POLICY_ACTIVATED',
      summary: `MGR Policy v${policy.version} activated with ${rounds.length} rounds generated`,
      details: { roundsCount: rounds.length, planId: plan._id },
    });

    return { policy, rounds };
  }

  /**
   * Get complete dashboard overview for active MGR
   */
  async getDashboardOverview(chamaId) {
    const policy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'active' }).populate({
      path: 'participants',
      populate: { path: 'user_id', select: 'name email phone' },
    });

    if (!policy) {
      const draftPolicy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'draft' }).populate({
        path: 'participants',
        populate: { path: 'user_id', select: 'name email phone' },
      });

      return {
        hasPolicy: !!draftPolicy,
        policy: draftPolicy || null,
        rounds: [],
        currentRound: null,
        obligations: [],
        auditLogs: [],
      };
    }

    const rounds = await MgrRound.find({ chama_id: chamaId, policy_id: policy._id })
      .populate({
        path: 'recipient_id',
        populate: { path: 'user_id', select: 'name email phone' },
      })
      .populate('approval_request_id')
      .sort({ round_number: 1 });

    const currentRound = rounds.find((r) => ['collecting', 'target_reached', 'eligibility_checking', 'payout_proposed', 'pending_approval', 'approved', 'disbursing', 'on_hold'].includes(r.status)) || rounds[0];

    let obligations = [];
    if (currentRound && currentRound.contribution_plan_id) {
      obligations = await ContributionObligation.find({
        $or: [
          { plan_id: currentRound.contribution_plan_id },
          { contribution_plan_id: currentRound.contribution_plan_id },
        ],
      })
        .populate({
          path: 'participant_id',
          populate: { path: 'user_id', select: 'name email phone' },
        });
    }

    // Fallback: If no obligations found for this round yet, generate obligations for all policy participants
    if (obligations.length === 0 && policy && Array.isArray(policy.participants) && policy.participants.length > 0) {
      const expectedPerMember = Number(policy.contribution_rule?.uniform_amount || 0);
      const dueDate = currentRound?.due_date || new Date();

      obligations = policy.participants.map((part) => ({
        _id: part._id || part,
        plan_id: currentRound?.contribution_plan_id,
        participant_id: part,
        member_id: part,
        expected_amount: expectedPerMember,
        amount_due: expectedPerMember,
        paid_amount: 0,
        amount_paid: 0,
        status: 'pending',
        due_date: dueDate,
      }));
    }

    const auditLogs = await MgrAuditLog.find({ chama_id: chamaId })
      .populate('actor_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    return {
      hasPolicy: true,
      policy,
      rounds,
      currentRound,
      obligations,
      auditLogs,
    };
  }

  /**
   * Propose Payout (Treasurer action)
   */
  async proposePayout({ roundId, treasurerUserId, amount, disbursementMethod = 'mpesa', phoneNumber, notes = '' }) {
    const round = await MgrRound.findById(roundId).populate('policy_id');
    if (!round) throw new Error('Round not found');

    const chamaId = round.chama_id;
    const policy = round.policy_id;

    // Find Treasurer's membership
    const treasurerMember = await ChamaMembership.findOne({ chama_id: chamaId, user_id: treasurerUserId });
    if (!treasurerMember) throw new Error('Treasurer membership not found');

    // Run eligibility check
    const eligibility = await mgrEligibilityService.evaluateEligibility({
      round,
      policy,
      memberId: round.recipient_id,
    });

    if (!eligibility.passed && !eligibility.overridden) {
      throw new Error(`Member is not eligible for payout: ${eligibility.reasons.join('; ')}`);
    }

    // Check minimum collection threshold
    const expected = Number(round.expected_amount);
    const collected = Number(round.collected_amount);
    const collectionPct = expected > 0 ? (collected / expected) * 100 : 0;
    const minPct = policy.payout_rule?.min_collection_threshold_pct || 100;

    if (collectionPct < minPct && !policy.payout_rule?.allow_payout_before_100_pct) {
      throw new Error(`Collection is at ${collectionPct.toFixed(1)}%, but minimum required threshold is ${minPct}%`);
    }

    const payoutAmount = amount || collected;

    // Create Approval Request via Approval Service
    const recipientMembership = await ChamaMembership.findById(round.recipient_id).populate('user_id', 'name');
    const recipientName = recipientMembership?.user_id?.name || 'Member';

    const approvalRequest = await approvalService.createRequest({
      chamaId,
      resourceType: 'MGR_PAYOUT',
      resourceId: round._id,
      action: 'DISBURSE',
      title: `MGR Round #${round.round_number} Payout to ${recipientName}`,
      description: `Disbursement of KES ${payoutAmount.toLocaleString()} via ${disbursementMethod.toUpperCase()}`,
      amount: payoutAmount,
      initiatedByMembershipId: treasurerMember._id,
      requiredApprovals: policy.approval_rule?.required_approvals || 2,
      eligibleRoles: policy.approval_rule?.eligible_roles || ['chairperson', 'secretary', 'treasurer'],
      allowInitiatorApproval: policy.approval_rule?.allow_initiator_approval || false,
    });

    round.status = 'pending_approval';
    round.payout_amount = payoutAmount;
    round.payout_proposal = {
      proposed_by: treasurerUserId,
      proposed_at: new Date(),
      amount: payoutAmount,
      disbursement_method: disbursementMethod,
      phone_number: phoneNumber,
      notes,
    };
    round.approval_request_id = approvalRequest._id;
    await round.save();

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policy._id,
      round_id: round._id,
      actor_id: treasurerUserId,
      event_type: 'PAYOUT_SUBMITTED_FOR_APPROVAL',
      summary: `Treasurer proposed payout of KES ${payoutAmount} for Round #${round.round_number}`,
      details: { approvalRequestId: approvalRequest._id, recipientName },
    });

    return { round, approvalRequest };
  }

  /**
   * Finalize and Disburse Payout after approval
   */
  async disbursePayout({ roundId, actorUserId }) {
    const round = await MgrRound.findById(roundId).populate('approval_request_id').populate('policy_id');
    if (!round) throw new Error('Round not found');

    if (!round.approval_request_id || round.approval_request_id.status !== 'approved') {
      throw new Error('Payout cannot be disbursed until all required approvals are completed.');
    }

    round.status = 'approved';
    await round.save();

    round.status = 'disbursing';
    await round.save();

    // Create formal Payout record
    const payout = await Payout.create({
      chama_id: round.chama_id,
      contribution_plan_id: round.contribution_plan_id,
      round_start: round.due_date,
      member_id: round.recipient_id,
      payout_position: round.round_number,
      amount: round.payout_amount || round.collected_amount,
      currency: round.policy_id?.currency || 'KES',
      status: 'paid',
      disbursement_method: round.payout_proposal?.disbursement_method || 'mpesa',
      external_reference: `MGR-MPESA-${Date.now()}`,
      paid_at: new Date(),
    });

    round.payout_id = payout._id;
    round.status = 'paid';
    round.paid_at = new Date();
    round.disbursement_method = payout.disbursement_method;
    round.external_reference = payout.external_reference;
    await round.save();

    await MgrAuditLog.create({
      chama_id: round.chama_id,
      policy_id: round.policy_id._id,
      round_id: round._id,
      actor_id: actorUserId,
      event_type: 'DISBURSEMENT_CONFIRMED',
      summary: `Payout of KES ${round.payout_amount} disbursed for Round #${round.round_number}`,
      details: { payoutId: payout._id, externalRef: payout.external_reference },
    });

    // Perform round reconciliation
    const { success: reconciled } = await mgrReconciliationService.reconcileRound({ roundId: round._id, actorUserId });

    if (!reconciled) {
      // Mismatch: round is on_hold. Stop here - don't open the next round
      // or mark the policy complete until this is resolved.
      return { round, payout, nextRound: null };
    }

    // Open next round if available
    const nextRound = await MgrRound.findOne({
      chama_id: round.chama_id,
      policy_id: round.policy_id._id,
      round_number: round.round_number + 1,
    });

    if (nextRound) {
      nextRound.status = 'collecting';
      await nextRound.save();

      // Create obligations for next round
      for (const partId of round.policy_id.participants) {
        await ContributionObligation.create({
          plan_id: round.contribution_plan_id,
          owner_type: 'Chama',
          owner_id: round.chama_id,
          participant_type: 'ChamaMembership',
          participant_id: partId,
          expected_amount: round.policy_id.contribution_rule?.uniform_amount || 5000,
          currency: round.policy_id.currency,
          due_date: nextRound.due_date,
          status: 'pending',
        });
      }
    } else {
      // All rounds completed!
      const policy = await MgrPolicy.findById(round.policy_id._id);
      if (policy) {
        policy.status = 'completed';
        await policy.save();
      }

      await MgrAuditLog.create({
        chama_id: round.chama_id,
        policy_id: round.policy_id._id,
        actor_id: actorUserId,
        event_type: 'CYCLE_COMPLETED',
        summary: `All ${round.round_number} rounds of MGR Policy v${policy?.version} completed!`,
      });
    }

    return { round, payout, nextRound };
  }

  /**
   * Record contribution payment for member in current round.
   *
   * Routes through the same Payment Engine (paymentService.initiate) that
   * M-Pesa STK Push uses, so the GL entries (MgrContributionRule: DR
   * Cash/Bank/M-Pesa Clearing, CR Payout Clearing) and the obligation close
   * together on the same code path instead of being mutated by hand here.
   * financeEngine's "mgr" branch calls syncRoundCollection() below once the
   * payment lands, keeping MgrRound.collected_amount in sync.
   */
  async recordMemberPayment({ chamaId, memberId, amount, paymentMethod = 'cash', phoneNumber = null, reference = '', actorUserId }) {
    const policy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'active' });
    if (!policy) throw new Error('No active MGR policy found');

    const currentRound = await MgrRound.findOne({ chama_id: chamaId, policy_id: policy._id, status: { $in: ['collecting', 'target_reached'] } });
    if (!currentRound) throw new Error('No round currently accepting collections');

    const obligation = await ContributionObligation.findOne({
      plan_id: currentRound.contribution_plan_id,
      participant_id: memberId,
      status: { $in: ['pending', 'partially_paid', 'overdue'] },
    });
    if (!obligation) throw new Error('This member has no outstanding contribution for the current round');

    const isMpesa = String(paymentMethod).toLowerCase() === 'mpesa';
    const provider = isMpesa ? PAYMENT_PROVIDER.MPESA : PAYMENT_PROVIDER.CASH;

    let normalizedPhone = null;
    if (isMpesa) {
      if (!phoneNumber) {
        // Try getting phone from member's User object if not explicitly provided
        const ChamaMembership = (await import('../../models/ChamaMembership.js')).default;
        const membership = await ChamaMembership.findById(memberId).populate('user_id', 'phone');
        normalizedPhone = membership?.user_id?.phone || null;
      } else {
        normalizedPhone = phoneNumber;
      }
      if (normalizedPhone) {
        const mpesaService = (await import('../../payment/providers/mpesa/mpesa.service.js')).default;
        normalizedPhone = mpesaService.normalizePhoneNumber(normalizedPhone);
      } else {
        throw new Error('Phone number is required for M-Pesa payments');
      }
    }

    const uniqueRef = reference || `MGR-${Date.now()}`;

    const initiateResult = await paymentService.initiate({
      amount: Number(amount),
      currency: policy.currency || 'KES',
      type: 'mgr',
      chamaId,
      obligationId: obligation._id,
      planId: currentRound.contribution_plan_id,
      participantId: memberId,
      participantType: 'ChamaMembership',
      phoneNumber: normalizedPhone,
      actorId: actorUserId,
      provider,
      reference: uniqueRef,
      displayReference: 'CHAMA-MGR',
      participant: {
        id: memberId,
        phoneNumber: normalizedPhone,
      },
      metadata: {
        productType: 'mgr',
        chamaId,
        obligationId: obligation._id,
        payment_method: paymentMethod,
        recordedBy: actorUserId,
      },
    });

    const updatedRound = await MgrRound.findById(currentRound._id);
    const updatedObligation = await ContributionObligation.findById(obligation._id);

    return {
      currentRound: updatedRound,
      obligation: updatedObligation,
      paymentIntentId: initiateResult?.paymentIntentId || null,
      checkoutRequestId: initiateResult?.checkoutRequestId || null,
      providerResponse: initiateResult?.providerResponse || null,
    };
  }

  /**
   * Called by financeEngine after it posts a "mgr" contribution payment for
   * a Chama running the governed MgrPolicy workflow. Syncs the active
   * round's collected total. Deliberately does NOT auto-create a payout -
   * under the governed workflow, payout always requires an explicit
   * Treasurer proposal (proposePayout) plus multi-role approval sign-off.
   */
  async syncRoundCollection({ chamaId, policyId, amount, actorUserId }) {
    const round = await MgrRound.findOne({
      chama_id: chamaId,
      policy_id: policyId,
      status: { $in: ['collecting', 'target_reached'] },
    });
    if (!round) return null;

    round.collected_amount = (Number(round.collected_amount) || 0) + Number(amount || 0);
    if (Number(round.collected_amount) >= Number(round.expected_amount)) {
      round.status = 'target_reached';
    }
    await round.save();

    if (actorUserId) {
      await MgrAuditLog.create({
        chama_id: chamaId,
        policy_id: policyId,
        round_id: round._id,
        actor_id: actorUserId,
        event_type: 'CONTRIBUTION_RECORDED',
        summary: `Contribution of ${amount} recorded for Round #${round.round_number}`,
      });
    }

    return round;
  }

  /**
   * Reorder payout positions
   */
  async reorderRotation({ chamaId, policyId, newOrderArray, userId }) {
    const policy = await MgrPolicy.findOne({ _id: policyId, chama_id: chamaId });
    if (!policy) throw new Error('Policy not found');

    policy.participants = newOrderArray;
    await policy.save();

    const upcomingRounds = await MgrRound.find({ chama_id: chamaId, policy_id: policyId, status: 'upcoming' });
    for (let i = 0; i < upcomingRounds.length; i++) {
      const idx = upcomingRounds[i].round_number - 1;
      if (newOrderArray[idx]) {
        upcomingRounds[i].recipient_id = newOrderArray[idx];
        await upcomingRounds[i].save();
      }
    }

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policyId,
      actor_id: userId,
      event_type: 'ROTATION_REORDERED',
      summary: 'Payout rotation order re-sequenced by official',
    });

    return policy;
  }

  /**
   * Get Chama-scoped contribution plans and per-member obligations.
   * Used by the Contributions page — works without a separate ContributionGroup.
   */
  async getChamaContributions(chamaId) {
    // Fetch all contribution plans owned by this Chama
    const plans = await ContributionPlan.find({
      $or: [
        { owner_type: 'Chama', owner_id: chamaId },
        { owner_type: 'CHAMA', owner_id: chamaId },
      ],
    }).sort({ createdAt: -1 });

    const activePlan = plans.find(p => p.status === 'active') || plans[0] || null;

    // Fetch all active Chama members with user details
    const chamaMemberships = await ChamaMembership.find({
      chama_id: chamaId,
      status: 'active',
    }).populate('user_id', 'name phone email');

    // Fetch obligations for the active plan if it exists
    let obligations = [];
    if (activePlan) {
      obligations = await ContributionObligation.find({
        $or: [
          { plan_id: activePlan._id },
          { contribution_plan_id: activePlan._id },
        ],
      }).populate({
        path: 'participant_id',
        populate: { path: 'user_id', select: 'name phone email' },
      });
    }

    // Build per-member view — cross-reference memberships with obligations
    const members = chamaMemberships.map((cm, idx) => {
      const userId = String(cm.user_id?._id || cm.user_id);
      const obligation = obligations.find(ob => {
        const participantMembId = String(ob.participant_id?._id || ob.participant_id || '');
        const participantUserId = String(ob.participant_id?.user_id?._id || ob.participant_id?.user_id || '');
        return participantMembId === String(cm._id) || participantUserId === userId;
      });

      return {
        _id: cm._id,
        user_id: cm.user_id,
        role: cm.role,
        expected: Number(obligation?.expected_amount || activePlan?.amount || 0),
        paid: Number(obligation?.paid_amount || 0),
        status: obligation?.status || 'pending',
        obligation_id: obligation?._id || null,
      };
    });

    return { plans, activePlan, members };
  }
}

export default new MgrService();