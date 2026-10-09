import mongoose from "mongoose";

import ContributionPlan from "../../models/ContributionPlan.js";
import ContributionObligation from "../../models/ContributionObligation.js";
import ContributionPayment from "../../models/ContributionPayment.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";

// ============================================================
// CONTRIBUTIONS REGISTER
// ============================================================
//
// One read-only aggregation that answers "what has actually been
// contributed to this workspace, by whom, against which plan, and
// what is still outstanding".
//
// This is the single source of truth behind the Contributions page.
// Every figure here is computed live off the two collections that
// actually hold the money facts:
//
//   ContributionPayment    - what was received (the credit side)
//   ContributionObligation - what was owed      (the expectation)
//
// Nothing is read from the chart of accounts, and nothing is cached,
// so the register can never drift from the ledger the way a stored
// rollup would.
//
// DOES NOT:
//   ✗ Mutate anything - pure read
//   ✗ Decide permissions - the controller passes membershipId when the
//     caller's scope is 'own', and this service simply honours it
//
// ============================================================

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && value._bsontype === "Decimal128") {
    return Number(value.toString());
  }
  if (typeof value === "object" && "$numberDecimal" in value) {
    return Number(value.$numberDecimal);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Math.round(toNumber(value) * 100) / 100;

// Statuses that represent money the workspace has actually received.
const SETTLED_STATUSES = ["completed"];
// Statuses that represent money still in flight (an STK push the member
// hasn't finished, a bank transfer awaiting confirmation).
const IN_FLIGHT_STATUSES = ["pending", "processing"];
// Statuses that represent an attempt that went nowhere.
const FAILED_STATUSES = ["failed", "cancelled", "reversed", "refunded"];

const membershipModelFor = (ownerType) =>
  ownerType === "Chama" ? ChamaMembership : ContributionGroupMember;

const memberIdOf = (value) => {
  if (!value) return null;
  if (typeof value === "object") return String(value._id ?? value.id ?? "");
  return String(value);
};

const shapeMember = (membership) => ({
  membership_id: membership?._id ? String(membership._id) : null,
  name: membership?.user_id?.name || membership?.name || "Member",
  phone: membership?.user_id?.phone || null,
  avatar_url: membership?.user_id?.avatar_url || null,
  role: membership?.role || "member",
  is_active: membership?.status === "active",
});

// ============================================================
// GET CONTRIBUTIONS REGISTER
// ============================================================
//
// `membershipId` scopes the whole register down to one member - used
// for the plain-member view, where 'contributions.view' is granted at
// 'own' scope. Officials leave it null and get the full register.
//
// ============================================================

export const getContributionsRegister = async (
  ownerType,
  ownerId,
  {
    membershipId = null,
    planId = null,
    status = null,
    method = null,
    from = null,
    to = null,
    limit = 250,
  } = {}
) => {
  const ownerObjectId = new mongoose.Types.ObjectId(ownerId);

  // --------------------------------------------------------
  // PLANS - every non-cancelled contribution plan this
  // workspace runs. Each one is a separate collection stream
  // (monthly dues, a welfare levy, a free-will savings plan,
  // an MGR round) and the register keeps them distinguishable
  // rather than folding them into one anonymous total.
  // --------------------------------------------------------
  const planQuery = {
    owner_type: ownerType,
    owner_id: ownerObjectId,
    status: { $ne: "cancelled" },
  };
  if (planId) planQuery._id = new mongoose.Types.ObjectId(planId);

  const plans = await ContributionPlan.find(planQuery)
    .select("_id name contribution_type frequency status currency start_date end_date")
    .sort({ createdAt: -1 })
    .lean();

  const planIds = plans.map((p) => p._id);
  const planById = new Map(plans.map((p) => [String(p._id), p]));

  const MembershipModel = membershipModelFor(ownerType);
  const memberships = await MembershipModel.find(
    ownerType === "Chama"
      ? { chama_id: ownerId }
      : { contribution_group_id: ownerId }
  )
    .populate({ path: "user_id", select: "name phone avatar_url" })
    .lean();

  const membershipById = new Map(memberships.map((m) => [String(m._id), m]));

  if (!planIds.length) {
    return {
      plans: [],
      payments: [],
      members: memberships.map((m) => ({
        ...shapeMember(m),
        expected: 0,
        paid: 0,
        outstanding: 0,
        payment_count: 0,
        last_payment_at: null,
        collection_rate: 0,
        standing: "no_plan",
      })),
      totals: {
        expected: 0,
        collected: 0,
        outstanding: 0,
        in_flight: 0,
        failed_count: 0,
        payment_count: 0,
        contributor_count: 0,
        member_count: memberships.length,
        collection_rate: 0,
        collected_this_month: 0,
        overdue_amount: 0,
        overdue_member_count: 0,
      },
    };
  }

  // --------------------------------------------------------
  // PAYMENTS - the received side. Filters here are the same
  // ones the UI exposes, applied at the database rather than
  // in the browser, so the totals below always describe
  // exactly the rows the user is looking at.
  // --------------------------------------------------------
  const paymentQuery = {
    owner_type: ownerType,
    owner_id: ownerObjectId,
    plan_id: { $in: planIds },
  };

  if (membershipId) paymentQuery.participant_id = new mongoose.Types.ObjectId(membershipId);

  if (status) {
    const values = String(status)
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (values.length) paymentQuery.status = values.length > 1 ? { $in: values } : values[0];
  }

  if (method) {
    const values = String(method)
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
    if (values.length)
      paymentQuery.payment_method = values.length > 1 ? { $in: values } : values[0];
  }

  if (from || to) {
    paymentQuery.paid_at = {};
    if (from) paymentQuery.paid_at.$gte = new Date(from);
    if (to) {
      // `to` is an inclusive calendar day from the UI's date picker, so
      // push the bound to the end of that day rather than midnight,
      // which would silently drop everything paid on the last day.
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      paymentQuery.paid_at.$lte = end;
    }
  }

  const paymentDocs = await ContributionPayment.find(paymentQuery)
    .sort({ paid_at: -1, createdAt: -1 })
    .limit(Math.min(Number(limit) || 250, 1000))
    .lean();

  const payments = paymentDocs.map((p) => {
    const membership = membershipById.get(memberIdOf(p.participant_id));
    const plan = planById.get(String(p.plan_id));

    return {
      id: String(p._id),
      amount: round2(p.amount),
      currency: p.currency || "KES",
      status: p.status,
      method: p.payment_method,
      reference: p.reference || null,
      external_reference: p.external_reference || null,
      paid_at: p.paid_at,
      recorded_at: p.createdAt,
      failure_message: p.failure_message || null,
      obligation_id: p.obligation_id ? String(p.obligation_id) : null,
      recorded_by: p.recorded_by ? String(p.recorded_by) : null,
      member: membership
        ? shapeMember(membership)
        : { membership_id: memberIdOf(p.participant_id), name: "Member", role: "member" },
      plan: plan
        ? {
            id: String(plan._id),
            name: plan.name,
            contribution_type: plan.contribution_type,
            frequency: plan.frequency,
          }
        : null,
    };
  });

  // --------------------------------------------------------
  // OBLIGATIONS - the expected side. Everything "outstanding"
  // in this register is expected minus settled, per member and
  // per plan, rather than a number anyone types in.
  // --------------------------------------------------------
  const obligationQuery = {
    owner_type: ownerType,
    owner_id: ownerObjectId,
    plan_id: { $in: planIds },
  };
  if (membershipId)
    obligationQuery.participant_id = new mongoose.Types.ObjectId(membershipId);

  const obligations = await ContributionObligation.find(obligationQuery).lean();

  // --------------------------------------------------------
  // ROLLUPS
  // --------------------------------------------------------
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const perMember = new Map();
  const perPlan = new Map(plans.map((p) => [String(p._id), {
    id: String(p._id),
    name: p.name,
    contribution_type: p.contribution_type,
    frequency: p.frequency,
    status: p.status,
    currency: p.currency || "KES",
    expected: 0,
    collected: 0,
    outstanding: 0,
    payment_count: 0,
    obligation_count: 0,
    overdue_count: 0,
  }]));

  const bucketFor = (id) => {
    const key = String(id || "");
    if (!perMember.has(key)) {
      const membership = membershipById.get(key);
      perMember.set(key, {
        ...(membership
          ? shapeMember(membership)
          : { membership_id: key || null, name: "Member", role: "member", is_active: false }),
        expected: 0,
        paid: 0,
        outstanding: 0,
        payment_count: 0,
        last_payment_at: null,
        overdue_amount: 0,
      });
    }
    return perMember.get(key);
  };

  // Seed every known member so a member who has never paid still shows
  // up in the register as a 0-paid row rather than vanishing from it -
  // the members who have contributed nothing are precisely the ones a
  // treasurer is looking for.
  memberships.forEach((m) => bucketFor(m._id));

  let expectedTotal = 0;
  let overdueTotal = 0;
  const overdueMembers = new Set();

  obligations.forEach((o) => {
    const expected = round2(o.expected_amount ?? o.amount ?? 0);
    const paid = round2(o.paid_amount ?? 0);
    const bucket = bucketFor(memberIdOf(o.participant_id));
    const plan = perPlan.get(String(o.plan_id));

    bucket.expected = round2(bucket.expected + expected);
    expectedTotal = round2(expectedTotal + expected);

    if (plan) {
      plan.expected = round2(plan.expected + expected);
      plan.obligation_count += 1;
    }

    const shortfall = Math.max(0, round2(expected - paid));
    const isOverdue =
      shortfall > 0 &&
      (o.status === "overdue" || (o.due_date && new Date(o.due_date) < now));

    if (isOverdue) {
      bucket.overdue_amount = round2(bucket.overdue_amount + shortfall);
      overdueTotal = round2(overdueTotal + shortfall);
      overdueMembers.add(String(bucket.membership_id));
      if (plan) plan.overdue_count += 1;
    }
  });

  let collectedTotal = 0;
  let inFlightTotal = 0;
  let failedCount = 0;
  let collectedThisMonth = 0;
  const contributors = new Set();

  // The settled figures below are computed from the *unfiltered* payment
  // set, not the filtered page above, so the headline totals describe the
  // plan's true position instead of only the slice currently on screen.
  const settledDocs = await ContributionPayment.find({
    owner_type: ownerType,
    owner_id: ownerObjectId,
    plan_id: { $in: planIds },
    ...(membershipId ? { participant_id: new mongoose.Types.ObjectId(membershipId) } : {}),
  })
    .select("amount status participant_id plan_id paid_at")
    .lean();

  settledDocs.forEach((p) => {
    const amount = round2(p.amount);
    const bucket = bucketFor(memberIdOf(p.participant_id));
    const plan = perPlan.get(String(p.plan_id));

    if (SETTLED_STATUSES.includes(p.status)) {
      collectedTotal = round2(collectedTotal + amount);
      bucket.paid = round2(bucket.paid + amount);
      bucket.payment_count += 1;
      contributors.add(String(bucket.membership_id));

      if (plan) {
        plan.collected = round2(plan.collected + amount);
        plan.payment_count += 1;
      }

      if (p.paid_at && new Date(p.paid_at) >= monthStart) {
        collectedThisMonth = round2(collectedThisMonth + amount);
      }

      if (!bucket.last_payment_at || new Date(p.paid_at) > new Date(bucket.last_payment_at)) {
        bucket.last_payment_at = p.paid_at;
      }
    } else if (IN_FLIGHT_STATUSES.includes(p.status)) {
      inFlightTotal = round2(inFlightTotal + amount);
    } else if (FAILED_STATUSES.includes(p.status)) {
      failedCount += 1;
    }
  });

  const members = Array.from(perMember.values()).map((m) => {
    const outstanding = Math.max(0, round2(m.expected - m.paid));
    return {
      ...m,
      outstanding,
      collection_rate: m.expected > 0 ? Math.round((m.paid / m.expected) * 100) : 0,
      standing:
        m.expected === 0
          ? m.paid > 0
            ? "ahead"
            : "no_obligation"
          : m.overdue_amount > 0
          ? "overdue"
          : outstanding === 0
          ? "settled"
          : "partial",
    };
  });

  members.sort((a, b) => b.outstanding - a.outstanding || b.paid - a.paid);

  const planRows = Array.from(perPlan.values()).map((p) => ({
    ...p,
    outstanding: Math.max(0, round2(p.expected - p.collected)),
    collection_rate: p.expected > 0 ? Math.round((p.collected / p.expected) * 100) : 0,
  }));

  return {
    plans: planRows,
    payments,
    members,
    totals: {
      expected: expectedTotal,
      collected: collectedTotal,
      outstanding: Math.max(0, round2(expectedTotal - collectedTotal)),
      in_flight: inFlightTotal,
      failed_count: failedCount,
      payment_count: settledDocs.filter((p) => SETTLED_STATUSES.includes(p.status)).length,
      contributor_count: contributors.size,
      member_count: memberships.length,
      collection_rate:
        expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0,
      collected_this_month: collectedThisMonth,
      overdue_amount: overdueTotal,
      overdue_member_count: overdueMembers.size,
    },
  };
};

export default { getContributionsRegister };