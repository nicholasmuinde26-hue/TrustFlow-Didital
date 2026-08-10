import axios from "axios";
import dns from "node:dns";

/**
 * ============================================================
 * M-PESA SERVICE
 * ============================================================
 */

if (process.env.NODE_ENV !== "production") {
  try {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  } catch (error) {
    console.warn("Unable to set custom DNS servers for M-Pesa service:", error.message);
  }
}

const MPESA_ENVIRONMENT = (process.env.MPESA_ENVIRONMENT || "sandbox").trim().toLowerCase();
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY?.trim();
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET?.trim();
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE?.trim() || "174379";
const MPESA_PASSKEY = process.env.MPESA_PASSKEY?.trim();
const MPESA_CALLBACK_URL = process.env.MPESA_CALLBACK_URL?.trim();
const MPESA_B2C_RESULT_URL = process.env.MPESA_B2C_RESULT_URL?.trim();
const MPESA_B2C_TIMEOUT_URL = process.env.MPESA_B2C_TIMEOUT_URL?.trim();
const MPESA_INITIATOR_NAME = process.env.MPESA_INITIATOR_NAME?.trim();
const MPESA_SECURITY_CREDENTIAL = process.env.MPESA_SECURITY_CREDENTIAL?.trim();
const MPESA_TIMEOUT = Number(process.env.MPESA_TIMEOUT) || 15000;

const MPESA_FORCE_MOCK = String(process.env.MPESA_FORCE_MOCK || "").toLowerCase() === "true";

const MPESA_BASE_URL = MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export function validateConfiguration() {
  const missing = [];
  if (!MPESA_CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
  if (!MPESA_CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
  if (!MPESA_PASSKEY) missing.push("MPESA_PASSKEY");
  if (!MPESA_CALLBACK_URL) missing.push("MPESA_CALLBACK_URL");
  if (missing.length > 0) {
    throw new Error(`Missing M-Pesa configuration parameters: ${missing.join(", ")}`);
  }
  return true;
}

const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) throw new Error("Phone number is required");
  let phone = String(phoneNumber).trim().replace(/[\s\-()]/g, "");
  if (phone.startsWith("+254")) phone = phone.substring(1);
  if (phone.startsWith("07") || phone.startsWith("01")) phone = `254${phone.substring(1)}`;
  if (!/^254(7|1)\d{8}$/.test(phone)) {
    throw new Error("Invalid Kenyan phone number. Expected format: 2547XXXXXXXX");
  }
  return phone;
};

const validateAmount = (amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) throw new Error("Payment amount must be a valid number");
  if (!Number.isInteger(numericAmount)) throw new Error("M-Pesa STK Push amount must be a whole number");
  if (numericAmount <= 0) throw new Error("M-Pesa payment amount must be greater than zero");
  return numericAmount;
};

const generateTimestamp = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const generatePassword = (timestamp) => {
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) {
    throw new Error("M-Pesa shortcode and passkey are required");
  }
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
};

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;
let tokenRequestPromise = null;

const getAccessToken = async () => {
  validateConfiguration();
  const now = Date.now();
  if (cachedAccessToken && now < accessTokenExpiresAt - 60000) {
    return cachedAccessToken;
  }
  if (tokenRequestPromise) return tokenRequestPromise;

  tokenRequestPromise = (async () => {
    try {
      const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
      const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${credentials}` },
        timeout: MPESA_TIMEOUT,
      });
      const accessToken = response.data?.access_token;
      const expiresIn = Number(response.data?.expires_in) || 3600;
      if (!accessToken) throw new Error("M-Pesa OAuth response did not contain an access token");
      cachedAccessToken = accessToken;
      accessTokenExpiresAt = Date.now() + expiresIn * 1000;
      return accessToken;
    } catch (error) {
      cachedAccessToken = null;
      accessTokenExpiresAt = 0;
      throw createMpesaError(error, "Failed to obtain M-Pesa access token");
    } finally {
      tokenRequestPromise = null;
    }
  })();
  return tokenRequestPromise;
};

const createMockStkResponse = ({ amount, phoneNumber, accountReference }) => {
  const checkoutRequestId = `MOCK_CO_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const merchantRequestId = `MOCK_MR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  return {
    success: true,
    mocked: true,
    merchantRequestId,
    checkoutRequestId,
    responseCode: "0",
    responseDescription: "Mock STK Push accepted",
    customerMessage: "Mock payment request created",
    rawResponse: { mocked: true, amount, phoneNumber, accountReference },
  };
};

/**
 * ============================================================
 * STK PUSH - UPDATED
 * ============================================================
 */
const initiateStkPush = async ({ amount, phoneNumber, accountReference, displayReference, transactionDescription }) => {
  validateConfiguration();
  const validatedAmount = validateAmount(amount);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!accountReference) throw new Error("Account reference is required");
  if (!transactionDescription) throw new Error("Transaction description is required");

  // NEW: Use displayReference for what customer sees on M-Pesa. Max 20 chars for Safaricom
  const displayRef = String(displayReference || accountReference).substring(0, 20);

  if (MPESA_FORCE_MOCK) {
    console.warn("⚠️ [M-PESA MOCK MODE] Explicitly enabled.");
    return createMockStkResponse({
      amount: validatedAmount,
      phoneNumber: normalizedPhone,
      accountReference: displayRef,
    });
  }

  try {
    const accessToken = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: validatedAmount,
      PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: normalizedPhone,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: displayRef, // This is what shows on M-Pesa statement
      TransactionDesc: String(transactionDescription).substring(0, 100),
    };

    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      timeout: MPESA_TIMEOUT,
    });

    const data = response.data || {};

    if (data.ResponseCode !== undefined && String(data.ResponseCode) !== "0") {
      throw createMpesaError({ response: { status: response.status || 502, data } }, "M-Pesa STK Push was rejected");
    }

    if (!data.CheckoutRequestID) {
      throw new Error("M-Pesa STK Push response did not contain CheckoutRequestID");
    }

    return {
      success: true,
      mocked: false,
      merchantRequestId: data.MerchantRequestID || null,
      checkoutRequestId: data.CheckoutRequestID || null,
      responseCode: data.ResponseCode || null,
      responseDescription: data.ResponseDescription || null,
      customerMessage: data.CustomerMessage || null,
      rawResponse: data,
    };
  } catch (error) {
    throw createMpesaError(error, "Failed to initiate M-Pesa STK Push");
  }
};

const queryStkPush = async ({ checkoutRequestId }) => {
  validateConfiguration();
  if (!checkoutRequestId) throw new Error("CheckoutRequestID is required");

  if (String(checkoutRequestId).startsWith("MOCK_CO_")) {
    return {
      success: true,
      mocked: true,
      responseCode: "0",
      responseDescription: "Mock STK query successful",
      merchantRequestId: null,
      checkoutRequestId,
      resultCode: 0,
      resultDescription: "Mock payment completed",
      rawResponse: { mocked: true, CheckoutRequestID: checkoutRequestId, ResultCode: 0, ResultDesc: "Mock payment completed" },
    };
  }

  try {
    const accessToken = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      timeout: MPESA_TIMEOUT,
    });

    const data = response.data || {};
    const resultCode = data.ResultCode !== undefined && data.ResultCode !== null ? Number(data.ResultCode) : null;

    return {
      success: true,
      mocked: false,
      responseCode: data.ResponseCode || null,
      responseDescription: data.ResponseDescription || null,
      merchantRequestId: data.MerchantRequestID || null,
      checkoutRequestId: data.CheckoutRequestID || checkoutRequestId,
      resultCode: Number.isNaN(resultCode)? null : resultCode,
      resultDescription: data.ResultDesc || null,
      rawResponse: data,
    };
  } catch (error) {
    const normalizedError = createMpesaError(error, "Failed to query M-Pesa STK Push");
    console.error("❌ M-Pesa STK QUERY FAILED");
    console.error("Environment:", MPESA_ENVIRONMENT);
    console.error("Base URL:", MPESA_BASE_URL);
    console.error("CheckoutRequestID:", checkoutRequestId);
    console.error("HTTP Status:", normalizedError.statusCode || error?.response?.status || "N/A");
    console.error("Provider Response:", normalizedError.providerResponse || error?.response?.data || null);
    throw normalizedError;
  }
};

const initiateB2c = async ({ amount, phoneNumber, remarks, occasion }) => {
  validateConfiguration();
  if (!MPESA_INITIATOR_NAME || !MPESA_SECURITY_CREDENTIAL || !MPESA_B2C_RESULT_URL || !MPESA_B2C_TIMEOUT_URL) {
    throw new Error("Missing B2C configuration: MPESA_INITIATOR_NAME, MPESA_SECURITY_CREDENTIAL, MPESA_B2C_RESULT_URL, MPESA_B2C_TIMEOUT_URL");
  }
  try {
    const accessToken = await getAccessToken();
    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, {
      InitiatorName: MPESA_INITIATOR_NAME,
      SecurityCredential: MPESA_SECURITY_CREDENTIAL,
      CommandID: "BusinessPayment",
      Amount: validateAmount(amount),
      PartyA: MPESA_SHORTCODE,
      PartyB: normalizePhoneNumber(phoneNumber),
      Remarks: String(remarks || "Business payout").substring(0, 100),
      QueueTimeOutURL: MPESA_B2C_TIMEOUT_URL,
      ResultURL: MPESA_B2C_RESULT_URL,
      Occasion: String(occasion || "Business payout").substring(0, 100),
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      timeout: MPESA_TIMEOUT,
    });
    const data = response.data || {};
    if (data.ResponseCode !== undefined && String(data.ResponseCode) !== "0") {
      throw createMpesaError({ response: { status: response.status || 502, data } }, "M-Pesa B2C request was rejected");
    }
    return {
      conversationId: data.ConversationID || null,
      originatorConversationId: data.OriginatorConversationID || null,
      responseDescription: data.ResponseDescription || null,
      rawResponse: data,
    };
  } catch (error) {
    throw createMpesaError(error, "Failed to initiate M-Pesa B2C payment");
  }
};

const parseStkCallback = (callbackBody) => {
  const stkCallback = callbackBody?.Body?.stkCallback;
  if (!stkCallback) throw new Error("Invalid M-Pesa callback payload");
  const metadataItems = stkCallback.CallbackMetadata?.Item || [];
  const metadata = {};
  for (const item of metadataItems) {
    if (item?.Name && item?.Value !== undefined) {
      metadata[item.Name] = item.Value;
    }
  }
  const resultCode = Number(stkCallback.ResultCode);
  return {
    merchantRequestId: stkCallback.MerchantRequestID || null,
    checkoutRequestId: stkCallback.CheckoutRequestID || null,
    resultCode: Number.isNaN(resultCode)? null : resultCode,
    resultDescription: stkCallback.ResultDesc || null,
    success: resultCode === 0,
    amount: metadata.Amount ?? null,
    mpesaReceiptNumber: metadata.MpesaReceiptNumber ?? null,
    transactionDate: metadata.TransactionDate ?? null,
    phoneNumber: metadata.PhoneNumber? normalizePhoneNumber(String(metadata.PhoneNumber)) : null,
    rawCallback: callbackBody,
  };
};

const mapResultCode = (resultCode) => {
  const code = Number(resultCode);
  if (code === 0) return { status: "success", paymentStatus: "completed", retryable: false };
  switch (code) {
    case 1: return { status: "failed", paymentStatus: "failed", retryable: false, reason: "Insufficient balance" };
    case 1032: return { status: "cancelled", paymentStatus: "cancelled", retryable: true, reason: "Transaction cancelled by user" };
    case 1037: return { status: "timeout", paymentStatus: "failed", retryable: true, reason: "Transaction timed out" };
    case 2001: return { status: "failed", paymentStatus: "failed", retryable: false, reason: "Invalid initiator information" };
    default: return { status: "failed", paymentStatus: "failed", retryable: false, reason: "M-Pesa transaction failed" };
  }
};

const createMpesaError = (error, defaultMessage) => {
  if (error?.response) {
    const providerData = error.response.data;
    const providerMessage = providerData?.errorMessage || providerData?.ResponseDescription || providerData?.ResultDesc || providerData?.message || providerData?.error || null;
    const statusCode = Number(error.response.status) || 502;
    let message = providerMessage || defaultMessage;
    if (statusCode === 429) message = providerMessage || "M-Pesa API rate limit reached. Please wait before retrying.";
    if (statusCode === 401) message = providerMessage || "M-Pesa authentication failed. Check consumer credentials.";
    if (statusCode === 400) message = providerMessage || "M-Pesa rejected the request. Check the shortcode, passkey, timestamp, and CheckoutRequestID.";
    if (statusCode === 404) message = providerMessage || "M-Pesa endpoint or CheckoutRequestID was not found.";
    const mpesaError = new Error(message);
    mpesaError.name = "MpesaProviderError";
    mpesaError.statusCode = statusCode;
    mpesaError.provider = "mpesa";
    mpesaError.providerResponse = providerData;
    mpesaError.providerStatus = statusCode;
    return mpesaError;
  }
  if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    const timeoutError = new Error("M-Pesa request timed out");
    timeoutError.name = "MpesaProviderError";
    timeoutError.code = "MPESA_TIMEOUT";
    timeoutError.statusCode = 504;
    timeoutError.provider = "mpesa";
    timeoutError.originalError = error?.message || null;
    return timeoutError;
  }
  if (error?.code === "ENOTFOUND" || error?.code === "EAI_AGAIN" || error?.code === "ECONNREFUSED" || error?.code === "ECONNRESET") {
    const networkError = new Error("Unable to connect to M-Pesa API");
    networkError.name = "MpesaProviderError";
    networkError.code = error.code;
    networkError.statusCode = 503;
    networkError.provider = "mpesa";
    networkError.originalError = error?.message || null;
    return networkError;
  }
  if (error?.provider === "mpesa") return error;
  const mpesaError = new Error(error?.message || defaultMessage);
  mpesaError.name = "MpesaProviderError";
  mpesaError.statusCode = error?.statusCode || 502;
  mpesaError.provider = "mpesa";
  mpesaError.originalError = error?.message || null;
  return mpesaError;
};

export default {
  getAccessToken,
  initiateStkPush,
  queryStkPush,
  initiateB2c,
  parseStkCallback,
  mapResultCode,
  normalizePhoneNumber,
  validateAmount,
};