/**
 * ============================================================================
 * BANK ACCOUNT SERVICE
 * ============================================================================
 * CRUD for a workspace's registered real-world bank account(s). This is
 * metadata only - it does not move money. Money movement into the bank
 * happens via cashDeposit.service.js#depositCashToBank or the generic
 * finance operations endpoint, both of which post against the single
 * system 'BANK' FinancialAccount.
 * ============================================================================
 */

import FinancialAccount from "../../models/FinancialAccount.js";
import ChamaBankAccount from "../../models/ChamaBankAccount.js";
import AppError from "../../utils/AppError.js";
import { createAuditLog, AUDIT_SCOPE_TYPES } from "../../services/audit.service.js";
import { AUDIT_ACTIONS } from "../../constants/audit.constants.js";

const auditBankAccount = ({ ownerType, ownerId, userId, action, bankAccount, before = null }) => {
  if (ownerType !== "Chama") return;
  createAuditLog({
    actorUserId: userId,
    scopeType: AUDIT_SCOPE_TYPES.CHAMA,
    chamaId: ownerId,
    action,
    resourceType: "ChamaBankAccount",
    resourceId: bankAccount._id,
    before,
    after: {
      bank_name: bankAccount.bank_name,
      account_name: bankAccount.account_name,
      masked_account_number: bankAccount.maskedAccountNumber(),
      status: bankAccount.status,
      is_primary: bankAccount.is_primary
    }
  }).catch(() => null);
};

export async function listBankAccounts(ownerType, ownerId, { includeInactive = false } = {}) {
  const query = { owner_type: ownerType, owner_id: ownerId };
  if (!includeInactive) query.status = "active";

  return ChamaBankAccount.find(query).sort({ is_primary: -1, createdAt: 1 });
}

export async function createBankAccount({
  ownerType,
  ownerId,
  userId,
  bankName,
  accountName,
  accountNumber,
  branch = "",
  swiftCode = "",
  paybillOrTill = "",
  currency = "KES",
  isPrimary = false,
  notes = ""
}) {
  if (!bankName || !accountName || !accountNumber) {
    throw new AppError("Bank name, account name, and account number are required", 400);
  }

  // Make sure the ledger BANK account exists so a deposit can post as soon
  // as this bank account is registered.
  let bankFinancialAccount = await FinancialAccount.findOne({
    owner_type: ownerType,
    owner_id: ownerId,
    account_code: "BANK"
  });
  if (!bankFinancialAccount) {
    await FinancialAccount.bootstrapSystemAccounts({ owner_type: ownerType, owner_id: ownerId, created_by: userId });
    bankFinancialAccount = await FinancialAccount.findOne({
      owner_type: ownerType,
      owner_id: ownerId,
      account_code: "BANK"
    });
  }

  const existingCount = await ChamaBankAccount.countDocuments({ owner_type: ownerType, owner_id: ownerId, status: "active" });

  try {
    const bankAccount = await ChamaBankAccount.create({
      owner_type: ownerType,
      owner_id: ownerId,
      financial_account_id: bankFinancialAccount?._id || null,
      bank_name: bankName.trim(),
      account_name: accountName.trim(),
      account_number: accountNumber.trim(),
      branch: branch?.trim() || "",
      swift_code: swiftCode?.trim() || "",
      paybill_or_till: paybillOrTill?.trim() || "",
      currency: (currency || "KES").toUpperCase(),
      // The very first bank account for a workspace is automatically primary.
      is_primary: existingCount === 0 ? true : Boolean(isPrimary),
      notes: notes?.trim() || "",
      created_by: userId
    });
    auditBankAccount({ ownerType, ownerId, userId, action: AUDIT_ACTIONS.BANK_ACCOUNT_CREATED, bankAccount });
    return bankAccount;
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("This bank account is already registered for this workspace", 409);
    }
    throw error;
  }
}

export async function updateBankAccount({ ownerType, ownerId, userId, bankAccountId, updates = {} }) {
  const bankAccount = await ChamaBankAccount.findOne({ _id: bankAccountId, owner_type: ownerType, owner_id: ownerId });
  if (!bankAccount) throw new AppError("Bank account not found", 404);

  const fieldMap = {
    bankName: "bank_name",
    accountName: "account_name",
    accountNumber: "account_number",
    branch: "branch",
    swiftCode: "swift_code",
    paybillOrTill: "paybill_or_till",
    currency: "currency",
    isPrimary: "is_primary",
    notes: "notes"
  };

  for (const [key, path] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      bankAccount[path] = typeof updates[key] === "string" ? updates[key].trim() : updates[key];
    }
  }

  bankAccount.updated_by = userId;

  try {
    await bankAccount.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new AppError("This bank account is already registered for this workspace", 409);
    }
    throw error;
  }

  auditBankAccount({ ownerType, ownerId, userId, action: AUDIT_ACTIONS.BANK_ACCOUNT_UPDATED, bankAccount });
  return bankAccount;
}

export async function deactivateBankAccount({ ownerType, ownerId, userId, bankAccountId }) {
  const bankAccount = await ChamaBankAccount.findOne({ _id: bankAccountId, owner_type: ownerType, owner_id: ownerId });
  if (!bankAccount) throw new AppError("Bank account not found", 404);

  bankAccount.status = "inactive";
  bankAccount.is_primary = false;
  bankAccount.updated_by = userId;
  await bankAccount.save();

  // If that was the primary account, promote the oldest remaining active
  // one so there's always a default deposit target when one exists.
  const replacement = await ChamaBankAccount.findOne({
    owner_type: ownerType,
    owner_id: ownerId,
    status: "active"
  }).sort({ createdAt: 1 });

  if (replacement && !replacement.is_primary) {
    replacement.is_primary = true;
    await replacement.save();
  }

  auditBankAccount({ ownerType, ownerId, userId, action: AUDIT_ACTIONS.BANK_ACCOUNT_DEACTIVATED, bankAccount });
  return bankAccount;
}
