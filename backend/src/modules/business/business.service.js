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
import BusinessItem from "../../models/BusinessItem.js";
import Storefront from "../../models/Storefront.js";
import StorefrontOrder from "../../models/StorefrontOrder.js";

/**
 * ============================================================
 * INVENTORY & STOCK MANAGEMENT ("One inventory, two faces")
 * ============================================================
 */
const DEFAULT_INVENTORY_SEED = [
  { name: "Dish Soap 750ml", sku: "SKU-1042", category: "Household", description: "Lemon scent, cuts grease fast.", price: 260, online_price: 260, quantity: 42, visible_online: true, icon: "🧴" },
  { name: "Instant Coffee 200g", sku: "SKU-2210", category: "Beverages", description: "Rich roast, resealable tin.", price: 890, online_price: 890, quantity: 6, visible_online: true, icon: "☕" },
  { name: "Wireless Earbuds", sku: "SKU-5581", category: "Electronics", description: "Bluetooth 5.0, 20hr battery.", price: 3200, online_price: 3200, quantity: 0, visible_online: true, icon: "🎧" },
  { name: "Boiled Sweets 1kg", sku: "SKU-0087", category: "Snacks", description: "Assorted fruit flavours.", price: 340, online_price: 340, quantity: 118, visible_online: true, icon: "🍬" },
  { name: "Tissue Pack (6)", sku: "SKU-3305", category: "Household", description: "Soft 2-ply, 200 sheets each.", price: 450, online_price: 450, quantity: 27, visible_online: true, icon: "🧻" },
  { name: "Extension Cable 3m", sku: "SKU-7712", category: "Electronics", description: "3-socket, surge protected.", price: 780, online_price: 780, quantity: 4, visible_online: true, icon: "🔌" },
];

export async function listInventoryItems(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  let items = await BusinessItem.find({ business_id: business._id, status: "active" }).sort({ createdAt: -1 });
  
  // Lazy-seed initial inventory items if empty
  if (items.length === 0) {
    const seeded = DEFAULT_INVENTORY_SEED.map((item) => ({
      ...item,
      business_id: business._id,
    }));
    items = await BusinessItem.insertMany(seeded);
  }
  return items;
}

export async function createInventoryItem(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user);
  if (!data.name?.trim()) {
    const error = new Error("Item name is required");
    error.statusCode = 400;
    throw error;
  }
  return BusinessItem.create({
    business_id: business._id,
    name: data.name.trim(),
    sku: data.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    category: data.category || "General",
    description: data.description || "",
    price: Number(data.price || 0),
    online_price: data.online_price !== undefined && data.online_price !== null ? Number(data.online_price) : Number(data.price || 0),
    cost_price: Number(data.cost_price || 0),
    quantity: Number(data.quantity || 0),
    visible_online: data.visible_online !== undefined ? Boolean(data.visible_online) : true,
    icon: data.icon || "📦",
    image_url: data.image_url || "",
  });
}

export async function updateInventoryItem(businessId, itemId, user, data) {
  const business = await getOwnedBusiness(businessId, user);
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
  if (data.visible_online !== undefined) item.visible_online = Boolean(data.visible_online);
  if (data.icon !== undefined) item.icon = data.icon;
  if (data.image_url !== undefined) item.image_url = data.image_url;
  if (data.status !== undefined) item.status = data.status;

  await item.save();
  return item;
}

export async function deleteInventoryItem(businessId, itemId, user) {
  const business = await getOwnedBusiness(businessId, user);
  await BusinessItem.deleteOne({ _id: itemId, business_id: business._id });
  return { success: true };
}

/**
 * ============================================================
 * POINT OF SALE (POS) — in-person checkout that writes to the
 * SAME BusinessItem stock + BusinessTransaction ledger as the
 * online storefront ("one inventory, two faces").
 * ============================================================
 */
export async function createPosSale(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user);

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
    if (item.quantity < qty) {
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

  const receiptTag = `POS-${Math.floor(1000 + Math.random() * 9000)}`;
  const itemSummary = lineItems.map((l) => `${l.qty}x ${l.item.name}`).join(", ");

  // Deduct live stock now — same moment the sale is recorded, so the
  // POS grid and Inventory & Stock page never disagree on what's left.
  for (const l of lineItems) {
    l.item.quantity = Math.max(0, l.item.quantity - l.qty);
    await l.item.save();
  }

  const transaction = await BusinessTransaction.create({
    business_id: business._id,
    type: "sale",
    direction: "cash_in",
    amount: totalAmount,
    currency: business.currency,
    payment_channel: paymentChannel,
    status: "completed",
    description: data.description || `POS Sale — ${itemSummary}`,
    customer_name: data.customer_name || null,
    customer_phone: data.customer_phone || null,
    external_reference: receiptTag,
    created_by: getUserId(user),
  });

  await onTransactionCompleted(transaction, business);

  // Optional courtesy STK push when the buyer wants to pay by M-Pesa —
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

  return {
    transaction,
    receipt_number: receiptTag,
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
 * ============================================================
 * STOREFRONT CONFIGURATION & PUBLIC E-COMMERCE ENDPOINTS
 * ============================================================
 */
function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function getOrCreateStorefront(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  let storefront = await Storefront.findOne({ business_id: business._id });
  if (!storefront) {
    const baseSlug = slugify(business.name) || `store-${String(business._id).slice(-6)}`;
    storefront = await Storefront.create({
      business_id: business._id,
      slug: baseSlug,
      name: business.name || "Jane's Wholesale Mart",
    });
  }
  return storefront;
}

export async function updateStorefront(businessId, user, data) {
  const business = await getOwnedBusiness(businessId, user);
  let storefront = await Storefront.findOne({ business_id: business._id });
  if (!storefront) {
    storefront = new Storefront({ business_id: business._id });
  }

  if (data.slug?.trim()) {
    const newSlug = slugify(data.slug);
    const existing = await Storefront.findOne({ slug: newSlug, business_id: { $ne: business._id } });
    if (existing) {
      const error = new Error("Storefront URL slug is already taken by another business");
      error.statusCode = 400;
      throw error;
    }
    storefront.slug = newSlug;
  }

  if (data.name !== undefined) storefront.name = data.name.trim();
  if (data.location_text !== undefined) storefront.location_text = data.location_text.trim();
  if (data.headline !== undefined) storefront.headline = data.headline.trim();
  if (data.subtitle !== undefined) storefront.subtitle = data.subtitle.trim();
  if (data.status !== undefined) storefront.status = data.status;
  if (data.theme !== undefined) storefront.theme = { ...storefront.theme, ...data.theme };
  if (data.badges !== undefined && Array.isArray(data.badges)) storefront.badges = data.badges;

  await storefront.save();
  return storefront;
}

/** PUBLIC storefront view by slug (No authentication required) */
export async function getPublicStorefrontBySlug(slug) {
  const cleanSlug = slugify(slug);
  const storefront = await Storefront.findOne({ slug: cleanSlug });
  if (!storefront || storefront.status === "paused") {
    const error = new Error("Storefront not found or currently offline");
    error.statusCode = 404;
    throw error;
  }

  const business = await Business.findById(storefront.business_id);
  if (!business) {
    const error = new Error("Business not found");
    error.statusCode = 404;
    throw error;
  }

  // Ensure inventory items exist
  let rawItems = await BusinessItem.find({
    business_id: business._id,
    status: "active",
    visible_online: true,
  }).sort({ createdAt: -1 });

  if (rawItems.length === 0) {
    const seeded = DEFAULT_INVENTORY_SEED.map((item) => ({
      ...item,
      business_id: business._id,
    }));
    rawItems = await BusinessItem.insertMany(seeded);
  }

  const publicItems = rawItems.map((item) => ({
    _id: item._id,
    id: item._id,
    name: item.name,
    sku: item.sku,
    category: item.category,
    description: item.description,
    price: item.online_price !== null && item.online_price !== undefined ? item.online_price : item.price,
    in_store_price: item.price,
    quantity: item.quantity,
    in_stock: item.quantity > 0,
    low_stock: item.quantity > 0 && item.quantity <= 10,
    icon: item.icon,
    image_url: item.image_url,
  }));

  return {
    storefront,
    business: {
      _id: business._id,
      name: business.name,
      category: business.category,
      currency: business.currency,
    },
    items: publicItems,
  };
}

/** PUBLIC Order Placement (No account required, deducts live stock, registers customer) */
export async function createStorefrontOrder(slug, data) {
  const cleanSlug = slugify(slug);
  const storefront = await Storefront.findOne({ slug: cleanSlug });
  if (!storefront || storefront.status === "paused") {
    const error = new Error("Storefront not found or unavailable");
    error.statusCode = 404;
    throw error;
  }

  const business = await Business.findById(storefront.business_id);
  if (!business) {
    const error = new Error("Business not found");
    error.statusCode = 404;
    throw error;
  }

  if (!data.customer_name?.trim() || !data.customer_phone?.trim()) {
    const error = new Error("Customer name and phone number are required to place an order");
    error.statusCode = 400;
    throw error;
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    const error = new Error("Order must contain at least one item");
    error.statusCode = 400;
    throw error;
  }

  // Validate stock and compute totals
  const orderItems = [];
  let calculatedSubtotal = 0;

  for (const requestedItem of data.items) {
    const item = await BusinessItem.findOne({
      _id: requestedItem.item_id || requestedItem.id,
      business_id: business._id,
    });

    if (!item) {
      const error = new Error(`Item not found in business inventory`);
      error.statusCode = 400;
      throw error;
    }

    const qty = Math.max(1, Number(requestedItem.qty || 1));
    if (item.quantity < qty) {
      const error = new Error(`Sorry, "${item.name}" only has ${item.quantity} units remaining in stock.`);
      error.statusCode = 400;
      throw error;
    }

    const price = item.online_price !== null && item.online_price !== undefined ? item.online_price : item.price;
    const lineTotal = price * qty;
    calculatedSubtotal += lineTotal;

    orderItems.push({
      item_id: item._id,
      name: item.name,
      qty,
      price,
      total: lineTotal,
      dbItem: item,
    });
  }

  // Generate short order code e.g. ORD-9823
  const orderCode = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
  const deliveryFee = data.fulfillment_type === "delivery" ? Number(data.delivery_fee || 0) : 0;
  const totalAmount = calculatedSubtotal + deliveryFee;

  // Create Order
  const order = await StorefrontOrder.create({
    business_id: business._id,
    storefront_id: storefront._id,
    order_code: orderCode,
    channel: "online",
    customer_name: data.customer_name.trim(),
    customer_phone: data.customer_phone.trim(),
    customer_email: data.customer_email || "",
    delivery_address: data.delivery_address || "Store Pickup",
    fulfillment_type: data.fulfillment_type || "delivery",
    fulfillment_status: "pending",
    items: orderItems.map((i) => ({
      item_id: i.item_id,
      name: i.name,
      qty: i.qty,
      price: i.price,
      total: i.total,
    })),
    subtotal: calculatedSubtotal,
    delivery_fee: deliveryFee,
    total_amount: totalAmount,
    payment_method: data.payment_method || "mpesa",
    payment_status: data.payment_method === "cash_on_delivery" ? "pending" : "pending",
  });

  // Deduct live stock levels!
  for (const oItem of orderItems) {
    oItem.dbItem.quantity = Math.max(0, oItem.dbItem.quantity - oItem.qty);
    await oItem.dbItem.save();
  }

  // Create internal BusinessTransaction sale record & post to double-entry ledger!
  const transaction = await BusinessTransaction.create({
    business_id: business._id,
    type: "sale",
    direction: "cash_in",
    amount: totalAmount,
    currency: business.currency,
    payment_channel: data.payment_method === "cash_on_delivery" ? "cash" : "mpesa",
    status: "completed",
    description: `Online Order #${orderCode} - ${data.customer_name}`,
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    external_reference: orderCode,
    created_by: business.created_by,
  });

  await onTransactionCompleted(transaction, business);

  // If M-Pesa STK Push requested, initiate STK
  let stk = null;
  if (data.payment_method === "mpesa" && data.customer_phone) {
    try {
      stk = await mpesaService.initiateStkPush({
        amount: totalAmount,
        phoneNumber: data.customer_phone,
        accountReference: orderCode,
        transactionDescription: `Order ${orderCode} at ${business.name}`,
      });
      order.checkout_request_id = stk.checkoutRequestId;
      await order.save();
    } catch (e) {
      console.warn("[Storefront M-Pesa STK Error]", e.message);
    }
  }

  return { order, order_code: orderCode, stk };
}

/** PUBLIC Order Tracking (by order code & phone number) */
export async function trackStorefrontOrder(orderCode, phone) {
  if (!orderCode?.trim()) {
    const error = new Error("Order code is required");
    error.statusCode = 400;
    throw error;
  }

  const query = { order_code: orderCode.trim().toUpperCase() };
  if (phone?.trim()) {
    const cleanPhone = phone.trim();
    query.customer_phone = { $regex: cleanPhone.slice(-8), $options: "i" };
  }

  const order = await StorefrontOrder.findOne(query);
  if (!order) {
    const error = new Error("Order not found. Please verify your order code and phone number.");
    error.statusCode = 404;
    throw error;
  }

  const storefront = await Storefront.findById(order.storefront_id).select("name location_text headline");
  return { order, storefront };
}

/** Staff: List Storefront Orders for Fulfillment */
export async function listStorefrontOrders(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  return StorefrontOrder.find({ business_id: business._id }).sort({ createdAt: -1 });
}

/** Staff: Update Order Fulfillment Status */
export async function updateOrderFulfillmentStatus(businessId, orderId, user, status) {
  const business = await getOwnedBusiness(businessId, user);
  const order = await StorefrontOrder.findOne({ _id: orderId, business_id: business._id });
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  if (["pending", "processing", "fulfilled", "cancelled"].includes(status)) {
    order.fulfillment_status = status;
    if (status === "fulfilled") {
      order.payment_status = "paid";
    }
    await order.save();
  }

  return order;
}