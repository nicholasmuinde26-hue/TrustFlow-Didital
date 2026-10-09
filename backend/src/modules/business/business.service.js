import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import Business, { BUSINESS_CATEGORIES } from "../../models/Business.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import BusinessCustomer from "../../models/BusinessCustomer.js";
import BusinessSupplier from "../../models/BusinessSupplier.js";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import Chama from "../../models/Chama.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ChamaAsset from "../../models/ChamaAsset.js";
import RentalListing from "../../models/RentalListing.js";
import BusinessItem from "../../models/BusinessItem.js";
import MarketplaceListing from "../../models/MarketplaceListing.js";
import {
  publishInventoryItem as publishItemToMarketplace,
  unpublishInventoryItem as unpublishItemFromMarketplace,
  publishInventoryItems as publishItemsToMarketplace,
  syncItemToListings,
  archiveItemListings,
  attachMarketplaceState,
  approveUnreviewedInventoryListings,
} from "../marketplace/inventoryMarketplaceSync.service.js";
import User from "../../models/User.js";
import { formatPhone } from "../../utils/phone.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import { recordExpense as recordChamaAssetExpense, recordIncome as recordChamaAssetIncome } from "../chamaAssets/chamaAsset.service.js";
import { sendBusinessReceiptEmail } from "../../services/notifications/email.service.js";
import { getIO } from "../realtime/socketServer.js";

const getUserId = (user) => user?._id || user?.id;

// Unique, human-readable till receipt number, e.g. POS-20261005-7K2Q9X.
// Random 4-digit tags collided often enough to make a receipt ambiguous.
const newPosReceiptNumber = () => {
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `POS-${day}-${randomBytes(4).toString("hex").slice(0, 6).toUpperCase()}`;
};

// One receipt shape for both the sale response and later reprints.
function buildPosReceipt(business, transaction, { cashierName = null } = {}) {
  const snap = transaction.receipt || {};
  const items = (snap.items || []).map((l) => ({
    item_id: l.item_id, name: l.name, qty: l.qty, price: l.price, total: l.total,
  }));
  return {
    receipt_number: transaction.external_reference,
    transaction_id: String(transaction._id),
    issued_at: transaction.createdAt,
    business: {
      name: business.name,
      location: business.location || null,
      currency: business.currency || "KES",
      tax_id: business.tax_settings?.tax_id || null,
      mpesa_till: business.mpesa_till || null,
      mpesa_paybill: business.mpesa_paybill || null,
    },
    cashier: cashierName,
    customer_name: transaction.customer_name || null,
    customer_phone: transaction.customer_phone || null,
    payment_channel: transaction.payment_channel,
    mpesa_prompt_sent: Boolean(snap.mpesa_prompt_sent),
    mpesa_receipt_number: transaction.mpesa_receipt_number || null,
    items,
    subtotal: snap.subtotal ?? Number(transaction.amount?.toString() || 0),
    discount: snap.discount || 0,
    total: Number(transaction.amount?.toString() || 0),
  };
}
// Business POS STK pushes don't go through the shared PaymentIntent/event-bus
// system (see reconcileStkCallback / checkStkStatus below), so they need
// their own tiny bridge to push the result to the seller's browser the
// instant it's known, instead of only ever surfacing on the next poll.
function emitBusinessTransactionStatus(transaction) {
  try {
    const io = getIO();
    io.to(`user:${transaction.created_by}`).emit("payment:status", {
      paymentIntentId: String(transaction._id),
      checkoutRequestId: transaction.checkout_request_id || null,
      paymentId: String(transaction._id),
      status: transaction.status,
      failureReason: transaction.status === "completed" ? null : (transaction.failure_reason || null),
      amount: transaction.amount ? transaction.amount.toString() : null,
      productType: "business_sale",
      ownerId: String(transaction.business_id),
      ownerType: "Business",
    });
  } catch (error) {
    // Non-fatal: Socket.IO may not be up (e.g. during tests/scripts), and
    // the frontend's own status polling remains the fallback either way.
    console.warn("[business.service] Failed to emit payment:status:", error.message);
  }
}


const sameId = (a, b) => Boolean(a && b) && String(a) === String(b);

const accessError = (message, statusCode = 403) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Resolves the caller's access to a business and enforces it.
 *
 *  - personal business (owner_type "user"): only the owning user. Legacy rows
 *    created by the old admin-approval flow have no owner_id, so we fall back
 *    to created_by for those.
 *  - chama business (owner_type "chama"): the chama owns it, never the officer
 *    who requested it. Chairperson and treasurer manage it, as does the
 *    member assigned as the asset's manager. Other active members who can see
 *    the asset get read-only access.
 *
 * Pass { write: true } for anything that changes data. The resolved access is
 * attached to the returned business as `business.access` (not persisted).
 */
export async function getOwnedBusiness(businessId, user, { write = false } = {}) {
  if (!mongoose.isValidObjectId(businessId)) {
    throw accessError("Workspace not found or access denied", 404);
  }
  const userId = getUserId(user);
  const business = await Business.findOne({ _id: businessId });

  if (business) {
    if (business.owner_type === "chama") {
      const membership = await ChamaMembership.findOne({
        chama_id: business.owner_id,
        user_id: userId,
        status: "active",
      }).select("role");

      const asset = business.chama_asset_id
        ? await ChamaAsset.findOne({ _id: business.chama_asset_id, chama_id: business.owner_id, status: "active" })
            .select("_id management")
        : null;

      const isLeader = ["chairperson", "treasurer"].includes(membership?.role);
      const isAssignedManager = Boolean(
        asset && asset.management?.manager_type === "member" && sameId(asset.management?.manager_id, userId)
      );

      if (!membership || (!asset && !isLeader)) {
        throw accessError("Active Chama membership and asset approval are required to access this business");
      }

      const canManage = isLeader || isAssignedManager;
      if (write && !canManage) {
        throw accessError("Only the chairperson, treasurer or the assigned business manager can make changes to this business");
      }

      business.access = {
        ownerType: "chama",
        role: isLeader ? membership.role : isAssignedManager ? "manager" : "member",
        canManage,
      };
      return business;
    }

    // Personal business
    const ownerRef = business.owner_id || business.created_by;
    if (!sameId(ownerRef, userId)) {
      // Same 404 as a missing business, so IDs can't be probed.
      throw accessError("Workspace not found or access denied", 404);
    }
    business.access = { ownerType: "user", role: "owner", canManage: true };
    return business;
  }

  const group = await ContributionGroup.findById(businessId);
  if (group) {
    return {
      _id: group._id,
      name: group.name,
      currency: "KES",
      isGroup: true,
      group,
    };
  }

  throw accessError("Workspace not found or access denied", 404);
}

function assertAmount(amount) {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    const error = new Error("A positive amount is required");
    error.statusCode = 400;
    throw error;
  }
}

/**
 * ============================================================
 * FINANCIAL ACCOUNTS & DOUBLE-ENTRY LEDGER POSTING FOR BUSINESS & GROUPS
 * ============================================================
 */
export async function ensureBusinessAccounts(businessId, createdBy, ownerType = "Business") {
  const accountsDef = [
    { name: "Cash Wallet", account_code: "CASH", system_key: "cash", account_type: "asset", normal_balance: "debit", account_category: "cash" },
    { name: "Bank Account", account_code: "BANK", system_key: "bank", account_type: "asset", normal_balance: "debit", account_category: "bank" },
    { name: "M-Pesa Till & Paybill", account_code: "MPESA_TILL", system_key: "till", account_type: "asset", normal_balance: "debit", account_category: "mpesa" },
    { name: ownerType === "ContributionGroup" ? "Member Contributions" : "Sales Revenue", account_code: ownerType === "ContributionGroup" ? "MEMBER_CONTRIBUTIONS" : "SALES_REVENUE", system_key: ownerType === "ContributionGroup" ? "member_contributions" : "sales_revenue", account_type: "income", normal_balance: "credit", account_category: "income" },
    { name: "Operating Expenses", account_code: "OPERATING_EXPENSES", system_key: "operating_expenses", account_type: "expense", normal_balance: "debit", account_category: "expense" },
    ...(ownerType === "Business" ? [{ name: "Chama Capital", account_code: "CHAMA_CAPITAL", system_key: "chama_capital", account_type: "equity", normal_balance: "credit", account_category: "equity" }] : []),
  ];

  const map = {};
  for (const acc of accountsDef) {
    let existing = await FinancialAccount.findOne({
      owner_type: ownerType,
      owner_id: businessId,
      account_code: acc.account_code,
    });
    if (!existing) {
      existing = await FinancialAccount.create({
        owner_type: ownerType,
        owner_id: businessId,
        name: acc.name,
        account_code: acc.account_code,
        system_key: acc.system_key,
        account_type: acc.account_type,
        normal_balance: acc.normal_balance,
        account_category: acc.account_category,
        is_system_account: true,
        created_by: createdBy,
      });
    }
    map[acc.account_code] = existing;
  }
  return map;
}

/**
 * Executes ledger postings and updates customer/supplier/group metrics upon completion.
 */
async function onTransactionCompleted(transaction, business) {
  const isGroup = Boolean(business.isGroup || business.target_amount !== undefined);
  const ownerType = isGroup ? "ContributionGroup" : "Business";
  const amount = Number(transaction.amount.toString());
  const accountsMap = await ensureBusinessAccounts(business._id, transaction.created_by, ownerType);

  let targetAssetCode = "CASH";
  if (transaction.payment_channel === "bank") targetAssetCode = "BANK";
  else if (["till", "paybill", "mpesa"].includes(transaction.payment_channel)) targetAssetCode = "MPESA_TILL";

  const assetAccount = accountsMap[targetAssetCode];
  const isSale = transaction.direction === "cash_in";

  // 1. Update FinancialAccount Balances & Post Ledger
  if (assetAccount) {
    const currentBal = Number(assetAccount.current_balance ? assetAccount.current_balance.toString() : 0);
    const newBal = isSale ? currentBal + amount : Math.max(0, currentBal - amount);
    assetAccount.current_balance = mongoose.Types.Decimal128.fromString(newBal.toString());
    await assetAccount.save();

    // Create double-entry FinancialTransaction & LedgerEntries
    const finTx = await FinancialTransaction.create({
      owner_type: ownerType,
      owner_id: business._id,
      source_type: "BusinessTransaction",
      source_id: transaction._id,
      transaction_type: isSale ? (isGroup ? "contribution" : "sale") : "expense",
      reference: transaction.external_reference ? `${transaction.external_reference}-${String(transaction._id).slice(-4)}` : `TX-${String(transaction._id)}`,
      amount: transaction.amount,
      currency: transaction.currency || "KES",
      status: "posted",
      description: transaction.description || `${isSale ? (isGroup ? "Member Contribution" : "Sale") : "Expense"} via ${transaction.payment_channel}`,
      created_by: transaction.created_by,
      posted_at: new Date(),
    });

    const incomeOrExpenseAccount = isSale
      ? (accountsMap["MEMBER_CONTRIBUTIONS"] || accountsMap["SALES_REVENUE"])
      : accountsMap["OPERATING_EXPENSES"];

    await LedgerEntry.create([
      {
        transaction_id: finTx._id,
        owner_type: ownerType,
        owner_id: business._id,
        account_id: assetAccount._id,
        entry_type: isSale ? "debit" : "credit",
        amount: transaction.amount,
        currency: transaction.currency || "KES",
        description: transaction.description || `Cash movement on ${assetAccount.name}`,
      },
      ...(incomeOrExpenseAccount
        ? [
            {
              transaction_id: finTx._id,
              owner_type: ownerType,
              owner_id: business._id,
              account_id: incomeOrExpenseAccount._id,
              entry_type: isSale ? "credit" : "debit",
              amount: transaction.amount,
              currency: transaction.currency || "KES",
              description: transaction.description || `Revenue/Expense allocation`,
            },
          ]
        : []),
    ]);

    // If Contribution Group, update total raised in group document
    if (isGroup) {
      try {
        const group = await ContributionGroup.findById(business._id);
        if (group) {
          const currentTotal = Number(group.total_raised || 0);
          group.total_raised = currentTotal + amount;
          await group.save();
        }
      } catch (err) {
        console.error("[ContributionGroup Financial Update Error]", err);
      }
    }
  }

  // 2. Customer Auto-Registration (3+ Payments Threshold) & Instant Receipt Note
  if (isSale) {
    const customerPhone = transaction.customer_phone || null;
    const customerEmail = transaction.customer_email || null;
    const customerName = transaction.customer_name || (customerPhone ? `Customer (${customerPhone.slice(-4)})` : "Guest Customer");

    let customer = null;
    if (customerPhone || customerEmail) {
      const query = [];
      if (customerPhone) query.push({ phone: customerPhone });
      if (customerEmail) query.push({ email: customerEmail });

      customer = await BusinessCustomer.findOne({ business_id: business._id, $or: query });
    }

    if (!customer) {
      customer = await BusinessCustomer.create({
        business_id: business._id,
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        transaction_count: 1,
        total_spent: transaction.amount,
        is_auto_registered: false,
        last_transaction_at: new Date(),
      });
    } else {
      customer.transaction_count += 1;
      const currentSpent = Number(customer.total_spent ? customer.total_spent.toString() : 0);
      customer.total_spent = mongoose.Types.Decimal128.fromString((currentSpent + amount).toString());
      if (customer.transaction_count >= 3) {
        customer.is_auto_registered = true;
      }
      customer.last_transaction_at = new Date();
      if (customerName && customer.name === "Guest Customer") {
        customer.name = customerName;
      }
      await customer.save();
    }

    // Trigger Email Receipt if email present
    if (customerEmail || customerPhone) {
      sendBusinessReceiptEmail({
        to: customerEmail || customerPhone,
        customerName: customer.name,
        businessName: business.name,
        amount,
        currency: transaction.currency || "KES",
        reference: transaction.external_reference || transaction.mpesa_receipt_number || `REC-${String(transaction._id).slice(-6)}`,
        channel: transaction.payment_channel,
      }).catch((err) => console.error("Receipt email error:", err));
    }
  }

  // 3. Supplier Auto-Registration (3+ Payouts Threshold)
  if (!isSale) {
    const supplierPhone = transaction.customer_phone || null;
    const supplierName = transaction.customer_name || transaction.description || "Vendor Supplier";

    let supplier = await BusinessSupplier.findOne({
      business_id: business._id,
      $or: [{ name: supplierName }, { phone: supplierPhone }].filter((q) => q.name || q.phone),
    });

    if (!supplier) {
      supplier = await BusinessSupplier.create({
        business_id: business._id,
        name: supplierName,
        phone: supplierPhone,
        payout_count: 1,
        total_paid_out: transaction.amount,
        is_auto_registered: false,
        last_payout_at: new Date(),
      });
    } else {
      supplier.payout_count += 1;
      const currentPaid = Number(supplier.total_paid_out ? supplier.total_paid_out.toString() : 0);
      supplier.total_paid_out = mongoose.Types.Decimal128.fromString((currentPaid + amount).toString());
      if (supplier.payout_count >= 3) {
        supplier.is_auto_registered = true;
      }
      supplier.last_payout_at = new Date();
      await supplier.save();
    }
  }

  if (!isGroup && business.owner_type === "chama" && business.chama_asset_id) {
    const assetPosting = {
      amount,
      collectionMethod: ["till", "paybill", "mpesa"].includes(transaction.payment_channel)
        ? "mpesa"
        : transaction.payment_channel,
      description: transaction.description || `${isSale ? "Business income" : "Business expense"} - ${business.name}`,
      recordedBy: transaction.created_by,
      sourceBusinessTransactionId: transaction._id,
    };
    if (isSale) {
      await recordChamaAssetIncome(business.owner_id, business.chama_asset_id, assetPosting);
    } else {
      await recordChamaAssetExpense(business.owner_id, business.chama_asset_id, assetPosting);
    }
  }
}

export async function createBusiness(data, user) {
  if (!data.name?.trim()) {
    const error = new Error("Business name is required");
    error.statusCode = 400;
    throw error;
  }

  const category = BUSINESS_CATEGORIES.includes(data.category) ? data.category : "other";

  let ownerId = getUserId(user);
  const isAdmin = user.systemRole === "super_admin" || user.systemRole === "sub_admin";
  const ownerInput = (data.ownerInput || data.ownerPhone || data.ownerEmail || data.chairpersonInput || "").trim();

  if (isAdmin && (ownerInput || data.ownerName || data.chairpersonName)) {
    let clientUser = null;
    if (ownerInput.includes("@")) {
      clientUser = await User.findOne({ email: ownerInput.toLowerCase() });
    } else if (ownerInput) {
      try {
        const formatted = formatPhone(ownerInput);
        clientUser = await User.findOne({ phone: formatted });
      } catch {
        // Soft fail
      }
    }

    if (!clientUser) {
      let phoneVal = null;
      let emailVal = null;
      if (ownerInput.includes("@")) {
        emailVal = ownerInput.toLowerCase();
      } else if (ownerInput) {
        try {
          phoneVal = formatPhone(ownerInput);
        } catch {
          phoneVal = null;
        }
      }
      if (!phoneVal) {
        phoneVal = `2547${Math.floor(10000000 + Math.random() * 89999999)}`;
      }

      clientUser = await User.create({
        name: data.ownerName || data.chairpersonName || "Business Owner",
        phone: phoneVal,
        email: emailVal,
        status: "unverified",
        isPhoneVerified: false,
        systemRole: "user",
      });
    }

    ownerId = clientUser._id;
  }

  const business = await Business.create({
    name: data.name,
    owner_type: "user",
    owner_id: ownerId,
    category,
    category_label: data.category_label || data.categoryLabel || "",
    currency: data.currency || "KES",
    location: data.location || null,
    fiscal_year_start: data.fiscal_year_start || data.fiscalYearStart || "January",
    tax_settings: {
      vat_registered: Boolean(data.vat_registered || data.tax_settings?.vat_registered),
      vat_rate: Number(data.vat_rate || data.tax_settings?.vat_rate || 16),
      tax_id: data.tax_id || data.tax_settings?.tax_id || null,
    },
    mpesa_till: data.mPesaTill || null,
    mpesa_paybill: data.mPesaPaybill || null,
    created_by: ownerId,
  });

  await ensureBusinessAccounts(business._id, ownerId);

  return business;
}


export async function getSummary(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  const [transactions, totals, accounts] = await Promise.all([
    BusinessTransaction.find({ business_id: business._id, status: "completed" }).sort({ createdAt: -1 }).limit(10),
    BusinessTransaction.aggregate([
      { $match: { business_id: business._id, status: "completed" } },
      { $group: { _id: "$direction", total: { $sum: "$amount" } } },
    ]),
    FinancialAccount.find({ owner_type: "Business", owner_id: business._id, status: "active" }),
  ]);

  const total = (direction) => String(totals.find((item) => item._id === direction)?.total || 0);

  // `access` is set on the document at runtime and is not a schema path, so it
  // would be dropped on serialisation - copy it into a plain profile object
  // together with the owning chama's name for the "Chama-owned" badge.
  const profile = typeof business.toObject === "function" ? business.toObject() : { ...business };
  profile.access = business.access || null;
  if (profile.owner_type === "chama") {
    const chama = await Chama.findById(profile.owner_id).select("name").lean();
    profile.chamaName = chama?.name || null;
  }

  return {
    profile,
    dashboard: {
      cashIn: total("cash_in"),
      cashOut: total("cash_out"),
      netCash: String(Number(total("cash_in")) - Number(total("cash_out"))),
    },
    accounts: accounts.map((acc) => ({
      name: acc.name,
      channel: acc.account_category,
      code: acc.account_code,
      balance: acc.current_balance ? acc.current_balance.toString() : "0",
    })),
    recentSales: transactions.filter((transaction) => transaction.type === "sale"),
  };
}

export async function getSettings(businessId, user) {
  return getOwnedBusiness(businessId, user);
}

export async function updateSettings(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  if (data.name !== undefined) {
    const name = String(data.name).trim();
    if (!name) {
      const error = new Error("Business name is required");
      error.statusCode = 400;
      throw error;
    }
    business.name = name;
  }
  if (data.currency !== undefined) {
    const currency = String(data.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      const error = new Error("Currency must be a valid three-letter code");
      error.statusCode = 400;
      throw error;
    }
    business.currency = currency;
  }
  if (data.location !== undefined) business.location = String(data.location).trim() || null;
  if (data.fiscal_year_start !== undefined) business.fiscal_year_start = String(data.fiscal_year_start).trim();
  if (data.tax_settings !== undefined) {
    const rate = Number(data.tax_settings?.vat_rate ?? business.tax_settings.vat_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      const error = new Error("Tax rate must be between 0 and 100");
      error.statusCode = 400;
      throw error;
    }
    business.tax_settings = {
      ...business.tax_settings,
      vat_registered: Boolean(data.tax_settings?.vat_registered),
      vat_rate: rate,
      tax_id: data.tax_settings?.tax_id === undefined ? business.tax_settings.tax_id : String(data.tax_settings.tax_id).trim() || null,
    };
  }
  if (data.mpesa_till !== undefined) business.mpesa_till = String(data.mpesa_till).trim() || null;
  if (data.mpesa_paybill !== undefined) business.mpesa_paybill = String(data.mpesa_paybill).trim() || null;
  await business.save();
  return business;
}

export async function listTransactions(businessId, user, type) {
  const business = await getOwnedBusiness(businessId, user);
  const query = { business_id: business._id, type };
  if (type === "sale") {
    query.status = "completed";
  }
  return BusinessTransaction.find(query).populate("rental_listing_id", "title listing_type").sort({ createdAt: -1 });
}

export async function createTransaction(businessId, user, type, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  assertAmount(data.amount);
  let rentalListingId = data.rentalListingId || data.rental_listing_id || null;
  if (rentalListingId) {
    const rentalListing = await RentalListing.findOne({ _id: rentalListingId, business_id: business._id, archived: false }).select("_id");
    if (!rentalListing) {
      const error = new Error("Rental unit was not found in this business");
      error.statusCode = 404;
      throw error;
    }
    rentalListingId = rentalListing._id;
  }
  const isSale = type === "sale";
  if (data.sendStk && (!isSale || data.paymentChannel !== "mpesa")) {
    const error = new Error("STK Push can only collect an M-Pesa sale");
    error.statusCode = 400;
    throw error;
  }

  const transaction = await BusinessTransaction.create({
    business_id: business._id,
    rental_listing_id: rentalListingId,
    type,
    direction: isSale ? "cash_in" : "cash_out",
    amount: data.amount,
    currency: business.currency,
    payment_channel: data.paymentChannel || "cash",
    status: data.sendStk ? "pending" : "completed",
    description: data.description,
    customer_name: data.customerName,
    customer_phone: data.customerPhone,
    external_reference: data.externalReference,
    created_by: getUserId(user),
  });

  if (!data.sendStk) {
    await onTransactionCompleted(transaction, business);
    return { transaction };
  }

  try {
    const stk = await mpesaService.initiateStkPush({
      amount: data.amount,
      phoneNumber: data.customerPhone,
      accountReference: `SALE-${String(transaction._id).slice(-8)}`,
      transactionDescription: data.description || `Payment to ${business.name}`,
    });
    transaction.checkout_request_id = stk.checkoutRequestId;
    await transaction.save();
    return { transaction, stk };
  } catch (error) {
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
}

export async function initiateStkPush(businessId, user, data) {
  const amount = Number(data.amount);
  const phoneNumber = data.phoneNumber || data.phone;
  const customerName = data.customerName || data.name || "M-Pesa Customer";
  const customerEmail = data.email || data.customerEmail || null;
  const description = data.description || "Business M-Pesa Payment Collection";

  return createTransaction(businessId, user, "sale", {
    amount,
    customerPhone: phoneNumber,
    customerName,
    customerEmail,
    paymentChannel: "mpesa",
    sendStk: true,
    description,
    rentalListingId: data.rentalListingId || data.rental_listing_id,
  });
}

export async function initiateCustomerPayout(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  assertAmount(data.amount);
  if (!data.phoneNumber) {
    const error = new Error("Customer phone number is required");
    error.statusCode = 400;
    throw error;
  }
  const transaction = await BusinessTransaction.create({
    business_id: business._id,
    type: "customer_payout",
    direction: "cash_out",
    amount: data.amount,
    currency: business.currency,
    payment_channel: "mpesa",
    status: "pending",
    description: data.description,
    customer_phone: data.phoneNumber,
    external_reference: data.externalReference,
    created_by: getUserId(user),
  });

  try {
    const payout = await mpesaService.initiateB2cPayment({
      amount: data.amount,
      phoneNumber: data.phoneNumber,
      remarks: data.description || `Payment from ${business.name}`,
      occasion: data.externalReference || "Business payout",
    });
    transaction.external_reference = payout.conversationId || transaction.external_reference;
    await transaction.save();
    return { transaction, payout };
  } catch (error) {
    transaction.status = "failed";
    await transaction.save();
    throw error;
  }
}

// FIX: this function existed but was never called from anywhere, so the STK
// callback Safaricom actually sends for business sales was silently
// dropped - business transactions only ever resolved via the frontend's own
// active status-poll (checkStkStatus below), which is slower and, until the
// bridge added here, gave no instant push at all. Now wired from
// mpesa.controller.js's handleMpesaCallback.
export async function reconcileStkCallback(callback) {
  const transaction = await BusinessTransaction.findOne({ checkout_request_id: callback.checkoutRequestId });
  if (!transaction || transaction.status !== "pending") return false;
  const matchesAmount = Number(callback.amount) === Number(transaction.amount.toString());
  const success = callback.success && matchesAmount;
  transaction.status = success ? "completed" : "failed";
  if (success) {
    transaction.mpesa_receipt_number = callback.mpesaReceiptNumber;
    transaction.external_reference = callback.mpesaReceiptNumber || transaction.external_reference;
    transaction.failure_reason = null;
    const business = await Business.findById(transaction.business_id);
    if (business) {
      await onTransactionCompleted(transaction, business);
    }
  } else {
    transaction.failure_reason = !matchesAmount && callback.success
      ? "M-Pesa confirmed a different amount than expected."
      : callback.reason || "The customer cancelled or failed the M-Pesa PIN prompt.";
  }
  await transaction.save();

  // Instant push - this is the whole point of wiring the callback in.
  emitBusinessTransactionStatus(transaction);

  return true;
}

export async function reconcileB2cResult(result) {
  const transaction = await BusinessTransaction.findOne({ external_reference: result?.Result?.ConversationID, status: "pending" });
  if (!transaction) return false;
  const isSuccess = Number(result.Result.ResultCode) === 0;
  transaction.status = isSuccess ? "completed" : "failed";
  if (isSuccess) {
    const business = await Business.findById(transaction.business_id);
    if (business) {
      await onTransactionCompleted(transaction, business);
    }
  }
  await transaction.save();
  return true;
}

export async function checkStkStatus(businessId, transactionId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const transaction = await BusinessTransaction.findOne({
    _id: transactionId,
    business_id: business._id,
  });

  if (!transaction) {
    const error = new Error("Transaction not found");
    error.statusCode = 404;
    throw error;
  }

  if (transaction.status !== "pending") {
    return { transaction };
  }

  const elapsedMs = Date.now() - new Date(transaction.createdAt).getTime();
  const elapsedSeconds = elapsedMs / 1000;

  try {
    let stkQuery = null;
    if (transaction.checkout_request_id) {
      try {
        stkQuery = await mpesaService.queryStkPush({
          checkoutRequestId: transaction.checkout_request_id,
        });
      } catch (e) {
        console.warn("[Business STK Query] Awaiting customer PIN input...", e.message);
      }
    }

    const resultCode = stkQuery?.resultCode;
    const isSuccess = resultCode === 0 || stkQuery?.mocked === true;
    const isUserCancelled = resultCode === 1032; 
    const isUserFailed = resultCode === 1 || resultCode === 2001; 

    const isMockOrDev =
      process.env.MOCK_MPESA === "true" ||
      process.env.NODE_ENV === "development" ||
      String(transaction.checkout_request_id || "").startsWith("MOCK_CO_");

    if (isSuccess) {
      transaction.status = "completed";
      transaction.mpesa_receipt_number =
        stkQuery?.rawResponse?.MpesaReceiptNumber ||
        transaction.mpesa_receipt_number ||
        `NL${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      transaction.external_reference = transaction.mpesa_receipt_number;
      transaction.failure_reason = null;

      await onTransactionCompleted(transaction, business);
      await transaction.save();
      emitBusinessTransactionStatus(transaction);
    } else if (isUserCancelled || isUserFailed) {
      transaction.status = "failed";
      // Surface M-Pesa's own description (e.g. "The balance is insufficient
      // for the transaction.") instead of a generic message whenever we
      // have it, same as the unified payment system does for everyone else.
      transaction.failure_reason = stkQuery?.resultDescription
        || (isUserCancelled ? "Request cancelled by user." : "The M-Pesa payment failed.");
      await transaction.save();
      emitBusinessTransactionStatus(transaction);
    } else if (isMockOrDev && elapsedSeconds >= 5 && !isUserCancelled) {
      transaction.status = "completed";
      transaction.mpesa_receipt_number =
        transaction.mpesa_receipt_number ||
        `NL${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      transaction.external_reference = transaction.mpesa_receipt_number;
      transaction.failure_reason = null;

      await onTransactionCompleted(transaction, business);
      await transaction.save();
      emitBusinessTransactionStatus(transaction);
    } else if (elapsedSeconds >= 45) {
      transaction.status = "failed";
      transaction.failure_reason = "Payment confirmation timed out. If the customer completed the payment, it will reconcile automatically.";
      await transaction.save();
      emitBusinessTransactionStatus(transaction);
    } else {
      transaction.status = "pending";
    }
  } catch (err) {
    console.error("[Business STK Check Error]", err);
  }

  return { transaction };
}

/**
 * Kitchen prep status â€” separate from payment `status`. Marking an order
 * "ready" never touches payment fields (no fake M-Pesa receipt, no forced
 * completion of an unpaid STK push); it only flips whether the food is done.
 */
export async function setKitchenStatus(businessId, transactionId, user, kitchenStatus) {
  if (!["queued", "ready"].includes(kitchenStatus)) {
    const error = new Error("Invalid kitchen status");
    error.statusCode = 400;
    throw error;
  }

  const business = await getOwnedBusiness(businessId, user, { write: true });
  const transaction = await BusinessTransaction.findOneAndUpdate(
    { _id: transactionId, business_id: business._id, type: "sale" },
    { kitchen_status: kitchenStatus },
    { returnDocument: 'after' }
  );

  if (!transaction) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  return { transaction };
}

export async function forceCompleteTransaction(businessId, transactionId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const transaction = await BusinessTransaction.findOne({
    _id: transactionId,
    business_id: business._id,
  });

  if (!transaction) {
    const error = new Error("Transaction not found");
    error.statusCode = 404;
    throw error;
  }

  if (transaction.status !== "completed") {
    transaction.status = "completed";
    transaction.mpesa_receipt_number = transaction.mpesa_receipt_number || `NL${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    transaction.external_reference = transaction.mpesa_receipt_number;
    await onTransactionCompleted(transaction, business);
    await transaction.save();
  }

  return { transaction };
}

/**
 * ============================================================
 * CUSTOMERS DIRECTORY
 * ============================================================
 */
export async function listCustomers(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  return BusinessCustomer.find({ business_id: business._id }).sort({ last_transaction_at: -1 });
}

export async function createCustomer(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  if (!data.name?.trim()) {
    const error = new Error("Customer name is required");
    error.statusCode = 400;
    throw error;
  }
  return BusinessCustomer.create({
    business_id: business._id,
    name: data.name.trim(),
    phone: data.phone || null,
    email: data.email || null,
    is_auto_registered: false,
  });
}

/**
 * ============================================================
 * SUPPLIERS DIRECTORY
 * ============================================================
 */
export async function listSuppliers(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  return BusinessSupplier.find({ business_id: business._id }).sort({ last_payout_at: -1 });
}

export async function createSupplier(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  if (!data.name?.trim()) {
    const error = new Error("Supplier name is required");
    error.statusCode = 400;
    throw error;
  }
  return BusinessSupplier.create({
    business_id: business._id,
    name: data.name.trim(),
    phone: data.phone || null,
    email: data.email || null,
    contact_person: data.contact_person || null,
    is_auto_registered: false,
  });
}

/**
 * ============================================================
 * FINANCIAL ACCOUNTS (Cash / Bank / M-Pesa) â€” POS & Reports read from these
 * ============================================================
 */
export async function getBusinessAccounts(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  const ownerType = business.isGroup ? "ContributionGroup" : "Business";
  const accountsMap = await ensureBusinessAccounts(business._id, getUserId(user), ownerType);
  return Object.values(accountsMap);
}

/**
 * ============================================================
 * INVENTORY & STOCK MANAGEMENT ("One inventory, two faces")
 * ============================================================
 */
const DEFAULT_INVENTORY_SEED = [
  { name: "Dish Soap 750ml", sku: "SKU-1042", category: "Household", description: "Lemon scent, cuts grease fast.", price: 260, online_price: 260, quantity: 42, visible_online: true, icon: "ðŸ§´" },
  { name: "Instant Coffee 200g", sku: "SKU-2210", category: "Beverages", description: "Rich roast, resealable tin.", price: 890, online_price: 890, quantity: 6, visible_online: true, icon: "â˜•" },
  { name: "Wireless Earbuds", sku: "SKU-5581", category: "Electronics", description: "Bluetooth 5.0, 20hr battery.", price: 3200, online_price: 3200, quantity: 0, visible_online: true, icon: "ðŸŽ§" },
  { name: "Boiled Sweets 1kg", sku: "SKU-0087", category: "Snacks", description: "Assorted fruit flavours.", price: 340, online_price: 340, quantity: 118, visible_online: true, icon: "ðŸ¬" },
  { name: "Tissue Pack (6)", sku: "SKU-3305", category: "Household", description: "Soft 2-ply, 200 sheets each.", price: 450, online_price: 450, quantity: 27, visible_online: true, icon: "ðŸ§»" },
  { name: "Extension Cable 3m", sku: "SKU-7712", category: "Electronics", description: "3-socket, surge protected.", price: 780, online_price: 780, quantity: 4, visible_online: true, icon: "ðŸ”Œ" },
];

export async function listInventoryItems(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  let items = await BusinessItem.find({ business_id: business._id, status: "active" }).sort({ createdAt: -1 });

  // Lazy-seed initial inventory items if empty (rentals don't use a product
  // catalogue at all â€” they manage rooms/plots via RentalListing instead)
  if (items.length === 0 && ["retail", "other"].includes(business.category)) {
    const seeded = DEFAULT_INVENTORY_SEED.map((item) => ({
      ...item,
      business_id: business._id,
    }));
    items = await BusinessItem.insertMany(seeded);
  }
  await approveUnreviewedInventoryListings(business).catch(() => {});
  return attachMarketplaceState(items);
}

export async function createInventoryItem(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  if (!data.name?.trim()) {
    const error = new Error("Item name is required");
    error.statusCode = 400;
    throw error;
  }
  const created = await BusinessItem.create({
    business_id: business._id,
    name: data.name.trim(),
    sku: data.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    category: data.category || "General",
    description: data.description || "",
    price: Number(data.price || 0),
    online_price: data.online_price !== undefined && data.online_price !== null ? Number(data.online_price) : Number(data.price || 0),
    cost_price: Number(data.cost_price || 0),
    quantity: Number(data.quantity || 0),
    track_stock: data.track_stock !== undefined ? Boolean(data.track_stock) : true,
    visible_online: data.visible_online !== undefined ? Boolean(data.visible_online) : true,
    icon: data.icon || "ðŸ“¦",
    image_url: data.image_url || "",
  });

  // "Add and publish" in one step. The item is already saved, so if
  // publishing is refused (e.g. not enrolled yet) it simply stays unpublished
  // and the reason is returned instead of losing what the seller typed.
  if (data.publish_to_marketplace === true) {
    try {
      await publishItemToMarketplace(business, created);
    } catch (error) {
      const [withState] = await attachMarketplaceState([created]);
      return { ...withState, publish_error: { message: error.message, code: error.code || null } };
    }
  }
  const [withState] = await attachMarketplaceState([created]);
  return withState;
}

export async function updateInventoryItem(businessId, itemId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const item = await BusinessItem.findOne({ _id: itemId, business_id: business._id });
  if (!item) {
    const error = new Error("Item not found");
    error.statusCode = 404;
    throw error;
  }

  if (data.name !== undefined) item.name = data.name.trim();
  if (data.sku !== undefined) item.sku = data.sku;
  if (data.category !== undefined) item.category = data.category;
  if (data.description !== undefined) item.description = data.description;
  if (data.price !== undefined) item.price = Number(data.price);
  if (data.online_price !== undefined) item.online_price = data.online_price !== null ? Number(data.online_price) : null;
  if (data.cost_price !== undefined) item.cost_price = Number(data.cost_price);
  if (data.quantity !== undefined) item.quantity = Number(data.quantity);
  if (data.track_stock !== undefined) item.track_stock = Boolean(data.track_stock);
  if (data.visible_online !== undefined) item.visible_online = Boolean(data.visible_online);
  if (data.icon !== undefined) item.icon = data.icon;
  if (data.image_url !== undefined) item.image_url = data.image_url;
  if (data.status !== undefined) item.status = data.status;

  await item.save();
  // Name, description, price, photo, stock and visibility all follow the item.
  await syncItemToListings(item);
  const [withState] = await attachMarketplaceState([item]);
  return withState;
}

export async function deleteInventoryItem(businessId, itemId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  await archiveItemListings(business._id, itemId);
  await BusinessItem.deleteOne({ _id: itemId, business_id: business._id });
  return { success: true };
}

/** Publish one inventory item to the marketplace (creates or refreshes its listing). */
export async function publishInventoryItemToMarketplace(businessId, itemId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const item = await BusinessItem.findOne({ _id: itemId, business_id: business._id });
  if (!item) {
    const error = new Error("Item not found");
    error.statusCode = 404;
    throw error;
  }
  await publishItemToMarketplace(business, item);
  const [withState] = await attachMarketplaceState([item]);
  return withState;
}

export async function unpublishInventoryItemFromMarketplace(businessId, itemId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const item = await BusinessItem.findOne({ _id: itemId, business_id: business._id });
  if (!item) {
    const error = new Error("Item not found");
    error.statusCode = 404;
    throw error;
  }
  await unpublishItemFromMarketplace(business, item);
  const [withState] = await attachMarketplaceState([item]);
  return withState;
}

/** Publish several (or all active) inventory items at once. */
export async function publishInventoryBulkToMarketplace(businessId, user, itemIds = []) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const ids = Array.isArray(itemIds) ? itemIds.filter((id) => mongoose.isValidObjectId(id)) : [];
  const { published, skipped } = await publishItemsToMarketplace(business, ids);
  return { published, skipped };
}

/** Restock â€” add (or set) stock quantity without touching any other field */
export async function restockInventoryItem(businessId, itemId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const item = await BusinessItem.findOne({ _id: itemId, business_id: business._id });
  if (!item) {
    const error = new Error("Item not found");
    error.statusCode = 404;
    throw error;
  }

  const addQty = Number(data.add_quantity ?? data.addQuantity ?? 0);
  const setQty = data.set_quantity ?? data.setQuantity;

  if (setQty !== undefined && setQty !== null) {
    item.quantity = Math.max(0, Number(setQty));
  } else {
    if (!Number.isFinite(addQty) || addQty <= 0) {
      const error = new Error("Provide a positive quantity to restock");
      error.statusCode = 400;
      throw error;
    }
    item.quantity = Math.max(0, item.quantity + addQty);
  }

  if (data.cost_price !== undefined) item.cost_price = Number(data.cost_price);
  await item.save();
  await syncItemToListings(item);
  return item;
}

/**
 * ============================================================
 * POINT OF SALE (POS) â€” in-person checkout that writes to the
 * SAME BusinessItem stock + BusinessTransaction ledger as the
 * marketplace listings ("one inventory, two faces").
 * ============================================================
 */
export async function createPosSale(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });

  if (!Array.isArray(data.items) || data.items.length === 0) {
    const error = new Error("Sale must contain at least one item");
    error.statusCode = 400;
    throw error;
  }

  const paymentChannel = ["cash", "bank", "till", "paybill", "mpesa"].includes(data.payment_channel)
    ? data.payment_channel
    : "cash";

  // Validate stock availability for every line BEFORE mutating anything
  const lineItems = [];
  let subtotal = 0;
  for (const requested of data.items) {
    const item = await BusinessItem.findOne({
      _id: requested.item_id || requested.id,
      business_id: business._id,
    });

    if (!item) {
      const error = new Error("One or more items were not found in inventory");
      error.statusCode = 400;
      throw error;
    }

    const qty = Math.max(1, Number(requested.qty || requested.quantity || 1));
    if (item.track_stock !== false && item.quantity < qty) {
      const error = new Error(`"${item.name}" only has ${item.quantity} unit(s) left in stock`);
      error.statusCode = 400;
      throw error;
    }

    const unitPrice = item.price;
    const lineTotal = unitPrice * qty;
    subtotal += lineTotal;
    lineItems.push({ item, qty, unitPrice, lineTotal });
  }

  const discount = Math.max(0, Number(data.discount || 0));
  const totalAmount = Math.max(0, subtotal - discount);
  assertAmount(totalAmount);

  const receiptTag = newPosReceiptNumber();
  const itemSummary = lineItems.map((l) => `${l.qty}x ${l.item.name}`).join(", ");

  // Deduct live stock now â€” same moment the sale is recorded, so the
  // POS grid and Inventory & Stock page never disagree on what's left.
  for (const l of lineItems) {
    if (l.item.track_stock === false) continue;
    l.item.quantity = Math.max(0, l.item.quantity - l.qty);
    await l.item.save();
    // Keep the online listing's stock in step with what the till just sold.
    await syncItemToListings(l.item);
  }

  const transaction = await BusinessTransaction.create({
    business_id: business._id,
    type: "sale",
    direction: "cash_in",
    amount: totalAmount,
    currency: business.currency,
    payment_channel: paymentChannel,
    status: "completed",
    description: data.description || `POS Sale â€” ${itemSummary}`,
    customer_name: data.customer_name || null,
    customer_phone: data.customer_phone || null,
    external_reference: receiptTag,
    receipt: {
      items: lineItems.map((l) => ({ item_id: l.item._id, name: l.item.name, qty: l.qty, price: l.unitPrice, total: l.lineTotal })),
      subtotal,
      discount,
    },
    created_by: getUserId(user),
  });

  await onTransactionCompleted(transaction, business);

  // Optional courtesy STK push when the buyer wants to pay by M-Pesa â€”
  // the sale is already recorded, this just requests the actual payment.
  let stk = null;
  if (paymentChannel === "mpesa" && data.customer_phone) {
    try {
      stk = await mpesaService.initiateStkPush({
        amount: totalAmount,
        phoneNumber: data.customer_phone,
        accountReference: receiptTag,
        transactionDescription: `POS Sale at ${business.name}`,
      });
    } catch (e) {
      console.warn("[POS M-Pesa STK Error]", e.message);
    }
  }

  if (stk) {
    transaction.receipt.mpesa_prompt_sent = true;
    await transaction.save();
  }

  return {
    transaction,
    receipt_number: receiptTag,
    receipt: buildPosReceipt(business, transaction, { cashierName: user?.name || null }),
    items: lineItems.map((l) => ({
      item_id: l.item._id,
      name: l.item.name,
      qty: l.qty,
      price: l.unitPrice,
      total: l.lineTotal,
    })),
    subtotal,
    discount,
    total: totalAmount,
    stk,
  };
}

/**
 * Reprint: rebuild the receipt for a POS sale from its stored snapshot.
 * Read access is enough (anyone who can view the business can reprint).
 */
export async function getPosReceipt(businessId, transactionId, user) {
  const business = await getOwnedBusiness(businessId, user);
  if (!mongoose.isValidObjectId(transactionId)) {
    const error = new Error("Receipt not found");
    error.statusCode = 404;
    throw error;
  }
  const transaction = await BusinessTransaction.findOne({
    _id: transactionId, business_id: business._id, type: "sale",
  });
  if (!transaction || !transaction.receipt?.items?.length) {
    const error = new Error("Receipt not found for this sale");
    error.statusCode = 404;
    throw error;
  }
  const cashier = await User.findById(transaction.created_by).select("name").lean();
  return buildPosReceipt(business, transaction, { cashierName: cashier?.name || null });
}

/**
 * ============================================================
 * RENTAL LISTINGS (rooms & plots for rental-category businesses)
 * "One listing catalogue, two faces" â€” same pattern as inventory:
 * the owner manages it here, the marketplace reads from it.
 * ============================================================
 */
export async function listRentalListings(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  return RentalListing.find({ business_id: business._id, archived: false }).sort({ createdAt: -1 });
}

export async function createRentalListing(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  if (!data.title?.trim()) {
    const error = new Error("Listing title is required");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(Number(data.rent_amount)) || Number(data.rent_amount) <= 0) {
    const error = new Error("A positive rent amount is required");
    error.statusCode = 400;
    throw error;
  }

  return RentalListing.create({
    business_id: business._id,
    listing_type: ["room", "plot"].includes(data.listing_type) ? data.listing_type : "room",
    title: data.title.trim(),
    description: data.description || "",
    location_text: data.location_text || "",
    bedrooms: data.bedrooms !== undefined && data.bedrooms !== null && data.bedrooms !== "" ? Number(data.bedrooms) : null,
    bathrooms: data.bathrooms !== undefined && data.bathrooms !== null && data.bathrooms !== "" ? Number(data.bathrooms) : null,
    size_text: data.size_text || "",
    rent_amount: Number(data.rent_amount),
    rent_period: ["month", "year", "one_time"].includes(data.rent_period) ? data.rent_period : "month",
    deposit_amount: Number(data.deposit_amount || 0),
    amenities: Array.isArray(data.amenities) ? data.amenities : [],
    images: Array.isArray(data.images) ? data.images.slice(0, 8) : [],
    status: data.status === "occupied" ? "occupied" : "vacant",
    visible_online: data.visible_online !== undefined ? Boolean(data.visible_online) : true,
  });
}

export async function updateRentalListing(businessId, listingId, user, data) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const listing = await RentalListing.findOne({ _id: listingId, business_id: business._id });
  if (!listing) {
    const error = new Error("Listing not found");
    error.statusCode = 404;
    throw error;
  }

  if (data.listing_type !== undefined && ["room", "plot"].includes(data.listing_type)) listing.listing_type = data.listing_type;
  if (data.title !== undefined) listing.title = data.title.trim();
  if (data.description !== undefined) listing.description = data.description;
  if (data.location_text !== undefined) listing.location_text = data.location_text;
  if (data.bedrooms !== undefined) listing.bedrooms = data.bedrooms === "" || data.bedrooms === null ? null : Number(data.bedrooms);
  if (data.bathrooms !== undefined) listing.bathrooms = data.bathrooms === "" || data.bathrooms === null ? null : Number(data.bathrooms);
  if (data.size_text !== undefined) listing.size_text = data.size_text;
  if (data.rent_amount !== undefined) listing.rent_amount = Number(data.rent_amount);
  if (data.rent_period !== undefined && ["month", "year", "one_time"].includes(data.rent_period)) listing.rent_period = data.rent_period;
  if (data.deposit_amount !== undefined) listing.deposit_amount = Number(data.deposit_amount);
  if (data.amenities !== undefined && Array.isArray(data.amenities)) listing.amenities = data.amenities;
  if (data.images !== undefined && Array.isArray(data.images)) listing.images = data.images.slice(0, 8);
  if (data.status !== undefined && ["vacant", "occupied"].includes(data.status)) listing.status = data.status;
  if (data.visible_online !== undefined) listing.visible_online = Boolean(data.visible_online);

  await listing.save();
  const marketplaceFields = {
    title: listing.title,
    description: listing.description,
    price: listing.rent_amount,
    "rental_attributes.bedrooms": listing.bedrooms,
    "rental_attributes.bathrooms": listing.bathrooms,
    "rental_attributes.deposit_amount": listing.deposit_amount,
    "rental_attributes.rent_period": listing.rent_period,
    "rental_attributes.location_text": listing.location_text,
    "rental_attributes.is_occupied": listing.status === "occupied",
    stock: listing.status === "occupied" ? 0 : 1,
  };
  marketplaceFields.visibility = listing.visible_online && listing.status === "vacant" ? "public" : "unlisted";
  await MarketplaceListing.updateMany(
    { business_id: business._id, source_type: "RentalListing", source_id: listing._id, visibility: { $ne: "archived" } },
    { $set: marketplaceFields }
  );
  return listing;
}

/** Quick vacant/occupied toggle â€” the rental equivalent of "restock" */
export async function updateRentalListingStatus(businessId, listingId, user, status) {
  if (!["vacant", "occupied"].includes(status)) {
    const error = new Error("Status must be 'vacant' or 'occupied'");
    error.statusCode = 400;
    throw error;
  }
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const listing = await RentalListing.findOne({ _id: listingId, business_id: business._id });
  if (!listing) {
    const error = new Error("Listing not found");
    error.statusCode = 404;
    throw error;
  }
  listing.status = status;
  await listing.save();
  await MarketplaceListing.updateMany(
    { business_id: business._id, source_type: "RentalListing", source_id: listing._id, visibility: { $ne: "archived" } },
    { $set: {
      "rental_attributes.is_occupied": status === "occupied",
      stock: status === "occupied" ? 0 : 1,
      visibility: listing.visible_online && status === "vacant" ? "public" : "unlisted",
    } }
  );
  return listing;
}

export async function deleteRentalListing(businessId, listingId, user) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const listing = await RentalListing.findOneAndUpdate(
    { _id: listingId, business_id: business._id, archived: false },
    { $set: { archived: true, visible_online: false } },
    { returnDocument: 'after' }
  );
  if (!listing) {
    const error = new Error("Rental listing not found");
    error.statusCode = 404;
    throw error;
  }
  await MarketplaceListing.updateMany(
    { business_id: business._id, source_type: "RentalListing", source_id: listing._id },
    { $set: { visibility: "archived" } }
  );
  return { success: true };
}

/** Staff: rental enquiry leads for this business */
export async function listRentalInquiries(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  return RentalInquiry.find({ business_id: business._id })
    .populate("listing_id", "title listing_type")
    .sort({ createdAt: -1 });
}

export async function updateRentalInquiryStatus(businessId, inquiryId, user, status) {
  const business = await getOwnedBusiness(businessId, user, { write: true });
  const inquiry = await RentalInquiry.findOne({ _id: inquiryId, business_id: business._id });
  if (!inquiry) {
    const error = new Error("Inquiry not found");
    error.statusCode = 404;
    throw error;
  }
  if (["new", "contacted", "closed"].includes(status)) {
    inquiry.status = status;
    await inquiry.save();
  }
  return inquiry;
}
