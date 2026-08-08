import Business from "../../models/Business.js";
import BusinessTransaction from "../../models/BusinessTransaction.js";
import mpesaService from "../../payment/providers/mpesa/mpesa.service.js";

const getUserId = (user) => user?._id || user?.id;

async function getOwnedBusiness(businessId, user) {
  const business = await Business.findOne({ _id: businessId, created_by: getUserId(user) });
  if (!business) {
    const error = new Error("Business not found or access denied");
    error.statusCode = 404;
    throw error;
  }
  return business;
}

function assertAmount(amount) {
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    const error = new Error("A positive amount is required");
    error.statusCode = 400;
    throw error;
  }
}

export async function createBusiness(data, user) {
  if (!data.name?.trim()) {
    const error = new Error("Business name is required");
    error.statusCode = 400;
    throw error;
  }
  return Business.create({
    name: data.name,
    category: data.category,
    currency: data.currency,
    mpesa_till: data.mPesaTill || null,
    mpesa_paybill: data.mPesaPaybill || null,
    created_by: getUserId(user),
  });
}

export async function getSummary(businessId, user) {
  const business = await getOwnedBusiness(businessId, user);
  const [transactions, totals] = await Promise.all([
    BusinessTransaction.find({ business_id: business._id, status: "completed" }).sort({ createdAt: -1 }).limit(10),
    BusinessTransaction.aggregate([
      { $match: { business_id: business._id, status: "completed" } },
      { $group: { _id: "$direction", total: { $sum: "$amount" } } },
    ]),
  ]);
  const total = (direction) => String(totals.find((item) => item._id === direction)?.total || 0);
  return {
    profile: business,
    dashboard: {
      cashIn: total("cash_in"),
      cashOut: total("cash_out"),
      netCash: String(Number(total("cash_in")) - Number(total("cash_out"))),
    },
    accounts: ["cash", "bank", "till", "paybill", "mpesa"].map((channel) => ({ channel })),
    recentSales: transactions.filter((transaction) => transaction.type === "sale"),
  };
}

export async function listTransactions(businessId, user, type) {
  const business = await getOwnedBusiness(businessId, user);
  return BusinessTransaction.find({ business_id: business._id, type }).sort({ createdAt: -1 });
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
  if (!data.sendStk) return { transaction };
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
  }
  await transaction.save();
  return true;
}

export async function reconcileB2cResult(result) {
  const transaction = await BusinessTransaction.findOne({ external_reference: result?.Result?.ConversationID, status: "pending" });
  if (!transaction) return false;
  transaction.status = Number(result.Result.ResultCode) === 0 ? "completed" : "failed";
  await transaction.save();
  return true;
}
