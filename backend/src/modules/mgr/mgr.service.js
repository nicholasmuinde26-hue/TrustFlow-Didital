import MgrPolicy from '../../models/MgrPolicy.js';
import MgrRound from '../../models/MgrRound.js';
import MgrAuditLog from '../../models/MgrAuditLog.js';
import MgrReminder from '../../models/MgrReminder.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionObligation from '../../models/ContributionObligation.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import Payout from '../../models/Payout.js';
import approvalService from '../approval/approval.service.js';
import mgrEligibilityService from './mgrEligibility.service.js';
import mgrReconciliationService from './mgrReconciliation.service.js';
import paymentService from '../../payment/payment.service.js';
import { PAYMENT_PROVIDER } from '../../payment/payment.constants.js';
import accountingService from '../finance/accounting/accounting.service.js';
import { toDecimal } from '../../shared/decimal.js';
import { creditMemberWallet } from '../finance/memberWallet.service.js';
import mongoose from 'mongoose';

const OWNER_TYPE = 'Chama';
const DISBURSEMENT_METHODS = ['cash', 'bank', 'mpesa', 'wallet'];

// Same replica-set guard used by payout.service.js / financeEngine.service.js -
// a standalone Mongo (local dev) throws on startTransaction().
const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  return topology?.description?.type === 'ReplicaSetWithPrimary' || topology?.description?.type === 'Sharded';
};

function addFrequency(date, frequency, count = 1) {
  const result = new Date(date);
  if (frequency === 'daily') result.setDate(result.getDate() + count);
  else if (frequency === 'weekly') result.setDate(result.getDate() + 7 * count);
  else if (frequency === 'biweekly') result.setDate(result.getDate() + 14 * count);
  else {
    const day = result.getDate();
    const monthOffset = (frequency === 'quarterly' ? 3 : 1) * count;
    result.setDate(1);
    result.setMonth(result.getMonth() + monthOffset);
    const finalDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, finalDay));
  }
  return result;
}

function memberContributionAmount(policy, memberId) {
  const rule = policy.contribution_rule || {};
  if (rule.type === 'custom_member' || rule.type === 'tiered') {
    const row = (rule.member_amounts || []).find((item) => String(item.member_id?._id || item.member_id) === String(memberId));
    if (row?.amount != null) return Number(row.amount.toString?.() ?? row.amount);
  }
  return Number(rule.uniform_amount?.toString?.() ?? rule.uniform_amount ?? 5000);
}

class MgrService {
  /**
   * Create a new MGR Policy draft
   */
  async createPolicy({ chamaId, userId, policyData }) {
    if (!Array.isArray(policyData.participants) || policyData.participants.length < 2) {
      throw new Error('Select at least two participants to create an MGR rotation.');
    }
    const rule = policyData.contribution_rule || {};
    if (rule.type === 'custom_member') {
      for (const memberId of policyData.participants) {
        const amount = (rule.member_amounts || []).find((entry) => String(entry.member_id?._id || entry.member_id) === String(memberId))?.amount;
        if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) throw new Error('Enter a positive contribution amount for every selected participant.');
      }
    } else if (!Number.isFinite(Number(rule.uniform_amount ?? policyData.uniform_amount ?? 5000)) || Number(rule.uniform_amount ?? policyData.uniform_amount ?? 5000) <= 0) {
      throw new Error('Contribution amount must be greater than zero.');
    }
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

    // Snapshot the participant list BEFORE it gets overwritten below, so
    // that once an active policy has already generated its rounds/
    // obligations, a treasurer adding someone through "Edit Policy" doesn't
    // just silently update the roster - previously `participants` was
    // overwritten with no diffing against the old list, so a newly added
    // member never got a rotation round or an obligation for the round
    // currently collecting; they'd show up in the participant list but
    // never actually owe or receive anything.
    const previousParticipantIds = new Set(
      (policy.participants || []).map((p) => String(p._id || p))
    );

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

    // Onboard any newly added participant into an already-active MGR: give
    // them their own upcoming rotation round, and pull them into the
    // currently collecting round's obligations so they're expected to
    // contribute (and counted in) right away rather than only from the
    // next round the policy happens to regenerate.
    if (policy.status === 'active' && Array.isArray(policyData.participants)) {
      const newParticipantIds = policyData.participants.map((p) => String(p._id || p));
      const addedParticipantIds = newParticipantIds.filter((id) => !previousParticipantIds.has(id));

      if (addedParticipantIds.length > 0) {
        await this._onboardNewMgrParticipants({ chamaId, policy, addedParticipantIds, userId });
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
   * Give each newly-added participant a rotation turn and an obligation in
   * the round currently collecting, and grow that round's expected total to
   * match the larger pool. Best-effort per new member so one bad id doesn't
   * block the whole policy save that already happened above.
   */
  async _onboardNewMgrParticipants({ chamaId, policy, addedParticipantIds, userId }) {
    const rounds = await MgrRound.find({ chama_id: chamaId, policy_id: policy._id }).sort({ round_number: -1 });
    const latestRound = rounds[0];
    if (!latestRound) return; // policy has no rounds yet - nothing to attach to

    const contributionPlanId = latestRound.contribution_plan_id;
    const amountVal = policy.contribution_rule?.uniform_amount;
    const perMemberAmount = amountVal != null ? Number(amountVal.toString ? amountVal.toString() : amountVal) : 0;

    const currentRound = rounds.find((r) =>
      ['collecting', 'target_reached', 'eligibility_checking', 'payout_proposed', 'pending_approval', 'approved', 'disbursing', 'on_hold'].includes(r.status)
    );

    let nextRoundNumber = latestRound.round_number + 1;

    for (const participantId of addedParticipantIds) {
      try {
        // 1. Give them a future turn in the rotation.
        const dueDate = new Date(latestRound.due_date || policy.start_date);
        if (policy.frequency === 'monthly') dueDate.setMonth(dueDate.getMonth() + 1);
        else if (policy.frequency === 'weekly') dueDate.setDate(dueDate.getDate() + 7);
        else if (policy.frequency === 'biweekly') dueDate.setDate(dueDate.getDate() + 14);
        else if (policy.frequency === 'daily') dueDate.setDate(dueDate.getDate() + 1);
        else if (policy.frequency === 'quarterly') dueDate.setMonth(dueDate.getMonth() + 3);
        else dueDate.setMonth(dueDate.getMonth() + 1);

        await MgrRound.create({
          chama_id: chamaId,
          policy_id: policy._id,
          round_number: nextRoundNumber,
          recipient_id: participantId,
          due_date: dueDate,
          expected_amount: perMemberAmount * policy.participants.length,
          collected_amount: 0,
          status: 'upcoming',
          contribution_plan_id: contributionPlanId,
        });
        nextRoundNumber += 1;

        // 2. Pull them into whatever round is currently collecting so they
        // owe a contribution immediately, same as everyone else already in it.
        if (currentRound && contributionPlanId) {
          const alreadyHasObligation = await ContributionObligation.exists({
            mgr_round_id: currentRound._id,
            participant_id: participantId,
          });

          if (!alreadyHasObligation) {
            await ContributionObligation.create({
              plan_id: contributionPlanId,
              mgr_round_id: currentRound._id,
              owner_type: 'Chama',
              owner_id: chamaId,
              participant_type: 'ChamaMembership',
              participant_id: participantId,
              expected_amount: perMemberAmount,
              currency: policy.currency,
              due_date: currentRound.due_date,
              status: 'pending',
            });

            currentRound.expected_amount = Number(currentRound.expected_amount) + perMemberAmount;
          }
        }
      } catch (err) {
        console.error('[mgr] Failed to onboard new MGR participant', String(participantId), err);
      }
    }

    if (currentRound) {
      await currentRound.save();
    }

    await MgrAuditLog.create({
      chama_id: chamaId,
      policy_id: policy._id,
      actor_id: userId,
      event_type: 'POLICY_UPDATED',
      summary: `${addedParticipantIds.length} new member(s) added to MGR - given a rotation slot and included in the current round's contributions`,
    });
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

    // Record an actual MgrReminder per outstanding obligation so the
    // dashboard's "Last Reminded" column reflects a real timestamp instead
    // of always showing "-". (MgrReminder already existed for the legacy
    // chamaFinance MGR path but was never written to from here.)
    if (unpaidCount > 0) {
      const message = `Reminder: your MGR contribution for Round #${round.round_number} is due.`;
      await MgrReminder.insertMany(
        obligations.map((o) => ({
          chama_id: round.chama_id,
          obligation_id: o._id,
          participant_id: o.participant_id?._id || o.participant_id,
          channel: 'sms',
          created_by: actorUserId,
          message,
        })),
        { ordered: false }
      ).catch((err) => {
        console.error('[mgr] Failed to record reminders for round', String(round._id), err);
      });
    }

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

    // Everything below this point can throw (validation, a duplicate key,
    // a transient DB error). Without a transaction, a failure here used to
    // leave the policy permanently stuck "active" with zero rounds/plan/
    // obligations ever created - members could see the MGR as active but
    // could never actually pay into it (see the self-heal in
    // getDashboardOverview above, which recovers chamas already stuck this
    // way). Revert the policy back to draft on any failure here so a retry
    // is possible instead of a silent half-activated state.
    try {
      return await this._createRoundsForActivation({ chamaId, policy, userId });
    } catch (err) {
      policy.status = 'draft';
      await policy.save().catch(() => {});
      throw err;
    }
  }

  async _createRoundsForActivation({ chamaId, policy, userId }) {
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
      const dueDate = addFrequency(startDate, policy.frequency, i);
      const roundEnd = addFrequency(dueDate, policy.frequency, 1);
      roundEnd.setMilliseconds(roundEnd.getMilliseconds() - 1);

      const expectedAmount = policy.participants.reduce((sum, memberId) => sum + memberContributionAmount(policy, memberId), 0);

      const round = await MgrRound.create({
        chama_id: chamaId,
        policy_id: policy._id,
        round_number: i + 1,
        recipient_id: recipientId,
        due_date: dueDate,
        round_start: dueDate,
        round_end: roundEnd,
        expected_amount: expectedAmount,
        collected_amount: 0,
        status: i === 0 && dueDate <= new Date() ? 'collecting' : 'upcoming',
        contribution_plan_id: plan._id,
      });

      rounds.push(round);

      // Create obligations for Round 1
      if (i === 0 && dueDate <= new Date()) {
        for (const partId of policy.participants) {
          await ContributionObligation.create({
            plan_id: plan._id,
            mgr_round_id: round._id,
            owner_type: 'Chama',
            owner_id: chamaId,
            participant_type: 'ChamaMembership',
            participant_id: partId,
            expected_amount: memberContributionAmount(policy, partId),
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
    let policy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'active' }).populate({
      path: 'participants',
      populate: { path: 'user_id', select: 'name email phone' },
    });

    if (!policy) {
      policy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'draft' }).sort({ createdAt: -1 }).populate({
        path: 'participants',
        populate: { path: 'user_id', select: 'name email phone' },
      });

      if (!policy) policy = await MgrPolicy.findOne({ chama_id: chamaId, status: 'completed' }).sort({ createdAt: -1 }).populate({
        path: 'participants', populate: { path: 'user_id', select: 'name email phone' },
      });
      if (!policy) return { hasPolicy: false, policy: null, rounds: [], currentRound: null, obligations: [], auditLogs: [] };
      if (policy.status !== 'completed') return { hasPolicy: true, policy, rounds: [], currentRound: null, obligations: [], auditLogs: [] };
    }

    let rounds = await MgrRound.find({ chama_id: chamaId, policy_id: policy._id })
      .populate({
        path: 'recipient_id',
        populate: { path: 'user_id', select: 'name email phone' },
      })
      .populate('approval_request_id')
      .sort({ round_number: 1 });

    // Self-heal: activatePolicy() flips policy.status to 'active' and saves
    // it BEFORE creating the ContributionPlan/MgrRounds/obligations (see
    // activatePolicy above), with no transaction and no rollback on
    // failure. If that later part ever throws partway through, the policy
    // is left permanently "active" with zero rounds - and every dashboard
    // load since has been unable to attach real obligations to anything
    // (there's no round to attach them to), which is why members could
    // never actually pay into this MGR. Bootstrap round 1 here exactly as
    // activatePolicy would have, so a chama stuck in this state recovers
    // on the next dashboard load instead of staying stuck forever.
    if (rounds.length === 0 && Array.isArray(policy.participants) && policy.participants.length > 0) {
      const amountVal = policy.contribution_rule?.uniform_amount || 5000;
      const rawAmount = amountVal?.toString ? Number(amountVal.toString()) : Number(amountVal);

      const plan = await ContributionPlan.create({
        owner_type: 'Chama',
        owner_id: chamaId,
        participant_type: 'ChamaMembership',
        created_by: policy.created_by,
        name: `MGR Plan - ${policy.name}`,
        description: `Contribution plan for MGR Policy v${policy.version}`,
        currency: policy.currency,
        contribution_type: 'merry_go_round',
        frequency: policy.frequency,
        amount: rawAmount,
        start_date: policy.start_date,
        status: 'active',
        merry_go_round: { enabled: true, payout_interval: policy.frequency },
      });

      const dueDate = new Date(policy.start_date);
      const recipientId = policy.participants[0];

      const round1 = await MgrRound.create({
        chama_id: chamaId,
        policy_id: policy._id,
        round_number: 1,
        recipient_id: recipientId,
        due_date: dueDate,
        round_start: dueDate,
        round_end: (() => { const end = addFrequency(dueDate, policy.frequency, 1); end.setMilliseconds(end.getMilliseconds() - 1); return end; })(),
        expected_amount: policy.participants.reduce((sum, part) => sum + memberContributionAmount(policy, part._id || part), 0),
        collected_amount: 0,
        status: dueDate <= new Date() ? 'collecting' : 'upcoming',
        contribution_plan_id: plan._id,
      });

      if (dueDate <= new Date()) await ContributionObligation.insertMany(
        policy.participants.map((part) => ({
          plan_id: plan._id,
          owner_type: 'Chama',
          owner_id: chamaId,
          participant_type: 'ChamaMembership',
          participant_id: part._id || part,
          expected_amount: memberContributionAmount(policy, part._id || part),
          currency: policy.currency,
          due_date: dueDate,
          status: 'pending',
        })),
        { ordered: false }
      );

      await MgrAuditLog.create({
        chama_id: chamaId,
        policy_id: policy._id,
        actor_id: policy.created_by,
        event_type: 'POLICY_ACTIVATED',
        summary: `MGR Policy v${policy.version} round 1 auto-recovered (was active with no rounds)`,
        details: { roundId: round1._id, planId: plan._id },
      });

      rounds = await MgrRound.find({ chama_id: chamaId, policy_id: policy._id })
        .populate({
          path: 'recipient_id',
          populate: { path: 'user_id', select: 'name email phone' },
        })
        .populate('approval_request_id')
        .sort({ round_number: 1 });
    }

    const currentRound = rounds.find((r) => ['awaiting_confirmation', 'collecting', 'target_reached', 'eligibility_checking', 'payout_proposed', 'pending_approval', 'approved', 'disbursing', 'awaiting_receipt', 'on_hold'].includes(r.status)) || rounds.find((r) => r.status === 'upcoming') || rounds[rounds.length - 1];

    let obligations = [];
    if (currentRound && currentRound.contribution_plan_id) {
      obligations = await ContributionObligation.find({
        $or: [
          { mgr_round_id: currentRound._id },
          { plan_id: currentRound.contribution_plan_id, mgr_round_id: null },
        ],
      })
        .populate({
          path: 'participant_id',
          populate: { path: 'user_id', select: 'name email phone' },
        });
    }

    // Fallback: If no obligations exist yet for this round (e.g. a round
    // just became "collecting" without its obligations having been
    // generated), CREATE real ContributionObligation documents rather than
    // handing back throwaway plain objects.
    //
    // Previously this returned in-memory stubs with `_id: part._id` (the
    // participant/member id). The frontend renders those exactly like real
    // obligations and lets the member pay against them, POSTing that fake
    // id as `obligationId` to /contributions. Since no ContributionObligation
    // with that _id actually exists, requireChamaMember's obligationId
    // lookup (chama.middleware.js) always came back empty, and every MGR
    // payment failed with "Invalid Chama ID" - the round could never
    // actually be paid into.
    if (obligations.length === 0 && currentRound && ['collecting', 'target_reached'].includes(currentRound.status) && currentRound.contribution_plan_id && Array.isArray(policy.participants) && policy.participants.length > 0) {
      // policy.contribution_rule.uniform_amount is a Decimal128 on the live
      // Mongoose document (not the toJSON-transformed string). Number() on
      // a BSON Decimal128 relies on its toString() via implicit coercion,
      // which works, but go through the explicit .toString() so this can't
      // silently become NaN/0 if the underlying BSON type ever changes.
      const dueDate = currentRound.due_date || new Date();

      try {
        await ContributionObligation.insertMany(
          policy.participants.map((part) => ({
            plan_id: currentRound.contribution_plan_id,
            mgr_round_id: currentRound._id,
            owner_type: 'Chama',
            owner_id: chamaId,
            participant_type: 'ChamaMembership',
            participant_id: part._id || part,
            expected_amount: memberContributionAmount(policy, part._id || part),
            currency: policy.currency,
            due_date: dueDate,
            status: 'pending',
          })),
          // ordered:false so a duplicate from a concurrent request (two tabs
          // loading the overview at once) doesn't abort the whole batch -
          // the unique index on (plan_id, participant_type, participant_id,
          // period_start, period_end) only kicks in when periods are set,
          // which MGR obligations don't use, but this stays safe either way.
          { ordered: false }
        );
      } catch (err) {
        // Don't let a validation/duplicate error here take down the whole
        // overview request - but DO log it. Silently swallowing this was
        // exactly how the original bug (fake, unpayable obligations) stayed
        // invisible: insertMany failing silently left `obligations` empty,
        // and the frontend's own synthetic-obligation fallback quietly took
        // over, reproducing the same "Invalid Chama ID" payment failure.
        console.error('[mgr] Failed to auto-generate ContributionObligations for round', String(currentRound._id), err);
      }

      obligations = await ContributionObligation.find({
        $or: [
          { mgr_round_id: currentRound._id },
          { plan_id: currentRound.contribution_plan_id, mgr_round_id: null },
        ],
      })
        .populate({
          path: 'participant_id',
          populate: { path: 'user_id', select: 'name email phone' },
        });
    }

    // Self-heal: syncRoundCollection (called from the payment-completion
    // paths) is the only thing that increments MgrRound.collected_amount,
    // and a prior bug meant some payments never reached it - the money was
    // correctly recorded on the obligation/ledger, but the round's
    // collected total silently stayed stuck below the real amount. Recompute
    // it here from the actual completed ContributionPayments for this
    // round's plan (the source of truth) and persist the correction, so a
    // round that's already out of sync repairs itself on the next dashboard
    // load instead of staying stuck forever.
    if (currentRound && currentRound.contribution_plan_id) {
      const obligationIds = obligations.map((o) => o._id);
      const paidAgg = await ContributionPayment.aggregate([
        {
          $match: {
            status: 'completed',
            obligation_id: { $in: obligationIds },
          },
        },
        { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
      ]);
      const actualCollected = paidAgg[0]?.total || 0;
      if (Math.round(actualCollected * 100) !== Math.round(Number(currentRound.collected_amount) * 100)) {
        currentRound.collected_amount = actualCollected;
        if (actualCollected >= Number(currentRound.expected_amount) && currentRound.status === 'collecting') {
          currentRound.status = 'target_reached';
        }
        await currentRound.save();
      }
    }

    const auditLogs = await MgrAuditLog.find({ chama_id: chamaId })
      .populate('actor_id', 'name email')
      .sort({ createdAt: -1 })
      .limit(20);

    // Attach each obligation's most recent reminder timestamp (if any), so
    // the dashboard's "Last Reminded" column reflects real data instead of
    // always showing "-". Serialize through each obligation's own toJSON()
    // first (it converts Decimal128 amount fields to plain strings) so the
    // extra last_reminded_at field survives on a plain object rather than
    // being dropped as an undeclared schema path on the Mongoose document.
    let obligationsWithReminders = obligations;
    if (obligations.length > 0) {
      const reminderRows = await MgrReminder.aggregate([
        { $match: { obligation_id: { $in: obligations.map((o) => o._id) } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$obligation_id', last_reminded_at: { $first: '$createdAt' } } },
      ]);
      const lastRemindedMap = new Map(reminderRows.map((r) => [String(r._id), r.last_reminded_at]));
      obligationsWithReminders = obligations.map((o) => {
        const json = typeof o.toJSON === 'function' ? o.toJSON() : o;
        json.last_reminded_at = lastRemindedMap.get(String(o._id)) || null;
        return json;
      });
    }

    return {
      hasPolicy: true,
      policy,
      rounds,
      currentRound,
      obligations: obligationsWithReminders,
      auditLogs,
    };
  }

  /**
   * Propose Payout (Treasurer action)
   */
  async proposePayout({ roundId, treasurerUserId, amount, disbursementMethod = 'mpesa', phoneNumber, notes = '' }) {
    const round = await MgrRound.findById(roundId).populate('policy_id');
    if (!round) throw new Error('Round not found');
    if (!['collecting', 'target_reached'].includes(round.status)) throw new Error('Payout can only be proposed for a round currently collecting contributions.');

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

    const payoutAmount = Number(amount || collected);
    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0 || payoutAmount > collected) {
      throw new Error('Payout amount must be greater than zero and no more than the amount collected.');
    }
    if (disbursementMethod === 'mpesa' && !phoneNumber) throw new Error('Recipient phone number is required for M-Pesa payout.');

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
  async disbursePayout({ roundId, actorUserId, externalReference }) {
    const round = await MgrRound.findById(roundId).populate('approval_request_id').populate('policy_id');
    if (!round) throw new Error('Round not found');

    if (!round.approval_request_id || round.approval_request_id.status !== 'approved') {
      throw new Error('Payout cannot be disbursed until all required approvals are completed.');
    }
    if (!['pending_approval', 'approved'].includes(round.status)) throw new Error('This payout has already been disbursed or is not ready for disbursement.');

    round.status = 'approved';
    await round.save();

    round.status = 'disbursing';
    await round.save();

    const disbursementMethod = round.payout_proposal?.disbursement_method || 'mpesa';
    if (['mpesa', 'bank'].includes(disbursementMethod) && !String(externalReference || '').trim()) {
      round.status = 'pending_approval';
      await round.save();
      throw new Error(`Enter the ${disbursementMethod === 'mpesa' ? 'M-Pesa receipt' : 'bank transfer'} reference to record the disbursement.`);
    }

    if (!DISBURSEMENT_METHODS.includes(disbursementMethod)) {
      throw new Error(
        `Invalid disbursement method. Supported methods: ${DISBURSEMENT_METHODS.join(', ')}`
      );
    }

    const amount = toDecimal(round.payout_amount || round.collected_amount);
    const currency = round.policy_id?.currency || 'KES';

    // Payout creation + the accounting settlement post are wrapped in one
    // session so a failed post (missing account, unbalanced entry, etc.)
    // can't leave a Payout sitting at status "paid" with no backing ledger
    // entry - same failure mode payout.service.js's markPayoutPaid guards
    // against.
    const session = canUseTransactions() ? await mongoose.startSession() : null;
    let payout;

    try {
      if (session) session.startTransaction();

      // Create formal Payout record
      [payout] = await Payout.create(
        [
          {
            chama_id: round.chama_id,
            contribution_plan_id: round.contribution_plan_id,
            round_start: round.due_date,
            member_id: round.recipient_id,
            payout_position: round.round_number,
            amount: amount.toFixed(),
            currency,
            status: 'paid',
            disbursement_method: disbursementMethod,
            external_reference: String(externalReference || (disbursementMethod === 'wallet' ? `WALLET-${round.round_number}` : `CASH-${Date.now()}`)).trim(),
            paid_at: new Date(),
          },
        ],
        session ? { session } : {}
      );

      // Post the settlement leg onto the same accounted path payout.service.js
      // uses (accountingService -> payout.rule.js). MGR contributions already
      // credited PAYOUT_CLEARING as each member paid in (MgrContributionRule:
      // DR Cash/Bank/Mpesa, CR PAYOUT_CLEARING) - that's this round's payout
      // obligation, already booked on collection. Disbursing here only needs
      // the settlement entry (DR PAYOUT_CLEARING, CR Cash/Bank/Mpesa); posting
      // a PAYOUT_OBLIGATION on top would double the liability.
      const posting = await accountingService.post(
        {
          referenceType: 'PAYOUT_SETTLEMENT',
          owner_type: OWNER_TYPE,
          owner_id: round.chama_id,
          amount,
          currency,
          source_type: 'Payout',
          source_id: payout._id,
          disbursement_method: disbursementMethod === 'wallet' ? 'mpesa' : disbursementMethod,
          description: `MGR payout settled via ${disbursementMethod} for Round #${round.round_number}`,
          created_by: actorUserId,
          posted_by: actorUserId,
          session,
        },
        session
      );

      payout.financial_transaction_id = posting.transactionId;
      await payout.save(session ? { session } : {});

        if (disbursementMethod === 'wallet') {
          const recipient = await ChamaMembership.findById(round.recipient_id).select('user_id').session(session || null).lean();
          await creditMemberWallet({ userId: recipient?.user_id, amount, sourceType: 'Payout', sourceId: payout._id, createdBy: actorUserId, externalReference: `MGR-${round.round_number}`, session });
        }

      if (session) await session.commitTransaction();
    } catch (error) {
      if (session) await session.abortTransaction();
      round.status = 'approved';
      await round.save().catch(() => {});
      throw error;
    } finally {
      if (session) await session.endSession();
    }

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

    round.status = 'awaiting_receipt';
    await round.save();

    // Open next round if available
    const nextRound = await MgrRound.findOne({
      chama_id: round.chama_id,
      policy_id: round.policy_id._id,
      round_number: round.round_number + 1,
    });

    return { round, payout, nextRound };
  }

  async markPayoutReceived({ roundId, recipientMembershipId, actorUserId }) {
    const round = await MgrRound.findById(roundId).populate('policy_id');
    if (!round) throw new Error('Round not found');
    if (String(round.recipient_id) !== String(recipientMembershipId)) throw new Error('Only the payout recipient can confirm receipt.');
    if (round.status !== 'awaiting_receipt') throw new Error('This payout is not yet ready for receipt confirmation.');

    round.status = 'received';
    round.payout_received_at = new Date();
    round.payout_received_by = recipientMembershipId;
    await round.save();

    const nextRound = await MgrRound.findOne({
      chama_id: round.chama_id, policy_id: round.policy_id._id, round_number: round.round_number + 1,
    });
    if (!nextRound) {
      const policy = await MgrPolicy.findById(round.policy_id._id);
      if (policy) { policy.status = 'completed'; await policy.save(); }
      await MgrAuditLog.create({
        chama_id: round.chama_id, policy_id: round.policy_id._id, round_id: round._id,
        actor_id: actorUserId, event_type: 'CYCLE_COMPLETED',
        summary: `All ${round.round_number} rounds completed and the final payout was acknowledged`,
      });
    }
    await MgrAuditLog.create({
      chama_id: round.chama_id, policy_id: round.policy_id._id, round_id: round._id,
      actor_id: actorUserId, event_type: 'PAYOUT_RECEIVED',
      summary: `Round #${round.round_number} payout receipt confirmed by recipient`,
      details: { amount: round.payout_amount, payoutId: round.payout_id },
    });
    return { round, nextRound };
  }

  async advanceDueRounds(now = new Date()) {
    const endedRounds = await MgrRound.find({
      status: { $nin: ['upcoming', 'paid', 'reconciled', 'completed'] },
      round_end: { $ne: null, $lte: now },
      interval_ended_at: null,
    }).populate('policy_id', 'created_by');
    for (const round of endedRounds) {
      const ended = await MgrRound.findOneAndUpdate(
        { _id: round._id, interval_ended_at: null },
        { $set: { interval_ended_at: now } },
        { new: true }
      );
      if (!ended) continue;
      await MgrAuditLog.create({
        chama_id: round.chama_id, policy_id: round.policy_id, round_id: round._id,
        actor_id: round.policy_id?.created_by,
        event_type: 'ROUND_INTERVAL_ENDED',
        summary: `Round #${round.round_number} interval ended with ${Math.max(0, Number(round.expected_amount) - Number(round.collected_amount))} still outstanding`,
      });
    }
    const dueRounds = await MgrRound.find({ status: 'upcoming', due_date: { $lte: now } }).populate('policy_id');
    let promoted = 0;
    for (const round of dueRounds) {
      if (round.round_number > 1) {
        const previous = await MgrRound.findOne({ policy_id: round.policy_id?._id || round.policy_id, round_number: round.round_number - 1 }).select('status');
        if (!previous || !['received', 'reconciled', 'completed'].includes(previous.status)) continue;
      }
      const claimed = await MgrRound.findOneAndUpdate(
        { _id: round._id, status: 'upcoming', due_date: { $lte: now } },
        { $set: { status: 'awaiting_confirmation' } },
        { new: true }
      );
      if (!claimed) continue;
      promoted += 1;
      await MgrAuditLog.create({
        chama_id: round.chama_id,
        policy_id: round.policy_id?._id || round.policy_id,
        round_id: round._id,
        actor_id: round.policy_id?.created_by,
        event_type: 'ROUND_READY_FOR_CONFIRMATION',
        summary: `Round #${round.round_number} interval started; payout recipient confirmation is required`,
      });
    }
    return { ended: endedRounds.length, awaitingConfirmation: promoted };
  }

  async confirmRoundPosition({ roundId, recipientId, actorUserId }) {
    const round = await MgrRound.findById(roundId).populate('policy_id');
    if (!round) throw new Error('Round not found');
    if (round.status !== 'awaiting_confirmation') throw new Error('This round is not awaiting position confirmation');
    const policy = round.policy_id;
    const selectedRecipient = recipientId || round.recipient_id;
    if (!policy.participants.some((id) => String(id) === String(selectedRecipient))) {
      throw new Error('The payout recipient must be an active participant in this MGR policy');
    }

    round.recipient_id = selectedRecipient;
    round.status = 'collecting';
    await round.save();

    const amount = policy.contribution_rule?.uniform_amount || 5000;
    for (const participantId of policy.participants) {
      const exists = await ContributionObligation.exists({ plan_id: round.contribution_plan_id, participant_id: participantId });
      if (!exists) await ContributionObligation.create({
        mgr_round_id: round._id,
        plan_id: round.contribution_plan_id,
        owner_type: 'Chama', owner_id: round.chama_id,
        participant_type: 'ChamaMembership', participant_id: participantId,
        expected_amount: memberContributionAmount(policy, participantId), currency: policy.currency, due_date: round.due_date, status: 'pending',
      });
    }
    await MgrAuditLog.create({
      chama_id: round.chama_id, policy_id: policy._id, round_id: round._id, actor_id: actorUserId,
      event_type: 'ROUND_POSITION_CONFIRMED',
      summary: `Round #${round.round_number} opened after confirming payout position`,
      details: { recipientId: selectedRecipient },
    });
    return round;
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
      mgr_round_id: currentRound._id,
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
  async syncRoundCollection({ chamaId, policyId, roundId, obligationId, amount, actorUserId }) {
    if (!roundId && obligationId) {
      const obligation = await ContributionObligation.findById(obligationId).select('mgr_round_id');
      roundId = obligation?.mgr_round_id;
    }
    const round = await MgrRound.findOne(roundId ? {
      _id: roundId, chama_id: chamaId, policy_id: policyId,
    } : {
      chama_id: chamaId,
      policy_id: policyId,
      status: { $in: ['collecting', 'target_reached'] },
    });
    if (!round) return null;

    const obligationIds = await ContributionObligation.find({ mgr_round_id: round._id }).distinct('_id');
    const totals = obligationIds.length ? await ContributionPayment.aggregate([
      { $match: { status: 'completed', obligation_id: { $in: obligationIds } } },
      { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } },
    ]) : [];
    round.collected_amount = totals[0]?.total ?? ((Number(round.collected_amount) || 0) + Number(amount || 0));
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
        event_type: 'CONTRIBUTION_RECEIVED',
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
