import mongoose from "mongoose";
import Business from "../../models/Business.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import BusinessCustomer from "../../models/BusinessCustomer.js";
import BusinessSupplier from "../../models/BusinessSupplier.js";
import FinancialAccount from "../../models/FinancialAccount.js";
import FinancialTransaction from "../../models/FinancialTransaction.js";
import LedgerEntry from "../../models/LedgerEntry.js";
import ContributionGroup from "../../models/ContributionGroup.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";
import { sendBusinessReceiptEmail } from "../../services/notifications/email.service.js";

const getUserId = (user) => user?._id || user?.id;

async function getOwnedBusiness(businessId, user) {
  let business = await Business.findOne({ _id: businessId });
  if (business) return business;

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

  const error = new Error("Workspace not found or access denied");
  error.statusCode = 404;
  throw error;
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
async function ensureBusinessAccounts(businessId, createdBy, ownerType = "Business") {
  const accountsDef = [
    { name: "Cash Wallet", account_code: "CASH", system_key: "cash", account_type: "asset", normal_balance: "debit", account_category: "cash" },
    { name: "Bank Account", account_code: "BANK", system_key: "bank", account_type: "asset", normal_balance: "debit", account_category: "bank" },
    { name: "M-Pesa Till & Paybill", account_code: "MPESA_TILL", system_key: "till", account_type: "asset", normal_balance: "debit", account_category: "mpesa" },
    { name: ownerType === "ContributionGroup" ? "Member Contributions" : "Sales Revenue", account_code: ownerType === "ContributionGroup" ? "MEMBER_CONTRIBUTIONS" : "SALES_REVENUE", system_key: ownerType === "ContributionGroup" ? "member_contributions" : "sales_revenue", account_type: "income", normal_balance: "credit", account_category: "income" },
    { name: "Operating Expenses", account_code: "OPERATING_EXPENSES", system_key: "operating_expenses", account_type: "expense", normal_balance: "debit", account_category: "expense" },
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
}

export async function createBusiness(data, user) {
  if (!data.name?.trim()) {
    const error = new Error("Business name is required");
    error.statusCode = 400;
    throw error;
  }
  const business = await Business.create({
    name: data.name,
    category: data.category,
    currency: data.currency,
    mpesa_till: data.mPesaTill || null,
    mpesa_paybill: data.mPesaPaybill || null,
    created_by: getUserId(user),
  });

  await ensureBusinessAccounts(business._id, getUserId(user));
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

  return {
    profile: business,
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

export async function listTransactions(businessId, user, type) {
  const business = await getOwnedBusiness(businessId, user);
  const query = { business_id: business._id, type };
  if (type === "sale") {
    query.status = "completed";
  }
  return BusinessTransaction.find(query).sort({ createdAt: -1 });
}

export async function createTransaction(businessId, user, type, data) {
  const business = await getOwnedBusiness(businessId, user);
  assertAmount(data.amount);
  const isSale = type === "sale";
  if (data.sendStk && (!isSale || data.paymentChannel !== "mpesa")) {
    const error = new Error("STK Push can only collect an M-Pesa sale");
    error.statusCode = 400;
    throw error;
  }

  const transaction = await BusinessTransaction.create({
    business_id: business._id,
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
  });
}

export async function initiateCustomerPayout(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user);
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
    const payout = await mpesaService.initiateB2c({
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

export async function reconcileStkCallback(callback) {
  const transaction = await BusinessTransaction.findOne({ checkout_request_id: callback.checkoutRequestId });
  if (!transaction || transaction.status !== "pending") return false;
  const matchesAmount = Number(callback.amount) === Number(transaction.amount.toString());
  transaction.status = callback.success && matchesAmount ? "completed" : "failed";
  if (transaction.status === "completed") {
    transaction.mpesa_receipt_number = callback.mpesaReceiptNumber;
    transaction.external_reference = callback.mpesaReceiptNumber || transaction.external_reference;
    const business = await Business.findById(transaction.business_id);
    if (business) {
      await onTransactionCompleted(transaction, business);
    }
  }
  await transaction.save();
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
  const business = await getOwnedBusiness(businessId, user);
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

      await onTransactionCompleted(transaction, business);
      await transaction.save();
    } else if (isUserCancelled || isUserFailed) {
      transaction.status = "failed";
      await transaction.save();
    } else if (isMockOrDev && elapsedSeconds >= 5 && !isUserCancelled) {
      transaction.status = "completed";
      transaction.mpesa_receipt_number =
        transaction.mpesa_receipt_number ||
        `NL${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      transaction.external_reference = transaction.mpesa_receipt_number;

      await onTransactionCompleted(transaction, business);
      await transaction.save();
    } else if (elapsedSeconds >= 45) {
      transaction.status = "failed";
      await transaction.save();
    } else {
      transaction.status = "pending";
    }
  } catch (err) {
    console.error("[Business STK Check Error]", err);
  }

  return { transaction };
}

export async function forceCompleteTransaction(businessId, transactionId, user) {
  const business = await getOwnedBusiness(businessId, user);
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
  const business = await getOwnedBusiness(businessId, user);
  if (!data.name?.trim()) {
    const error = new Error("Customer name is required");
    error.statusCode = 400;
    throw error;
  }
  return BusinessCustomer.create({
    business_id: business._id,
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    is_auto_registered: true,
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
  const business = await getOwnedBusiness(businessId, user);
  if (!data.name?.trim()) {
    const error = new Error("Supplier name is required");
    error.statusCode = 400;
    throw error;
  }
  return BusinessSupplier.create({
    business_id: business._id,
    name: data.name,
    phone: data.phone || null,
    email: data.email || null,
    contact_person: data.contactPerson || null,
    is_auto_registered: true,
  });
}

/**
 * ============================================================
 * FINANCIAL ACCOUNTS DIRECTORY
 * ============================================================
 */
export async function getBusinessAccounts(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  await ensureBusinessAccounts(business._id, getUserId(user));
  return FinancialAccount.find({ owner_type: "Business", owner_id: business._id, status: "active" }).sort({ account_code: 1 });
}