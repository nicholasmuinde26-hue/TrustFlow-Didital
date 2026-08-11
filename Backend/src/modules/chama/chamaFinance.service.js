import crypto from "node:crypto";
import mongoose from "mongoose";

import AppError from "../../utils/AppError.js";
import ContributionPlan from "../../models/ContributionPlan.js";
import ContributionObligation from "../../models/ContributionObligation.js";
import PaymentIntent from "../../models/PaymentIntent.js";
import MpesaAttempt from "../../models/MpesaAttempt.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import MgrReminder from "../../models/MgrReminder.js";

import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import contributionPaymentService from "../contributionPlan/contributionPayment.service.js";
import { startPayout } from "../payout/payout.service.js";

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------

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

const getOpts = (session) => {
  return canUseTransactions() && session ? { session } : {};
};

// ---------------------------------------------------------
// Contribution periods
// ---------------------------------------------------------

const periodFor = (frequency, customDays = null, from = new Date()) => {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
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

const currentMgrPeriod = (plan, now = new Date()) => {
  let period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, plan.start_date);
  while (period.end <= now) {
    period = periodFor(plan.merry_go_round.payout_interval, plan.merry_go_round.payout_interval_days, period.end);
  }
  return period;
};

const activeMembers = (chamaId) =>
  ChamaMembership.find({ chama_id: chamaId, status: "active" }).sort({ payout_position: 1, joined_at: 1 });

// ---------------------------------------------------------
// Savings plan
// ---------------------------------------------------------

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

// ---------------------------------------------------------
// Contribution obligation
// ---------------------------------------------------------

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
  const existing = await PaymentIntent.findOne({ idempotency_key: key });
  if (existing) return { intent: existing, reused: true };

  const temporaryRequestId = `pending_${crypto.randomUUID()}`;
  const normalizedPhone = mpesaService.normalizePhoneNumber(phoneNumber);
  const displayRef = "CHAMA-SAVE".slice(0, 20);
  const uniqueRef = generateUniqueReference(displayRef);

  const intent = await PaymentIntent.create({
    obligation_id: obligation._id, plan_id: plan._id, owner_type: "Chama", owner_id: chama._id,
    participant_type: "ChamaMembership", participant_id: membership._id, amount: value, currency: "KES",
    payment_method: "mpesa", phone_number: normalizedPhone, reference: uniqueRef, display_reference: displayRef,
    idempotency_key: key, provider: "mpesa", provider_request_id: temporaryRequestId, status: "pending", created_by: userId,
  });

  try {
    const result = await mpesaService.initiateStkPush({
      amount: value, phoneNumber: normalizedPhone, accountReference: intent.reference,
      displayReference: intent.display_reference, transactionDescription: "Chama savings deposit",
    });

    intent.provider_request_id = result.checkoutRequestId;
    intent.provider_response_id = result.merchantRequestId;
    intent.provider_response = result.rawResponse;
    intent.status = "processing";
    await intent.save();

    await MpesaAttempt.create({
      obligation_id: obligation._id, payment_intent_id: intent._id, amount: value, phone_number: intent.phone_number,
      initiated_by: userId, checkout_request_id: result.checkoutRequestId, merchant_request_id: result.merchantRequestId,
    });

    return { intent, stk: result };
  } catch (error) {
    intent.status = "failed"; intent.failure_reason = error.message; intent.failed_at = new Date();
    await intent.save();
    throw error;
  }
};

export const reconcileSavingsCallback = async (callback) => {
  // 1. Idempotency check: if we already processed this receipt, return true and exit
  if (callback.mpesaReceiptNumber) {
    const alreadyProcessed = await PaymentIntent.findOne({ 
      external_reference: callback.mpesaReceiptNumber 
    });
    if (alreadyProcessed?.status === 'completed') {
      console.log(`Duplicate callback ignored. Receipt: ${callback.mpesaReceiptNumber}`);
      return true;
    }
  }

  const attempt = await MpesaAttempt.findOneAndUpdate(
    { checkout_request_id: callback.checkoutRequestId, payment_intent_id: { $ne: null } },
    { $set: { status: callback.success ? "processing" : "failed" } },
    { returnDocument: "after" }
  );

  if (!attempt) {
    console.warn(`Callback for unknown CheckoutRequestID: ${callback.checkoutRequestId}`);
    return false;
  }

  const intent = await PaymentIntent.findById(attempt.payment_intent_id);
  if (!intent) throw new AppError("Payment intent missing for M-Pesa attempt", 500);

  // 2. Second idempotency check: intent already completed
  if (intent.status === 'completed') {
    console.log(`Intent ${intent._id} already completed. Ignoring duplicate callback.`);
    return true;
  }

  const amountMismatch = Number(callback.amount) !== Number(attempt.amount.toString());
  const phoneMismatch = callback.phoneNumber && callback.phoneNumber !== attempt.phone_number;

  if (!callback.success || amountMismatch || phoneMismatch) {
    attempt.status = "failed"; 
    await attempt.save();
    const status = Number(callback.resultCode) === 1032 ? "cancelled" : "failed";
    await PaymentIntent.findByIdAndUpdate(intent._id, {
      status, 
      failure_code: callback.resultCode !== undefined ? String(callback.resultCode) : undefined,
      failure_reason: callback.resultDescription, 
      failed_at: new Date(), 
      provider_response: callback.rawCallback,
    });
    return true;
  }

  const useTransaction = canUseTransactions();
  const session = useTransaction ? await mongoose.startSession() : null;
  
  try {
    if (session) session.startTransaction();

    // 3. Add idempotency key to processPayment so it also blocks duplicates
    const result = await contributionPaymentService.processPayment({
      obligationId: attempt.obligation_id,
      amount: callback.amount,
      paymentMethod: "mpesa",
      processingMode: "webhook",
      createdBy: attempt.initiated_by,
      providerPaymentId: callback.checkoutRequestId,
      externalReference: callback.mpesaReceiptNumber, // This is the true unique id
      displayReference: intent.display_reference,
      idempotencyKey: callback.mpesaReceiptNumber || callback.checkoutRequestId // ADD THIS
    }, session);

    if (session) await session.commitTransaction();

    attempt.status = "completed";
    attempt.mpesa_receipt_number = callback.mpesaReceiptNumber;
    await attempt.save();

    await PaymentIntent.findByIdAndUpdate(intent._id, {
      status: "completed",
      external_reference: callback.mpesaReceiptNumber,
      contribution_payment_id: result?.payment?._id,
      financial_transaction_id: result?.accounting?.transactionId || null,
      completed_at: new Date(),
      provider_response: callback.rawCallback,
    });

    await maybeCreateMgrPayoutForChama(intent.owner_id, attempt.initiated_by);
    return true;
  } catch (error) {
    if (session && session.inTransaction()) await session.abortTransaction();
    
    // If duplicate error from contributionPaymentService, swallow it
    if (error.message?.includes('Duplicate payment detected')) {
      console.warn(`Duplicate payment caught and ignored: ${callback.mpesaReceiptNumber}`);
      return true;
    }
    throw error;
  } finally {
    if (session) await session.endSession();
  }
};
// ---------------------------------------------------------
// Reconcile payment intent - RATE LIMIT SAFE
// ---------------------------------------------------------

export const reconcileSavingsIntent = async ({ intentId, chamaId }) => {
  const intent = await PaymentIntent.findOne({ _id: intentId, owner_type: "Chama", owner_id: chamaId });
  if (!intent || ["completed", "failed", "cancelled"].includes(intent.status)) return intent;

  const attempt = await MpesaAttempt.findOne({ payment_intent_id: intent._id });
  if (!attempt?.checkout_request_id) return intent;

  // Prevent spamming M-Pesa. Only query if >30s old
  const ageSeconds = (Date.now() - attempt.createdAt.getTime()) / 1000;
  if (ageSeconds < 30) {
    console.log(`Skipping STK query. Too soon. Age: ${ageSeconds}s`);
    return intent;
  }

  try {
    const query = await mpesaService.queryStkPush({ checkoutRequestId: attempt.checkout_request_id });
    if (query.resultCode === null || query.resultCode === undefined) return intent;

    const successful = Number(query.resultCode) === 0;
    // Extract receipt from query if available
    const mpesaReceipt = query.rawResponse?.MpesaReceiptNumber || null;

    await reconcileSavingsCallback({
      checkoutRequestId: attempt.checkout_request_id,
      resultCode: Number(query.resultCode),
      resultDescription: query.resultDescription || "M-Pesa STK status received",
      success: successful,
      amount: successful ? Number(attempt.amount.toString()) : null,
      phoneNumber: successful ? attempt.phone_number : null,
      mpesaReceiptNumber: mpesaReceipt,
      rawCallback: query.rawResponse,
    });
  } catch (e) {
    // CRITICAL: Don't throw 429/500 to frontend. Just log and wait for callback
    if (e.statusCode === 429 || e.statusCode === 500) {
      console.warn(`STK Query failed ${e.statusCode}. Relying on M-Pesa callback. Checkout: ${attempt.checkout_request_id}`);
      return intent;
    }
    throw e;
  }

  return PaymentIntent.findById(intent._id);
};

// ---------------------------------------------------------
// MGR settings - rest unchanged
// ---------------------------------------------------------

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

export const ensureMgrRound = async (plan) => {
  const period = currentMgrPeriod(plan);
  const members = await activeMembers(plan.owner_id);
  await Promise.all(members.map(member => getOrCreateObligation({ plan, membership: member, amount: plan.amount, period, notes: `MGR round starting ${period.start.toISOString().slice(0, 10)}` })));
  return { period, members };
};

export const getMgrOverview = async (chamaId) => {
  const plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chamaId, contribution_type: "merry_go_round" });
  const members = await activeMembers(chamaId).populate("user_id", "name phone");
  const round = plan ? await ensureMgrRound(plan) : null;
  
  const obligations = plan && round ? await ContributionObligation.find({ 
    plan_id: plan._id, 
    participant_id: { $in: members.map(({ _id }) => _id) }, 
    period_start: round.period.start, 
    period_end: round.period.end 
  }) : [];
  
  const obligationByMember = new Map(obligations.map((item) => [String(item.participant_id), item]));
  
  const reminders = obligations.length ? await MgrReminder.aggregate([
    { $match: { obligation_id: { $in: obligations.map(({ _id }) => _id) } } }, 
    { $sort: { createdAt: -1 } }, 
    { $group: { _id: "$obligation_id", channel: { $first: "$channel" }, createdAt: { $first: "$createdAt" } } }
  ]) : [];
  
  const reminderByObligation = new Map(reminders.map((item) => [String(item._id), { channel: item.channel, sent_at: item.createdAt }]));
  
  const Payout = (await import("../../models/Payout.js")).default;
  const currentPayout = await Payout.findOne({ chama_id: chamaId, contribution_plan_id: plan?._id, status: "pending" }).populate("member_id", "payout_position user_id");
  
  return {
    plan, 
    members, 
    currentPayout,
    round: round ? { start: round.period?.start, end: round.period?.end } : null,
    obligations: members.map((member) => {
      const memberObligation = obligationByMember.get(String(member._id));
      const reminder = memberObligation ? reminderByObligation.get(String(memberObligation._id)) : null;
      return {
        member_id: member._id, 
        member_name: member.user_id?.name || "Member", 
        phone: member.user_id?.phone || null,
        payout_position: member.payout_position, 
        obligation: memberObligation || null, 
        last_reminder: reminder || null,
      };
    }),
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

export const maybeCreateMgrPayoutForChama = async (chamaId, userId) => {
  const plan = await ContributionPlan.findOne({ owner_type: "Chama", owner_id: chamaId, contribution_type: "merry_go_round", status: "active" });
  if (!plan) return null;
  const { period, members } = await ensureMgrRound(plan);
  if (!members.length) return null;
  const obligations = await ContributionObligation.find({ plan_id: plan._id, participant_id: { $in: members.map(({ _id }) => _id) }, period_start: period.start, period_end: period.end });
  if (obligations.length !== members.length || obligations.some(({ status }) => status !== "paid")) return null;
  return startPayout({ chamaId, created_by: userId, contributionPlanId: plan._id, amount: Number(plan.amount.toString()) * members.length, roundStart: period.start });
};