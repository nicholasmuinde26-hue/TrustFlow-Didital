import mongoose from 'mongoose';

import ContributionPlan from '../../models/ContributionPlan.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import SavingsShareout from '../../models/SavingsShareout.js';
import ChamaMembership from '../../models/ChamaMembership.js';

import { toDecimal } from '../../shared/decimal.js';

// ============================================================
// SAVINGS OVERVIEW SERVICE
// ============================================================
//
// A read-only aggregation layer that answers "where does the
// chama's savings pool actually stand right now" — per-member
// balances, top savers, and a trailing growth trend — computed
// live off ContributionPayment (deposits) and SavingsShareout
// (money already released back to members).
//
// "Savings" here means every free-will contribution plan owned
// by this chama — the same definition savingsSharePolicy.service
// enforces when attaching a share-out policy to a plan. A chama
// can run more than one free-will plan; this overview folds all
// of them into one pool.
//
// DOES NOT:
// ✗ Mutate any data — pure aggregation/read
// ✗ Decide share-out eligibility — that's savingsShareout.service
//
// ============================================================

const GROWTH_MONTHS = 12;
const RECENT_WINDOW_DAYS = 30;

// Decimal is globally configured (shared/decimal.js) to round half-up,
// so a plain toFixed(2) here already gives us correct money rounding.
const round2 = (value) => Number(toDecimal(value).toFixed(2));

const monthKeyOf = (year, month) => `${year}-${month}`;

const monthLabelOf = (year, month) => {
  // month is 1-indexed here (matches Mongo's $month)
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
    month: 'short',
    year: '2-digit',
  });
};

// Builds the trailing N calendar months ending with the current month,
// oldest first, as { key, label, year, month }.
const buildTrailingMonths = (count) => {
  const now = new Date();
  const months = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-indexed to match $month
    months.push({ key: monthKeyOf(year, month), label: monthLabelOf(year, month), year, month });
  }

  return months;
};

// ============================================================
// SAVINGS PLANS FOR THIS CHAMA
// ============================================================
//
// A "savings" plan = a free-will contribution plan owned by
// this chama that hasn't been cancelled — mirrors the rule in
// savingsSharePolicy.service's assertFreeWillPlan.
//
// ============================================================

const getSavingsPlanIds = async (chamaId) => {
  const plans = await ContributionPlan.find({
    owner_type: 'Chama',
    owner_id: chamaId,
    contribution_type: 'free_will',
    status: { $ne: 'cancelled' },
  }).select('_id');

  return plans.map((p) => p._id);
};

// ============================================================
// EMPTY / DEFAULT SHAPE
// ============================================================
//
// Returned as soon as the chama has memberships but no savings
// plan configured yet — keeps the frontend's shape guarantees
// (totals/growth/members always present) without a special case
// in the controller.
//
// ============================================================

const emptyOverview = (memberships) => ({
  totals: {
    total_savings: 0,
    deposits_30d: 0,
    shared_out_total: 0,
    active_savers: 0,
    deposit_count: 0,
  },
  growth: [],
  members: memberships.map((m) => ({
    membership_id: m._id,
    name: m.user_id?.name || 'Member',
    role: m.role,
    avatar_url: m.user_id?.avatar_url || null,
    is_active_member: m.status === 'active',
    balance: 0,
    recent_deposits_30d: 0,
    deposit_count: 0,
    last_activity: null,
  })),
});

// ============================================================
// GET SAVINGS OVERVIEW
// ============================================================

export const getSavingsOverview = async (chamaId) => {
  const chamaObjectId = new mongoose.Types.ObjectId(chamaId);

  const [planIds, memberships] = await Promise.all([
    getSavingsPlanIds(chamaId),
    ChamaMembership.find({ chama_id: chamaId })
      .populate({ path: 'user_id', select: 'name avatar_url phone' })
      .lean(),
  ]);

  if (!planIds.length) {
    return emptyOverview(memberships);
  }

  const depositCutoff = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // --------------------------------------------------------
  // DEPOSITS — completed ContributionPayments into any of this
  // chama's savings plans, sliced per-member and per-month.
  // --------------------------------------------------------

  const [depositFacets] = await ContributionPayment.aggregate([
    {
      $match: {
        owner_type: 'Chama',
        owner_id: chamaObjectId,
        plan_id: { $in: planIds },
        participant_type: 'ChamaMembership',
        status: 'completed',
      },
    },
    {
      $addFields: {
        effective_date: { $ifNull: ['$completed_at', '$paid_at'] },
        amount_dec: { $toDecimal: '$amount' },
      },
    },
    {
      $facet: {
        byMember: [
          {
            $group: {
              _id: '$participant_id',
              total_deposited: { $sum: '$amount_dec' },
              deposit_count: { $sum: 1 },
              last_activity: { $max: '$effective_date' },
              recent_30d: {
                $sum: {
                  $cond: [{ $gte: ['$effective_date', depositCutoff] }, '$amount_dec', 0],
                },
              },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: { y: { $year: '$effective_date' }, m: { $month: '$effective_date' } },
              total: { $sum: '$amount_dec' },
            },
          },
        ],
      },
    },
  ]);

  // --------------------------------------------------------
  // SHARE-OUTS — every non-cancelled share-out item against
  // any of this chama's savings plans (pending items already
  // reduce a member's releasable balance, same rule
  // getMemberSavingsBalance uses), sliced the same way.
  // --------------------------------------------------------

  const [shareoutFacets] = await SavingsShareout.aggregate([
    {
      $match: {
        chama_id: chamaObjectId,
        contribution_plan_id: { $in: planIds },
      },
    },
    { $unwind: '$items' },
    { $match: { 'items.status': { $ne: 'cancelled' } } },
    {
      $addFields: {
        effective_date: { $ifNull: ['$items.paid_at', '$createdAt'] },
        amount_dec: { $toDecimal: '$items.amount' },
      },
    },
    {
      $facet: {
        byMember: [
          {
            $group: {
              _id: '$items.member_id',
              total_shared: { $sum: '$amount_dec' },
            },
          },
        ],
        byMonth: [
          {
            $group: {
              _id: { y: { $year: '$effective_date' }, m: { $month: '$effective_date' } },
              total: { $sum: '$amount_dec' },
            },
          },
        ],
      },
    },
  ]);

  const depositByMember = new Map(
    (depositFacets?.byMember || []).map((row) => [String(row._id), row])
  );
  const sharedByMember = new Map(
    (shareoutFacets?.byMember || []).map((row) => [String(row._id), row])
  );

  const monthlyDeposits = new Map(
    (depositFacets?.byMonth || []).map((row) => [
      monthKeyOf(row._id.y, row._id.m),
      toDecimal(row.total),
    ])
  );
  const monthlyShared = new Map(
    (shareoutFacets?.byMonth || []).map((row) => [
      monthKeyOf(row._id.y, row._id.m),
      toDecimal(row.total),
    ])
  );

  // --------------------------------------------------------
  // PER-MEMBER ROWS
  // --------------------------------------------------------

  const members = memberships
    .map((m) => {
      const key = String(m._id);
      const dep = depositByMember.get(key);
      const shared = sharedByMember.get(key);

      const totalDeposited = toDecimal(dep?.total_deposited ?? 0);
      const totalShared = toDecimal(shared?.total_shared ?? 0);
      const balance = totalDeposited.minus(totalShared);

      return {
        membership_id: m._id,
        name: m.user_id?.name || 'Member',
        role: m.role,
        avatar_url: m.user_id?.avatar_url || null,
        is_active_member: m.status === 'active',
        balance: round2(balance),
        recent_deposits_30d: round2(dep?.recent_30d ?? 0),
        deposit_count: dep?.deposit_count ?? 0,
        last_activity: dep?.last_activity ?? null,
      };
    })
    .sort((a, b) => b.balance - a.balance);

  // --------------------------------------------------------
  // TOTALS
  // --------------------------------------------------------

  const totalSavings = members.reduce((sum, m) => sum + m.balance, 0);
  const deposits30d = members.reduce((sum, m) => sum + m.recent_deposits_30d, 0);
  const depositCount = members.reduce((sum, m) => sum + m.deposit_count, 0);
  const activeSavers = members.filter((m) => m.balance > 0).length;

  const sharedOutTotal = round2(
    Array.from(sharedByMember.values()).reduce(
      (sum, row) => sum.plus(toDecimal(row.total_shared)),
      toDecimal(0)
    )
  );

  const totals = {
    total_savings: round2(totalSavings),
    deposits_30d: round2(deposits30d),
    shared_out_total: sharedOutTotal,
    active_savers: activeSavers,
    deposit_count: depositCount,
  };

  // --------------------------------------------------------
  // GROWTH TREND — trailing 12 months. Walks forward from a
  // baseline balance (current total minus everything that
  // happened inside the window) so the final point always
  // reconciles exactly with `totals.total_savings`.
  // --------------------------------------------------------

  const windowMonths = buildTrailingMonths(GROWTH_MONTHS);

  const depositsInWindow = windowMonths.reduce(
    (sum, mo) => sum.plus(monthlyDeposits.get(mo.key) || toDecimal(0)),
    toDecimal(0)
  );
  const sharedInWindow = windowMonths.reduce(
    (sum, mo) => sum.plus(monthlyShared.get(mo.key) || toDecimal(0)),
    toDecimal(0)
  );

  let running = toDecimal(totals.total_savings).minus(depositsInWindow).plus(sharedInWindow);

  const growth = windowMonths.map((mo) => {
    const monthDeposits = monthlyDeposits.get(mo.key) || toDecimal(0);
    const monthShared = monthlyShared.get(mo.key) || toDecimal(0);
    running = running.plus(monthDeposits).minus(monthShared);

    return {
      period: mo.label,
      balance: round2(running),
      deposits: round2(monthDeposits),
      shared_out: round2(monthShared),
    };
  });

  return { totals, growth, members };
};

export default {
  getSavingsOverview,
};