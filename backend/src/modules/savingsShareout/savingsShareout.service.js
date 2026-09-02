import mongoose from 'mongoose';

import SavingsShareout from '../../models/SavingsShareout.js';
import SavingsSharePolicy from '../../models/SavingsSharePolicy.js';
import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaLoan from '../../models/ChamaLoan.js';

import AppError from '../../utils/AppError.js';
import accountingService from '../finance/accounting/accounting.service.js';

import { OPEN_LOAN_STATUSES } from '../loans/Loan.constants.js';

import {
  toDecimal,
  multiplyMoney,
  divideMoney,
  subtractMoney,
  sumMoney,
  isMoneyPositive,
  isMoneyGreaterThan,
} from '../../shared/decimal.js';

// ============================================================
// SAVINGS SHAREOUT SERVICE
// ============================================================
//
// Orchestrates distributing member SAVINGS (a free_will
// contribution plan's balances) back to members — the
// year-end / agreed-time "share-out" — as distinct from an
// MGR payout (rotational pool) and a loan disbursement
// (borrowed money).
//
// DOES NOT:
// ✗ Create journals directly
// ✗ Resolve ledger accounts
// ✗ Decide the underlying rules — that's SavingsSharePolicy
//
// ============================================================

const OWNER_TYPE = 'Chama';
const DISBURSEMENT_METHODS = ['cash', 'bank', 'mpesa'];

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  const topologyType = topology?.description?.type;
  return topologyType === 'ReplicaSetWithPrimary' || topologyType === 'Sharded';
};

// ============================================================
// NET SAVINGS BALANCE FOR ONE MEMBER
// ============================================================
//
// = every completed deposit the member has made into this
//   specific savings plan
// - every share this member has already been PAID out of
//   savings previously (across any share-out batch, so a
//   member can't be paid the same balance twice)
//
// ============================================================

export const getMemberSavingsBalance = async (chamaId, contributionPlanId, membershipId) => {
  const deposits = await ContributionPayment.aggregate([
    {
      $match: {
        owner_type: 'Chama',
        owner_id: new mongoose.Types.ObjectId(chamaId),
        plan_id: new mongoose.Types.ObjectId(contributionPlanId),
        participant_type: 'ChamaMembership',
        participant_id: new mongoose.Types.ObjectId(membershipId),
        status: 'completed',
      },
    },
    { $group: { _id: null, total: { $sum: { $toDecimal: '$amount' } } } },
  ]);

  const alreadyShared = await SavingsShareout.aggregate([
    {
      $match: {
        chama_id: new mongoose.Types.ObjectId(chamaId),
        contribution_plan_id: new mongoose.Types.ObjectId(contributionPlanId),
      },
    },
    { $unwind: '$items' },
    {
      $match: {
        'items.member_id': new mongoose.Types.ObjectId(membershipId),
        'items.status': { $ne: 'cancelled' },
      },
    },
    { $group: { _id: null, total: { $sum: { $toDecimal: '$items.amount' } } } },
  ]);

  const totalDeposited = toDecimal(deposits[0]?.total ?? 0);
  const totalShared = toDecimal(alreadyShared[0]?.total ?? 0);

  return subtractMoney(totalDeposited, totalShared);
};

// ============================================================
// ELIGIBLE RECIPIENTS
// ============================================================

const getEligibleMemberships = async (chamaId, policy) => {
  const { recipients_rule } = policy;

  let memberships;

  if (recipients_rule.scope === 'specific_members' && recipients_rule.member_ids?.length) {
    memberships = await ChamaMembership.find({
      _id: { $in: recipients_rule.member_ids },
      chama_id: chamaId,
    });
  } else {
    memberships = await ChamaMembership.find({ chama_id: chamaId });
  }

  if (recipients_rule.require_active_membership) {
    memberships = memberships.filter((m) => m.status === 'active');
  }

  if (recipients_rule.exclude_members_with_overdue_loans) {
    const overdueLoans = await ChamaLoan.find({
      chama_id: chamaId,
      status: { $in: OPEN_LOAN_STATUSES },
    }).select('membership_id');

    const overdueMemberIds = new Set(overdueLoans.map((l) => String(l.membership_id)));
    memberships = memberships.filter((m) => !overdueMemberIds.has(String(m._id)));
  }

  return memberships;
};

// ============================================================
// BUILD ITEMS (shared by preview + createShareout)
// ============================================================

const buildItems = async (chamaId, policy) => {
  const memberships = await getEligibleMemberships(chamaId, policy);
  const items = [];

  for (const membership of memberships) {
    const balance = await getMemberSavingsBalance(chamaId, policy.contribution_plan_id, membership._id);

    if (!isMoneyPositive(balance)) continue;

    let amount;
    let sharePercentageApplied;

    if (policy.share_rule.basis === 'fixed_amount') {
      const fixed = toDecimal(policy.share_rule.fixed_amount_per_member);
      amount = isMoneyGreaterThan(fixed, balance) ? balance : fixed;
      sharePercentageApplied = Number(divideMoney(multiplyMoney(amount, 100), balance).toFixed(2));
    } else {
      const pct = Number(policy.share_rule.share_percentage) || 0;
      amount = divideMoney(multiplyMoney(balance, pct), 100);
      sharePercentageApplied = pct;
    }

    // Safety floor: never let a share-out push the member below the
    // configured minimum retained balance — this is the guardrail that
    // keeps the chama from running dry / unable to fund loans.
    const minRetained = toDecimal(policy.share_rule.min_retained_balance || 0);
    const maxReleasable = subtractMoney(balance, minRetained);

    if (!isMoneyPositive(maxReleasable)) continue;

    if (isMoneyGreaterThan(amount, maxReleasable)) {
      amount = maxReleasable;
    }

    if (!isMoneyPositive(amount)) continue;

    items.push({
      member_id: membership._id,
      savings_balance_snapshot: mongoose.Types.Decimal128.fromString(balance.toFixed()),
      share_percentage_applied: sharePercentageApplied,
      amount: mongoose.Types.Decimal128.fromString(amount.toFixed()),
      currency: policy.currency,
      status: 'pending',
    });
  }

  return items;
};

// ============================================================
// PREVIEW — dry run, nothing persisted
// ============================================================

export const previewShareout = async ({ chamaId, policyId }) => {
  const policy = await SavingsSharePolicy.findOne({ _id: policyId, chama_id: chamaId });

  if (!policy) {
    throw new AppError('Savings share policy not found', 404);
  }

  const items = await buildItems(chamaId, policy);
  const total = sumMoney(items.map((i) => i.amount.toString()));

  return {
    policy,
    items,
    total_amount: total.toFixed(2),
    recipient_count: items.length,
  };
};

// ============================================================
// CREATE SHAREOUT (manual trigger or scheduler)
// ============================================================

export const createShareout = async ({
  chamaId,
  policyId,
  created_by,
  triggerType = 'manual',
  periodLabel = '',
  asOfDate = null,
}) => {
  if (!created_by) {
    throw new AppError('Share-out creator is required', 400);
  }

  const policy = await SavingsSharePolicy.findOne({ _id: policyId, chama_id: chamaId, status: 'active' });

  if (!policy) {
    throw new AppError('No active savings share policy found', 404);
  }

  if (triggerType === 'manual' && policy.trigger_rule.mode === 'scheduled') {
    throw new AppError('This policy only allows scheduled share-outs', 400);
  }

  if (triggerType === 'scheduled' && policy.trigger_rule.mode === 'manual') {
    throw new AppError('This policy only allows manually triggered share-outs', 400);
  }

  const existingOpenBatch = await SavingsShareout.findOne({
    chama_id: chamaId,
    policy_id: policyId,
    status: { $in: ['pending_approval', 'approved'] },
  });

  if (existingOpenBatch) {
    return existingOpenBatch;
  }

  const items = await buildItems(chamaId, policy);

  if (!items.length) {
    throw new AppError('No eligible members with a releasable savings balance were found', 400);
  }

  const total = sumMoney(items.map((i) => i.amount.toString()));

  const shareout = await SavingsShareout.create({
    chama_id: chamaId,
    policy_id: policy._id,
    contribution_plan_id: policy.contribution_plan_id,
    period_label: periodLabel,
    trigger_type: triggerType,
    as_of_date: asOfDate || new Date(),
    total_amount: mongoose.Types.Decimal128.fromString(total.toFixed()),
    currency: policy.currency,
    status: 'pending_approval',
    items,
    created_by,
  });

  return shareout;
};

// ============================================================
// APPROVE SHAREOUT
// ============================================================
//
// Posts ONE aggregate obligation transaction for the whole
// batch, then opens individual items up for the treasurer to
// pay one at a time (their disbursement methods can differ).
//
// ============================================================

export const approveShareout = async ({ chamaId, shareoutId, approved_by, approverMembership }) => {
  if (!approved_by) {
    throw new AppError('Approving member is required', 400);
  }

  const session = await mongoose.startSession();
  const useTxn = canUseTransactions();

  try {
    if (useTxn) session.startTransaction();

    const shareout = await SavingsShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);

    if (!shareout) {
      throw new AppError('Savings share-out not found', 404);
    }

    if (shareout.status !== 'pending_approval') {
      throw new AppError(`Cannot approve a share-out with status ${shareout.status}`, 400);
    }

    const policy = await SavingsSharePolicy.findById(shareout.policy_id).session(session);

    if (approverMembership) {
      const eligibleRoles = policy?.approval_rule?.eligible_roles || [];
      if (eligibleRoles.length && !eligibleRoles.includes(approverMembership.role)) {
        throw new AppError('This member is not eligible to approve savings share-outs', 403);
      }
    }

    const result = await accountingService.post(
      {
        referenceType: 'SAVINGS_SHAREOUT_OBLIGATION',
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        amount: toDecimal(shareout.total_amount),
        currency: shareout.currency,
        source_type: 'SavingsShareout',
        source_id: shareout._id,
        description: `Savings share-out obligation created for ${shareout.items.length} member(s)`,
        created_by: approved_by,
        posted_by: approved_by,
        session,
      },
      session
    );

    shareout.obligation_transaction_id = result.transactionId;
    shareout.status = 'approved';
    shareout.approvals.push({ approved_by, approved_at: new Date() });
    await shareout.save({ session });

    if (useTxn) await session.commitTransaction();

    return shareout;
  } catch (error) {
    if (useTxn && session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// PAY ONE ITEM
// ============================================================

export const payShareoutItem = async ({
  chamaId,
  shareoutId,
  itemId,
  disbursement_method,
  external_reference = null,
  posted_by,
}) => {
  if (!DISBURSEMENT_METHODS.includes(disbursement_method)) {
    throw new AppError(`Invalid disbursement method. Supported methods: ${DISBURSEMENT_METHODS.join(', ')}`, 400);
  }

  const session = await mongoose.startSession();
  const useTxn = canUseTransactions();

  try {
    if (useTxn) session.startTransaction();

    const shareout = await SavingsShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);

    if (!shareout) {
      throw new AppError('Savings share-out not found', 404);
    }

    if (shareout.status !== 'approved') {
      throw new AppError('Share-out must be approved before items can be paid', 400);
    }

    const item = shareout.items.id(itemId);

    if (!item) {
      throw new AppError('Share-out item not found', 404);
    }

    if (item.status !== 'pending') {
      throw new AppError(`Item already ${item.status}`, 400);
    }

    const result = await accountingService.post(
      {
        referenceType: 'SAVINGS_SHAREOUT_SETTLEMENT',
        owner_type: OWNER_TYPE,
        owner_id: chamaId,
        amount: toDecimal(item.amount),
        currency: item.currency,
        source_type: 'SavingsShareout',
        source_id: shareout._id,
        disbursement_method,
        description: `Savings share-out settlement for member ${item.member_id}`,
        created_by: posted_by,
        posted_by,
        session,
      },
      session
    );

    item.status = 'paid';
    item.disbursement_method = disbursement_method;
    item.external_reference = external_reference;
    item.financial_transaction_id = result.transactionId;
    item.paid_at = new Date();

    const allSettled = shareout.items.every((i) => i.status !== 'pending');
    if (allSettled) {
      shareout.status = 'completed';
    }

    await shareout.save({ session });

    if (useTxn) await session.commitTransaction();

    return shareout;
  } catch (error) {
    if (useTxn && session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// CANCEL WHOLE SHAREOUT (only before any item is paid)
// ============================================================

export const cancelShareout = async ({ chamaId, shareoutId, cancelled_by }) => {
  const session = await mongoose.startSession();
  const useTxn = canUseTransactions();

  try {
    if (useTxn) session.startTransaction();

    const shareout = await SavingsShareout.findOne({ _id: shareoutId, chama_id: chamaId }).session(session);

    if (!shareout) {
      throw new AppError('Savings share-out not found', 404);
    }

    if (!['pending_approval', 'approved'].includes(shareout.status)) {
      throw new AppError(`Cannot cancel a share-out with status ${shareout.status}`, 400);
    }

    const anyPaid = shareout.items.some((i) => i.status === 'paid');
    if (anyPaid) {
      throw new AppError('Cannot cancel a share-out that already has paid items — cancel remaining pending items individually', 400);
    }

    if (shareout.status === 'approved' && shareout.obligation_transaction_id) {
      await accountingService.post(
        {
          referenceType: 'SAVINGS_SHAREOUT_CANCELLATION',
          owner_type: OWNER_TYPE,
          owner_id: chamaId,
          amount: toDecimal(shareout.total_amount),
          currency: shareout.currency,
          source_type: 'SavingsShareout',
          source_id: shareout._id,
          description: 'Savings share-out cancelled before disbursement',
          created_by: cancelled_by,
          posted_by: cancelled_by,
          session,
        },
        session
      );
    }

    shareout.items.forEach((item) => {
      if (item.status === 'pending') {
        item.status = 'cancelled';
        item.cancelled_at = new Date();
      }
    });

    shareout.status = 'cancelled';
    shareout.cancelled_at = new Date();
    await shareout.save({ session });

    if (useTxn) await session.commitTransaction();

    return shareout;
  } catch (error) {
    if (useTxn && session.inTransaction()) await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ============================================================
// LIST / GET
// ============================================================

export const listShareouts = async (chamaId, { status = null } = {}) => {
  const filter = { chama_id: chamaId };
  if (status) filter.status = status;
  return SavingsShareout.find(filter).sort({ createdAt: -1 });
};

export const getShareoutById = async (chamaId, shareoutId) => {
  const shareout = await SavingsShareout.findOne({ _id: shareoutId, chama_id: chamaId }).populate({
    path: 'items.member_id',
    select: 'role status user_id',
    populate: { path: 'user_id', select: 'name phone' },
  });

  if (!shareout) {
    throw new AppError('Savings share-out not found', 404);
  }

  return shareout;
};

export default {
  getMemberSavingsBalance,
  previewShareout,
  createShareout,
  approveShareout,
  payShareoutItem,
  cancelShareout,
  listShareouts,
  getShareoutById,
};