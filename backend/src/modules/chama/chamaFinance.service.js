import crypto from "node:crypto";
import mongoose from "mongoose";

import AppError from "../../utils/AppError.js";
import ContributionPlan from "../../models/ContributionPlan.js";
import ContributionObligation from "../../models/ContributionObligation.js";

import PaymentIntent from "../../models/PaymentIntent.js";
import MpesaAttempt from "../../models/MpesaAttempt.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import MgrReminder from "../../models/MgrReminder.js";
import paymentService from "../../payment/payment.service.js";

import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import { startPayout } from "../payout/payout.service.js";
import { PAYMENT_PROVIDER, PAYMENT_STATUS } from "../../payment/payment.constants.js";
import { toDecimal } from "../../shared/decimal.js";

const generateUniqueReference = (displayRef) => {
  const ts = Date.now();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${displayRef}-${ts}-${rand}`.slice(0, 100);
};

const canUseTransactions = () => {
  const topology = mongoose.connection?.client?.topology;
  const topologyType = topology?.description?.type;
  return topologyType === "ReplicaSetWithPrimary" || topologyType === "Sharded";
};
const getOpts = (session) => canUseTransactions() && session ? { session } : {};

const periodFor = (frequency, customDays = null, from = new Date()) => {
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (frequency === "daily") end.setDate(end.getDate() + 1);
  else if (frequency === "weekly") end.setDate(end.getDate() + 7);
  else if (frequency === "monthly") end.setMonth(end.getMonth() + 1);
  else if (frequency === "quarterly") end.setMonth(end.getMonth() + 3);
  else if (frequency === "yearly") end.setFullYear(end.getFullYear() + 1);
  else if (frequency === "custom") end.setDate(end.getDate() + Number(customDays || 1));
  else end.setDate(end.getDate() + 1);
  return { start, end };
};

// Every period boundary from the plan's start_date up to and including the
// one "now" currently falls in. Unlike currentMgrPeriod (which jumps
// straight to the open period and silently skips anything a member missed
// along the way), this is what makes MGR debt accumulate: a period that
// already ended is still returned, so ensureMgrRounds() below keeps its
// obligation around instead of never creating (or forgetting about) it.
const periodsSinceStart = (plan, now = new Date()) => {
  const periods = [];
  let period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, plan.start_date);
  let guard = 0;
  while (guard < 1000) {
    periods.push(period);
    if (period.end > now) break; // this is the open/current period - stop here
    period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, period.end);
    guard += 1;
  }
  return periods;
};
const activeMembers = (chamaId) => ChamaMembership.find({ chama_id: chamaId, status: "active" }).sort({ payout_position: 1, joined_at: 1 });

export const getOrCreateSavingsPlan = async ({ chama, userId }) => {
  let plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chama._id, contribution_type: "fixed", name: "Savings" });
  if (!plan) {
    plan = await ContributionPlan.create({
      owner_type: "Chama", owner_id: chama._id, participant_type: "ChamaMembership", created_by: userId,
      name: "Savings", description: "Member savings deposits", contribution_type: "fixed", frequency: "monthly",
      amount: chama.monthly_savings, start_date: new Date(), is_permanent: true, status: "active", activated_at: new Date(),
    });
  }
  return plan;
};

const getOrCreateObligation = async ({ plan, membership, amount, period, notes }) => {
  const filter = { plan_id: plan._id, participant_id: membership._id, period_start: period.start, period_end: period.end };
  let obligation = await ContributionObligation.findOne(filter);
  if (!obligation) {
    obligation = await ContributionObligation.create({
      plan_id: plan._id, owner_type: "Chama", owner_id: plan.owner_id, participant_type: "ChamaMembership", participant_id: membership._id,
      expected_amount: amount, paid_amount: 0, currency: "KES", due_date: period.end, period_start: period.start, period_end: period.end, notes,
    });
  }
  return obligation;
};

// ---------------------------------------------------------
// Initiate savings M-Pesa payment
// ---------------------------------------------------------
export const initiateSavingsDeposit = async ({ chama, membership, userId, amount, phoneNumber, idempotencyKey }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0 || !Number.isInteger(value)) throw new AppError("Amount must be a positive whole number of KES", 400);
  if (!phoneNumber) throw new AppError("M-Pesa phone number is required", 400);

  const plan = await getOrCreateSavingsPlan({ chama, userId });
  const obligation = await getOrCreateObligation({ plan, membership, amount: Math.max(value, Number(plan.amount.toString())), period: periodFor("monthly"), notes: "Savings deposit" });

  const key = idempotencyKey || crypto.randomUUID();
  const displayRef = "CHAMA-SAVE".slice(0, 20);
  const uniqueRef = generateUniqueReference(displayRef);

  console.log('[initiateSavingsDeposit] payload keys:', { key, displayRef, uniqueRef }); // DEBUG

  const payload = {
    amount: value,
    currency: "KES",
    type: 'savings',
    chamaId: chama._id,
    obligationId: obligation._id,
    planId: plan._id,
    participantId: membership._id,
    participantType: "ChamaMembership",
    phoneNumber,
    actorId: userId,
    provider: PAYMENT_PROVIDER.MPESA,
    reference: uniqueRef,
    displayReference: displayRef,
    display_reference: displayRef, // FIX: send both
    description: "Chama savings deposit",
    idempotencyKey: key, // FIX: send both
    idempotency_key: key,
    metadata: {
      productType: 'savings',
      chamaId: chama._id,
      obligationId: obligation._id
    }
  };

  // Delegate to PaymentService. It creates Intent + Payment + STK
  const result = await paymentService.initiate(payload);

  // Still create MpesaAttempt for tracking
  await MpesaAttempt.create({
    obligation_id: obligation._id, 
    payment_intent_id: result.paymentIntentId, 
    amount: value, 
    phone_number: result.phoneNumber,
    initiated_by: userId, 
    checkout_request_id: result.checkoutRequestId,
  });

  return { 
    intent: { _id: result.paymentIntentId, status: PAYMENT_STATUS.PROCESSING },
    stk: result.providerResponse 
  };
};

// ---------------------------------------------------------
// Record an already-settled Paybill (C2B) contribution
// ---------------------------------------------------------
// Unlike initiateSavingsDeposit, there is no STK push here - the money
// already landed via Paybill before this is called (see
// modules/mpesaC2b/c2bReconciliation.service.js). This just books the
// same obligation + ledger entries through the standard PaymentService
// pipeline, using MpesaC2bProvider's "immediate" settlement.
export const recordC2bContribution = async ({ chama, membership, amount, phoneNumber, mpesaReceiptNumber }) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new AppError("Amount must be a positive number of KES", 400);
  if (!mpesaReceiptNumber) throw new AppError("M-Pesa receipt number is required", 400);

  const plan = await getOrCreateSavingsPlan({ chama, userId: membership.user_id });
  const obligation = await getOrCreateObligation({
    plan, membership, amount: Math.max(value, Number(plan.amount.toString())), period: periodFor("monthly"), notes: "Savings deposit (Paybill)",
  });

  const displayRef = "CHAMA-C2B".slice(0, 20);

  // Stable idempotency key derived from the M-Pesa receipt number itself
  // (unique on Safaricom's side) - a retried ConfirmationURL delivery for
  // the same receipt hits PaymentIntent's unique idempotency_key index
  // and is rejected rather than double-posted.
  const result = await paymentService.initiate({
    amount: value,
    currency: "KES",
    type: "savings",
    chamaId: chama._id,
    obligationId: obligation._id,
    planId: plan._id,
    participantId: membership._id,
    participantType: "ChamaMembership",
    phoneNumber,
    actorId: membership.user_id,
    provider: PAYMENT_PROVIDER.MPESA_C2B,
    reference: `C2B-${mpesaReceiptNumber}`,
    displayReference: displayRef,
    description: "Chama savings deposit via M-Pesa Paybill",
    idempotencyKey: `c2b-${mpesaReceiptNumber}`,
    metadata: {
      productType: "savings",
      chamaId: chama._id,
      obligationId: obligation._id,
      payment_method: PAYMENT_PROVIDER.MPESA_C2B,
      mpesaReceiptNumber,
      source: "c2b",
    },
  });

  return { paymentIntentId: result.paymentIntentId, paymentId: result.paymentId, obligationId: obligation._id };
};

// ---------------------------------------------------------
// Reconcile savings callback - DELEGATE TO PAYMENT SERVICE
// ---------------------------------------------------------
export const reconcileSavingsCallback = async (callback) => {
  if (callback.mpesaReceiptNumber) {
    const alreadyProcessed = await PaymentIntent.findOne({ external_reference: callback.mpesaReceiptNumber });
    if (alreadyProcessed?.status === PAYMENT_STATUS.COMPLETED) {
      console.log(`Duplicate callback ignored. Receipt: ${callback.mpesaReceiptNumber}`);
      return true;
    }
  }

  const attempt = await MpesaAttempt.findOne({ checkout_request_id: callback.checkoutRequestId });
  if (!attempt) {
    console.warn(`Callback for unknown CheckoutRequestID: ${callback.checkoutRequestId}`);
    return false;
  }

  await paymentService.handleCallback(callback.rawCallback);
  return true;
};

// ---------------------------------------------------------
// Reconcile payment intent - RATE LIMIT SAFE
// ---------------------------------------------------------
export const reconcileSavingsIntent = async ({ intentId, chamaId }) => {
  const intent = await PaymentIntent.findOne({ _id: intentId, owner_type: "Chama", owner_id: chamaId });
  if (!intent || [PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED].includes(intent.status)) return intent;

  const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
  if (!attempt?.checkout_request_id) return intent;

  const ageSeconds = (Date.now() - attempt.createdAt.getTime()) / 1000;
  if (ageSeconds < 30) return intent;

  try {
    const query = await mpesaService.queryStkPush({ checkoutRequestId: attempt.checkout_request_id });
    if (query.resultCode === null || query.resultCode === undefined) return intent;

    await paymentService.processCallback({
      provider: PAYMENT_PROVIDER.MPESA,
      paymentId: intent._id,
      success: query.resultCode === 0,
      status: query.resultCode === 0 ? PAYMENT_STATUS.COMPLETED : PAYMENT_STATUS.FAILED,
      providerData: query,
      metadata: { productType: 'savings', chamaId }
    });
  } catch (e) {
    if (e.statusCode === 429 || e.statusCode === 500) {
      console.warn(`STK Query failed ${e.statusCode}. Relying on M-Pesa callback. Checkout: ${attempt.checkout_request_id}`);
      return intent;
    }
    throw e;
  }
  return PaymentIntent.findById(intent._id);
};

// MGR functions unchanged...
export const upsertMgrSettings = async ({ chama, userId, amount, frequency, payoutInterval, payoutIntervalDays }) => {
  const validIntervals = ["weekly", "monthly", "quarterly", "yearly", "custom"];
  if (!validIntervals.includes(payoutInterval)) throw new AppError("Invalid payout interval", 400);
  if (payoutInterval === "custom" && (!Number.isInteger(Number(payoutIntervalDays)) || Number(payoutIntervalDays) < 1)) throw new AppError("Custom payout interval requires payoutIntervalDays", 400);
  if (!validIntervals.includes(frequency)) throw new AppError("Invalid contribution frequency", 400);
  const value = Number(amount); if (!Number.isFinite(value) || value <= 0) throw new AppError("Amount must be greater than zero", 400);
  const settings = { enabled: true, payout_interval: payoutInterval, payout_interval_days: payoutInterval === "custom" ? Number(payoutIntervalDays) : null };
  let plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chama._id, contribution_type: "merry_go_round" });
  if (!plan) plan = new ContributionPlan({ owner_type: "Chama", owner_id: chama._id, participant_type: "ChamaMembership", created_by: userId, name: "Merry-Go-Round", description: "Rotating member payout plan", contribution_type: "merry_go_round", frequency, amount: value, start_date: new Date(), is_permanent: true, merry_go_round: settings, status: "active", activated_at: new Date() });
  else Object.assign(plan, { amount: value, frequency, merry_go_round: settings, status: "active", updated_by: userId });
  await plan.save(); await ensureMgrRound(plan); return plan;
};

export const ensureMgrRounds = async (plan) => {
  const now = new Date();
  const periods = periodsSinceStart(plan, now);
  const members = await activeMembers(plan.owner_id);

  for (const period of periods) {
    await Promise.all(members.map(member =>
      getOrCreateObligation({ plan, membership: member, amount: plan.amount, period, notes: `MGR round starting ${period.start.toISOString().slice(0, 10)}` })
    ));
  }

  // Any period before the current (open) one that's still pending or
  // partially paid was missed - flag it overdue so it shows as debt that
  // accumulates, rather than quietly rolling over once the interval ends.
  const pastPeriodEnds = periods.slice(0, -1).map(p => p.end);
  if (pastPeriodEnds.length) {
    await ContributionObligation.updateMany(
      {
        plan_id: plan._id,
        period_end: { $in: pastPeriodEnds },
        status: { $in: ["pending", "partially_paid"] },
      },
      { $set: { status: "overdue" } }
    );
  }

  return { period: periods[periods.length - 1], periods, members };
};

// Backward-compatible alias - same call shape used elsewhere in this file.
export const ensureMgrRound = ensureMgrRounds;

export const getMgrOverview = async (chamaId) => {
  const plan = await ContributionPlan.findOne({
    owner_type: "Chama",
    owner_id: chamaId,
    contribution_type: "merry_go_round",
  });

  const members = await activeMembers(chamaId).populate(
    "user_id",
    "name phone"
  );

  const round = plan
    ? await ensureMgrRounds(plan)
    : null;

  // Every period's obligations (not just the current one) - this is what
  // lets the dashboard show accumulated debt and the per-month history.
  const obligations =
    plan && round
      ? await ContributionObligation.find({
          plan_id: plan._id,
          participant_id: {
            $in: members.map(({ _id }) => _id),
          },
        }).sort({ period_start: 1 })
      : [];

  const obligationsByMember = new Map();
  for (const obligation of obligations) {
    const key = String(obligation.participant_id);
    if (!obligationsByMember.has(key)) obligationsByMember.set(key, []);
    obligationsByMember.get(key).push(obligation);
  }

  const currentPeriod = round?.period;
  const currentObligationIds = currentPeriod
    ? obligations
        .filter((ob) => ob.period_start.getTime() === currentPeriod.start.getTime())
        .map((ob) => ob._id)
    : [];

  // Get the latest reminder for every obligation in the current round
  const reminders = currentObligationIds.length
    ? await MgrReminder.aggregate([
        {
          $match: {
            obligation_id: {
              $in: currentObligationIds,
            },
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $group: {
            _id: "$obligation_id",
            channel: {
              $first: "$channel",
            },
            createdAt: {
              $first: "$createdAt",
            },
          },
        },
      ])
    : [];

  const reminderByObligation = new Map(
    reminders.map((item) => [
      String(item._id),
      {
        channel: item.channel,
        sent_at: item.createdAt,
      },
    ])
  );

  const Payout = (
    await import("../../models/Payout.js")
  ).default;

  const currentPayout = await Payout.findOne({
    chama_id: chamaId,
    contribution_plan_id: plan?._id,
    status: { $in: ["pending", "approved"] },
  }).populate(
    "member_id",
    "payout_position user_id"
  );

  const memberSummaries = members.map((member) => {
    const key = String(member._id);
    const memberObligations = obligationsByMember.get(key) || [];

    const current = currentPeriod
      ? memberObligations.find((ob) => ob.period_start.getTime() === currentPeriod.start.getTime())
      : null;

    // Oldest-first: whatever "Mark Paid" settles next, and what a member
    // must clear before the current period even counts toward the round.
    const outstanding = memberObligations
      .filter((ob) => ob.status !== "paid")
      .sort((a, b) => a.period_start - b.period_start);

    const outstandingTotal = outstanding
      .reduce((sum, ob) => sum.add(toDecimal(ob.expected_amount).minus(toDecimal(ob.paid_amount || 0))), toDecimal(0))
      .toString();

    const reminder = current
      ? reminderByObligation.get(String(current._id))
      : null;

    return {
      member_id: member._id,
      member_name: member.user_id?.name || "Member",
      phone: member.user_id?.phone || null,
      payout_position: member.payout_position,
      obligation: current || null,
      outstanding_count: outstanding.length,
      outstanding_total: outstandingTotal,
      next_due: outstanding[0] || null,
      last_reminder: reminder || null,
    };
  });

  // One row per period, each with every member's status for that period -
  // the "record of each month" view.
  const memberNameById = new Map(
    members.map((member) => [String(member._id), member.user_id?.name || "Member"])
  );

  const historyByPeriod = new Map();
  for (const obligation of obligations) {
    const key = obligation.period_start.toISOString();
    if (!historyByPeriod.has(key)) {
      historyByPeriod.set(key, {
        period_start: obligation.period_start,
        period_end: obligation.period_end,
        members: [],
      });
    }
    historyByPeriod.get(key).members.push({
      member_id: obligation.participant_id,
      member_name: memberNameById.get(String(obligation.participant_id)) || "Member",
      status: obligation.status,
      expected_amount: obligation.expected_amount,
      paid_amount: obligation.paid_amount,
      paid_at: obligation.paid_at || null,
    });
  }

  const history = [...historyByPeriod.values()]
    .sort((a, b) => b.period_start - a.period_start)
    .map((row) => ({
      ...row,
      paid_count: row.members.filter((m) => m.status === "paid").length,
      total_members: row.members.length,
    }));

  return {
    plan,
    members,
    currentPayout,

    round: round
      ? {
          start: round.period?.start,
          end: round.period?.end,
        }
      : null,

    obligations: memberSummaries,

    history,
  };
};

export const recordMgrReminder = async ({ chamaId, obligationId, channel, userId, message }) => {
  if (!["sms", "whatsapp"].includes(channel)) throw new AppError("Reminder channel must be sms or whatsapp", 400);
  const obligation = await ContributionObligation.findOne({ _id: obligationId, owner_type: "Chama", owner_id: chamaId });
  if (!obligation) throw new AppError("MGR contribution obligation not found", 404);
  if (obligation.status === "paid") throw new AppError("This member has already paid the current MGR round", 409);
  const plan = await ContributionPlan.findOne({ _id: obligation.plan_id, contribution_type: "merry_go_round" });
  if (!plan) throw new AppError("Reminder is only available for an MGR obligation", 400);
  return MgrReminder.create({ chama_id: chamaId, obligation_id: obligation._id, participant_id: obligation.participant_id, channel, created_by: userId, message });
};

// ---------------------------------------------------------
// Treasurer records a payment on a member's behalf (cash, bank deposit,
// etc). Settles the OLDEST unpaid/overdue period first - a member has to
// catch up on a missed interval before this ever touches the current one.
// Posts through the same Payment Engine as M-Pesa (cash provider settles
// synchronously), so the ledger and the obligation update together.
// ---------------------------------------------------------
export const markMgrObligationPaid = async ({ chamaId, memberId, userId }) => {
  const plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chamaId, contribution_type: "merry_go_round", status: "active" });
  if (!plan) throw new AppError("Merry-Go-Round is not set up for this chama", 404);

  // Make sure every period up to now (including ones this member missed)
  // actually has an obligation before we look for the oldest unpaid one.
  await ensureMgrRounds(plan);

  const membership = await ChamaMembership.findOne({ _id: memberId, chama_id: chamaId, status: "active" });
  if (!membership) throw new AppError("Active member not found in this chama", 404);

  const obligation = await ContributionObligation.findOne({
    plan_id: plan._id,
    participant_id: membership._id,
    status: { $in: ["pending", "partially_paid", "overdue"] },
  }).sort({ period_start: 1 });

  if (!obligation) throw new AppError("This member has no outstanding Merry-Go-Round contribution", 409);

  const outstandingAmount = toDecimal(obligation.expected_amount).minus(toDecimal(obligation.paid_amount || 0));
  if (!outstandingAmount.greaterThan(0)) throw new AppError("This member has no outstanding Merry-Go-Round contribution", 409);

  const reference = generateUniqueReference("CHAMA-MGR");

  const result = await paymentService.initiate({
    amount: Number(outstandingAmount.toString()),
    currency: "KES",
    type: "mgr",
    chamaId,
    obligationId: obligation._id,
    planId: plan._id,
    participantId: membership._id,
    participantType: "ChamaMembership",
    actorId: userId,
    provider: PAYMENT_PROVIDER.CASH,
    reference,
    displayReference: "CHAMA-MGR",
    metadata: {
      productType: "mgr",
      chamaId,
      obligationId: obligation._id,
      payment_method: "cash",
      recordedBy: userId,
    },
  });

  // paymentService.initiate() now awaits the finance/obligation-closing
  // listener (emitAsync), so by the time it resolves the obligation below
  // already reflects the payment that was just recorded.
  const updatedObligation = await ContributionObligation.findById(obligation._id);

  return {
    payment: result,
    obligation: updatedObligation,
    period: { start: obligation.period_start, end: obligation.period_end },
  };
};

export const maybeCreateMgrPayoutForChama = async (chamaId, userId) => {
  const plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chamaId, contribution_type: "merry_go_round", status: "active" });
  if (!plan) return null;
  const { period, members } = await ensureMgrRounds(plan);
  if (!members.length) return null;

  // Gate the payout on the round being COMPLETELY caught up - not just the
  // current period. A member sitting on an older overdue obligation still
  // blocks the round, same as the current one being unpaid.
  const outstandingCount = await ContributionObligation.countDocuments({
    plan_id: plan._id,
    participant_id: { $in: members.map(({ _id }) => _id) },
    status: { $in: ["pending", "partially_paid", "overdue"] },
  });
  if (outstandingCount > 0) return null;

  return startPayout({ chamaId, created_by: userId, contributionPlanId: plan._id, amount: Number(plan.amount.toString()) * members.length, roundStart: period.start });
};