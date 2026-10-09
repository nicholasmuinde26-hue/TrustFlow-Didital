import mongoose from "mongoose";
import MemberWallet, { MemberWalletEntry } from "../../models/MemberWallet.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import AppError from "../../utils/AppError.js";
import bcrypt from "bcryptjs";

const decimal = (value) => mongoose.Types.Decimal128.fromString(Number(value).toFixed(2));
const amountNumber = (value) => Number(value?.toString?.() ?? value ?? 0);
const entryView = (entry) => ({ ...entry.toObject(), amount: amountNumber(entry.amount) });
const PIN_PATTERN = /^\d{4,6}$/;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

function validateWalletPin(pin) {
  const value = String(pin || "");
  if (!PIN_PATTERN.test(value)) throw new AppError("Wallet PIN must be 4 to 6 digits", 400);
  const ascending = value.split("").every((digit, index, digits) => index === 0 || Number(digit) === Number(digits[index - 1]) + 1);
  const descending = value.split("").every((digit, index, digits) => index === 0 || Number(digit) === Number(digits[index - 1]) - 1);
  if (/^(\d)\1+$/.test(value) || ascending || descending) {
    throw new AppError("Choose a less predictable PIN", 400);
  }
  return value;
}

export async function setMemberWalletPin({ userId, pin }) {
  const safePin = validateWalletPin(pin);
  const wallet = await ensureWallet(userId);
  const record = await MemberWallet.findById(wallet._id).select("+wallet_pin_hash");
  if (record.wallet_pin_hash) throw new AppError("Wallet PIN is already set. Enter your current PIN to change it.", 409);
  record.wallet_pin_hash = await bcrypt.hash(safePin, 10);
  record.wallet_pin_failed_attempts = 0;
  record.wallet_pin_locked_until = null;
  await record.save();
  return { pin_set: true };
}

export async function changeMemberWalletPin({ userId, currentPin, newPin }) {
  const safePin = validateWalletPin(newPin);
  await verifyMemberWalletPin(userId, currentPin);
  const wallet = await MemberWallet.findOne({ user_id: userId }).select("+wallet_pin_hash +wallet_pin_failed_attempts +wallet_pin_locked_until");
  wallet.wallet_pin_hash = await bcrypt.hash(safePin, 10);
  wallet.wallet_pin_failed_attempts = 0;
  wallet.wallet_pin_locked_until = null;
  await wallet.save();
  return { pin_set: true };
}

async function verifyMemberWalletPin(userId, pin) {
  const wallet = await MemberWallet.findOne({ user_id: userId }).select("+wallet_pin_hash +wallet_pin_failed_attempts +wallet_pin_locked_until");
  if (!wallet?.wallet_pin_hash) throw new AppError("Set your wallet PIN before using wallet transactions", 403);
  if (wallet.wallet_pin_locked_until && wallet.wallet_pin_locked_until > new Date()) throw new AppError("Too many incorrect wallet PIN attempts. Try again later.", 429);
  if (!(await bcrypt.compare(String(pin || ""), wallet.wallet_pin_hash))) {
    const updated = await MemberWallet.findOneAndUpdate(
      { _id: wallet._id },
      { $inc: { wallet_pin_failed_attempts: 1 } },
      { new: true }
    ).select("+wallet_pin_failed_attempts");
    if ((updated?.wallet_pin_failed_attempts || 0) >= MAX_PIN_ATTEMPTS) {
      await MemberWallet.updateOne(
        { _id: wallet._id },
        { $set: { wallet_pin_locked_until: new Date(Date.now() + PIN_LOCKOUT_MS), wallet_pin_failed_attempts: 0 } }
      );
      throw new AppError("Too many incorrect wallet PIN attempts. Wallet actions are locked for 15 minutes.", 429);
    }
    throw new AppError("Incorrect wallet PIN", 401);
  }
  if (wallet.wallet_pin_failed_attempts || wallet.wallet_pin_locked_until) {
    wallet.wallet_pin_failed_attempts = 0;
    wallet.wallet_pin_locked_until = null;
    await wallet.save();
  }
}

export async function getMemberWalletPinStatus(userId) {
  const wallet = await MemberWallet.findOne({ user_id: userId }).select("+wallet_pin_hash +wallet_pin_locked_until").lean();
  return {
    pin_set: Boolean(wallet?.wallet_pin_hash),
    pin_locked_until: wallet?.wallet_pin_locked_until > new Date() ? wallet.wallet_pin_locked_until : null,
  };
}

const ensureWallet = (userId) => MemberWallet.findOneAndUpdate(
  { user_id: userId },
  { $setOnInsert: { user_id: userId, balance: decimal(0), reserved_balance: decimal(0) } },
  { upsert: true, new: true }
);

export async function getMemberWallet(userId) {
  const wallet = await ensureWallet(userId);
  const entries = await MemberWalletEntry.find({ user_id: userId }).sort({ createdAt: -1 }).limit(30).lean();
  const pinStatus = await getMemberWalletPinStatus(userId);
  return {
    balance: amountNumber(wallet.balance),
    reserved_balance: amountNumber(wallet.reserved_balance),
    available_balance: Math.max(0, amountNumber(wallet.balance)),
    ...pinStatus,
    entries: entries.map((entry) => ({ ...entry, amount: amountNumber(entry.amount) })),
  };
}

export async function initiateMemberWalletDeposit({ userId, amount, phoneNumber, pin }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 1) throw new AppError("Deposit must be at least KES 1", 400);
  if (!phoneNumber) throw new AppError("M-Pesa phone number is required", 400);
  await verifyMemberWalletPin(userId, pin);
  await ensureWallet(userId);
  const entry = await MemberWalletEntry.create({ user_id: userId, type: "deposit", amount: decimal(value), status: "pending", phone_number: phoneNumber, created_by: userId });
  try {
    const response = await mpesaService.initiateStkPush({
      amount: value,
      phoneNumber,
      accountReference: `WALLET-${String(entry._id).slice(-10)}`,
      displayReference: `WALLET-${String(entry._id).slice(-10)}`,
      transactionDescription: "Personal member wallet deposit",
    });
    entry.checkout_request_id = response.checkoutRequestId;
    await entry.save();
    return { entry: entryView(entry), customerMessage: response.customerMessage || "Approve the M-Pesa prompt to fund your wallet." };
  } catch (error) {
    entry.status = "failed";
    entry.failure_reason = error.message;
    await entry.save();
    throw error;
  }
}

export async function reconcileMemberWalletDeposit({ checkoutRequestId, success, receipt, reason }) {
  if (!checkoutRequestId) return null;
  const entry = await MemberWalletEntry.findOne({ checkout_request_id: checkoutRequestId, type: "deposit" });
  if (!entry || entry.status !== "pending") return entry;
  if (!success) {
    entry.status = "failed";
    entry.failure_reason = reason || "M-Pesa deposit was not completed";
    await entry.save();
    return entry;
  }
  const updated = await MemberWalletEntry.findOneAndUpdate(
    { _id: entry._id, status: "pending" },
    { $set: { status: "completed", external_reference: receipt || null, completed_at: new Date() } },
    { new: true }
  );
  if (!updated) return MemberWalletEntry.findById(entry._id);
  await MemberWallet.updateOne({ user_id: entry.user_id }, { $inc: { balance: decimal(entry.amount) } });
  return updated;
}

// Chama disbursements credited here become the named member's personal funds.
// The source key makes retrying a settlement unable to credit twice.
export async function creditMemberWallet({ userId, amount, sourceType, sourceId, createdBy, externalReference, session = null }) {
  if (!userId || !sourceId) throw new AppError("Wallet recipient and source are required", 400);
  await ensureWallet(userId);
  let created = true;
  let entry;
  try {
    [entry] = await MemberWalletEntry.create([{
      user_id: userId, type: "disbursement", amount: decimal(amount), status: "completed",
      source_type: sourceType, source_id: sourceId, external_reference: externalReference || null,
      created_by: createdBy || userId, completed_at: new Date(),
    }], session ? { session } : {});
  } catch (error) {
    if (error.code !== 11000) throw error;
    created = false;
    entry = await MemberWalletEntry.findOne({ source_type: sourceType, source_id: sourceId, type: "disbursement" }).session(session || null);
  }
  if (created) {
    await MemberWallet.updateOne({ user_id: userId }, { $inc: { balance: decimal(amount) } }, session ? { session } : {});
  }
  return entry;
}

export async function initiateMemberWalletWithdrawal({ userId, amount, phoneNumber, pin }) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 1) throw new AppError("Withdrawal must be at least KES 1", 400);
  if (!phoneNumber) throw new AppError("M-Pesa phone number is required", 400);
  await verifyMemberWalletPin(userId, pin);
  await ensureWallet(userId);
  const wallet = await MemberWallet.findOneAndUpdate(
    { user_id: userId, balance: { $gte: decimal(value) } },
    { $inc: { balance: decimal(-value), reserved_balance: decimal(value) } },
    { new: true }
  );
  if (!wallet) throw new AppError("Insufficient available wallet balance", 400);
  const entry = await MemberWalletEntry.create({ user_id: userId, type: "withdrawal", amount: decimal(value), status: "pending", phone_number: phoneNumber, created_by: userId });
  try {
    const response = await mpesaService.initiateB2cPayment({ amount: value, phoneNumber, remarks: "Member wallet withdrawal", occasion: `Wallet ${String(entry._id).slice(-12)}` });
    entry.conversation_id = response.conversationId;
    await entry.save();
    return { entry: entryView(entry), message: "Withdrawal submitted. Your wallet will update when M-Pesa confirms delivery." };
  } catch (error) {
    await MemberWallet.updateOne({ user_id: userId }, { $inc: { balance: decimal(value), reserved_balance: decimal(-value) } });
    entry.status = "failed";
    entry.failure_reason = error.message;
    await entry.save();
    throw error;
  }
}

export async function reconcileMemberWalletWithdrawal({ conversationId, success, receipt, reason }) {
  const entry = await MemberWalletEntry.findOneAndUpdate(
    { conversation_id: conversationId, type: "withdrawal", status: "pending" },
    { $set: {
      status: success ? "completed" : "failed",
      external_reference: receipt || null,
      failure_reason: success ? null : reason || "M-Pesa did not complete the withdrawal",
      completed_at: success ? new Date() : null,
    } },
    { new: true }
  );
  if (!entry) return null;
  await MemberWallet.updateOne(
    { user_id: entry.user_id },
    success
      ? { $inc: { reserved_balance: decimal(-entry.amount) } }
      : { $inc: { balance: decimal(entry.amount), reserved_balance: decimal(-entry.amount) } }
  );
  return entry;
}

