import axios from "axios";
import dns from "node:dns";

/**
 * ============================================================
 * M-PESA SERVICE v2.1
 * Handles: STK Push, STK Query with retry, Callback Parsing, B2C Payouts
 * ============================================================
 */

if (process.env.NODE_ENV !== "production") {
  try { dns.setServers(["1.1.1.1", "8.8.8.8"]); }
  catch (error) { console.warn("Unable to set custom DNS servers for M-Pesa service:", error.message); }
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
const MPESA_TIMEOUT = Number(process.env.MPESA_TIMEOUT) || 20000; // bumped to 20s for sandbox
const MPESA_FORCE_MOCK = String(process.env.MPESA_FORCE_MOCK || "").toLowerCase() === "true";
const MPESA_BASE_URL = MPESA_ENVIRONMENT === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";

export function validateConfiguration() {
  const missing = [];
  if (!MPESA_CONSUMER_KEY) missing.push("MPESA_CONSUMER_KEY");
  if (!MPESA_CONSUMER_SECRET) missing.push("MPESA_CONSUMER_SECRET");
  if (!MPESA_PASSKEY) missing.push("MPESA_PASSKEY");
  if (!MPESA_CALLBACK_URL) missing.push("MPESA_CALLBACK_URL");
  if (missing.length > 0) throw new Error(`Missing M-Pesa configuration parameters: ${missing.join(", ")}`);
  return true;
}

const normalizePhoneNumber = (phoneNumber) => {
  if (!phoneNumber) throw new Error("Phone number is required");
  let phone = String(phoneNumber).trim().replace(/[\s\-()]/g, "");
  if (phone.startsWith("+254")) phone = phone.substring(1);
  if (phone.startsWith("07") || phone.startsWith("01")) phone = `254${phone.substring(1)}`;
  if (!/^254(7|1)\d{8}$/.test(phone)) throw new Error("Invalid Kenyan phone number. Expected format: 2547XXXXXXXX");
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
  return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
};

const generatePassword = (timestamp) => {
  if (!MPESA_SHORTCODE || !MPESA_PASSKEY) throw new Error("M-Pesa shortcode and passkey are required");
  return Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString("base64");
};

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;
let tokenRequestPromise = null;

const getAccessToken = async () => {
  validateConfiguration();
  const now = Date.now();
  if (cachedAccessToken && now < accessTokenExpiresAt - 60000) return cachedAccessToken;
  if (tokenRequestPromise) return tokenRequestPromise;

  tokenRequestPromise = (async () => {
    try {
      const credentials = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString("base64");
      const response = await axios.get(`${MPESA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${credentials}` }, timeout: MPESA_TIMEOUT,
      });
      const accessToken = response.data?.access_token;
      const expiresIn = Number(response.data?.expires_in) || 3600;
      if (!accessToken) throw new Error("M-Pesa OAuth response did not contain an access token");
      cachedAccessToken = accessToken;
      accessTokenExpiresAt = Date.now() + expiresIn * 1000;
      return accessToken;
    } catch (error) {
      cachedAccessToken = null; accessTokenExpiresAt = 0;
      throw createMpesaError(error, "Failed to obtain M-Pesa access token");
    } finally { tokenRequestPromise = null; }
  })();
  return tokenRequestPromise;
};

const createMockStkResponse = ({ amount, phoneNumber, accountReference }) => ({
  success: true, mocked: true,
  merchantRequestId: `MOCK_MR_${Date.now()}`,
  checkoutRequestId: `MOCK_CO_${Date.now()}`,
  responseCode: "0", responseDescription: "Mock STK Push accepted",
  customerMessage: "Mock payment request created",
  rawResponse: { mocked: true, amount, phoneNumber, accountReference },
});

/**
 * STK PUSH - Customer pays us
 */
const initiateStkPush = async ({ amount, phoneNumber, accountReference, displayReference, transactionDescription }) => {
  validateConfiguration();
  const validatedAmount = validateAmount(amount);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!accountReference) throw new Error("Account reference is required");
  if (!transactionDescription) throw new Error("Transaction description is required");
  const displayRef = String(displayReference || accountReference).substring(0, 20);

  if (MPESA_FORCE_MOCK) {
    console.warn("⚠️ [M-PESA MOCK MODE] Explicitly enabled.");
    return createMockStkResponse({ amount: validatedAmount, phoneNumber: normalizedPhone, accountReference: displayRef });
  }

  try {
    const accessToken = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);
    const payload = {
      BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline", Amount: validatedAmount, PartyA: normalizedPhone,
      PartyB: MPESA_SHORTCODE, PhoneNumber: normalizedPhone, CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: displayRef, TransactionDesc: String(transactionDescription).substring(0, 100),
    };
    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, timeout: MPESA_TIMEOUT,
    });
    const data = response.data || {};
    if (data.ResponseCode !== undefined && String(data.ResponseCode) !== "0") {
      throw createMpesaError({ response: { status: response.status || 502, data } }, "M-Pesa STK Push was rejected");
    }
    if (!data.CheckoutRequestID) throw new Error("M-Pesa STK Push response did not contain CheckoutRequestID");
    return {
      success: true, mocked: false, merchantRequestId: data.MerchantRequestID || null,
      checkoutRequestId: data.CheckoutRequestID || null, responseCode: data.ResponseCode || null,
      responseDescription: data.ResponseDescription || null, customerMessage: data.CustomerMessage || null, rawResponse: data,
    };
  } catch (error) { throw createMpesaError(error, "Failed to initiate M-Pesa STK Push"); }
};

/**
 * STK QUERY - Check status with retry for socket hang up + 429
 */
const queryStkPush = async ({ checkoutRequestId }, retries = 2) => {
  validateConfiguration();
  if (!checkoutRequestId) throw new Error("CheckoutRequestID is required");
  if (String(checkoutRequestId).startsWith("MOCK_CO_")) {
    return { success: true, mocked: true, responseCode: "0", resultCode: 0, checkoutRequestId, rawResponse: { mocked: true } };
  }
  try {
    const accessToken = await getAccessToken();
    const timestamp = generateTimestamp();
    const password = generatePassword(timestamp);
    const payload = { BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId };
    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/stkpushquery/v1/query`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, 
      timeout: MPESA_TIMEOUT,
    });
    const data = response.data || {};
    const resultCode = data.ResultCode !== undefined && data.ResultCode !== null ? Number(data.ResultCode) : null;
    return {
      success: true, mocked: false, responseCode: data.ResponseCode || null, responseDescription: data.ResponseDescription || null,
      merchantRequestId: data.MerchantRequestID || null, checkoutRequestId: data.CheckoutRequestID || checkoutRequestId,
      resultCode: Number.isNaN(resultCode) ? null : resultCode, resultDescription: data.ResultDesc || null, rawResponse: data,
    };
  } catch (error) {
    const normalizedError = createMpesaError(error, "Failed to query M-Pesa STK Push");
    
    // FIX: Retry on socket hang up, ETIMEDOUT, or 429
    const isRetryable = 
      normalizedError.message.includes('socket hang up') || 
      normalizedError.message.includes('ETIMEDOUT') ||
      normalizedError.statusCode === 429;
      
    if (isRetryable && retries > 0) {
      const delay = (3 - retries) * 2000; // 2s, then 4s
      console.warn(`[M-PESA] Retrying STK query for ${checkoutRequestId} in ${delay}ms. Retries left: ${retries}`);
      await new Promise(r => setTimeout(r, delay));
      return queryStkPush({ checkoutRequestId }, retries - 1);
    }

    console.error("❌ M-Pesa STK QUERY FAILED", { checkoutRequestId, status: normalizedError.statusCode, message: normalizedError.message });
    throw normalizedError;
  }
};

/**
 * B2C PAYOUT - We pay customer. For MGR payouts
 */
const initiateB2cPayment = async ({ amount, phoneNumber, remarks, occasion, commandId = 'BusinessPayment' }) => {
  validateConfiguration();
  const validatedAmount = validateAmount(amount);
  const normalizedPhone = normalizePhoneNumber(phoneNumber);

  if (!MPESA_INITIATOR_NAME || !MPESA_SECURITY_CREDENTIAL) {
    throw new Error("M-Pesa B2C initiator name and security credential required. Set MPESA_INITIATOR_NAME and MPESA_SECURITY_CREDENTIAL");
  }
  if (!MPESA_B2C_RESULT_URL || !MPESA_B2C_TIMEOUT_URL) {
    throw new Error("M-Pesa B2C result and timeout URLs required. Set MPESA_B2C_RESULT_URL and MPESA_B2C_TIMEOUT_URL");
  }

  try {
    const accessToken = await getAccessToken();
    const payload = {
      InitiatorName: MPESA_INITIATOR_NAME,
      SecurityCredential: MPESA_SECURITY_CREDENTIAL,
      CommandID: commandId,
      Amount: validatedAmount,
      PartyA: MPESA_SHORTCODE,
      PartyB: normalizedPhone,
      Remarks: String(remarks || 'Chama Payout').substring(0, 100),
      QueueTimeOutURL: MPESA_B2C_TIMEOUT_URL,
      ResultURL: MPESA_B2C_RESULT_URL,
      Occasion: String(occasion || '').substring(0, 100)
    };

    const response = await axios.post(`${MPESA_BASE_URL}/mpesa/b2c/v1/paymentrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      timeout: MPESA_TIMEOUT,
    });

    const data = response.data || {};
    if (data.ResponseCode !== '0') {
      throw createMpesaError({ response: { status: 400, data } }, "M-Pesa B2C was rejected");
    }

    return {
      success: true,
      originatorConversationId: data.OriginatorConversationID,
      conversationId: data.ConversationID,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription,
      rawResponse: data
    };
  } catch (error) {
    throw createMpesaError(error, "Failed to initiate M-Pesa B2C payment");
  }
};

/**
 * PARSE CALLBACK - Never throws
 */
const parseStkCallback = (callbackBody) => {
  try {
    const stkCallback = callbackBody?.Body?.stkCallback;
    if (stkCallback) {
      const metadataItems = stkCallback.CallbackMetadata?.Item || [];
      const metadata = {};
      for (const item of metadataItems) { 
        if (item?.Name && item?.Value !== undefined) metadata[item.Name] = item.Value; 
      }
      const resultCode = Number(stkCallback.ResultCode);
      return {
        merchantRequestId: stkCallback.MerchantRequestID || null, 
        checkoutRequestId: stkCallback.CheckoutRequestID || null,
        resultCode: Number.isNaN(resultCode) ? null : resultCode, 
        resultDescription: stkCallback.ResultDesc || null,
        success: resultCode === 0, 
        amount: metadata.Amount ? Number(metadata.Amount) : null, 
        mpesaReceiptNumber: metadata.MpesaReceiptNumber ?? null,
        transactionDate: metadata.TransactionDate ?? null,
        phoneNumber: metadata.PhoneNumber ? normalizePhoneNumber(String(metadata.PhoneNumber)) : null,
        rawCallback: callbackBody,
      };
    }

    if (callbackBody?.checkoutRequestId) {
      return {
        merchantRequestId: null,
        checkoutRequestId: callbackBody.checkoutRequestId,
        resultCode: null,
        resultDescription: 'Reconciliation query',
        success: false,
        amount: null,
        mpesaReceiptNumber: null,
        transactionDate: null,
        phoneNumber: null,
        rawCallback: callbackBody,
      };
    }

    return {
      merchantRequestId: null,
      checkoutRequestId: 'unknown',
      resultCode: 1,
      resultDescription: 'Invalid M-Pesa callback payload structure',
      success: false,
      amount: null,
      mpesaReceiptNumber: null,
      transactionDate: null,
      phoneNumber: null,
      rawCallback: callbackBody,
    };

  } catch (error) {
    console.error('parseStkCallback crashed:', error, callbackBody);
    return {
      merchantRequestId: null,
      checkoutRequestId: 'unknown',
      resultCode: 1,
      resultDescription: `Parser error: ${error.message}`,
      success: false,
      amount: null,
      mpesaReceiptNumber: null,
      transactionDate: null,
      phoneNumber: null,
      rawCallback: callbackBody,
    };
  }
};

const mapResultCode = (resultCode) => {
  const code = Number(resultCode);
  if (code === 0) return { status: "success", paymentStatus: "completed", retryable: false };
  switch (code) {
    case 1: return { status: "failed", paymentStatus: "failed", retryable: false, reason: "Insufficient balance" };
    case 1032: return { status: "cancelled", paymentStatus: "cancelled", retryable: true, reason: "Transaction cancelled by user" };
    case 1037: return { status: "timeout", paymentStatus: "failed", retryable: true, reason: "Transaction timed out" };
    default: return { status: "failed", paymentStatus: "failed", retryable: false, reason: "M-Pesa transaction failed" };
  }
};

const createMpesaError = (error, defaultMessage) => {
  if (error?.code === 'ECONNABORTED') {
    const mpesaError = new Error('M-Pesa request timed out');
    mpesaError.name = "MpesaProviderError"; mpesaError.statusCode = 504; mpesaError.provider = "mpesa";
    return mpesaError;
  }
  if (error?.code === 'ECONNRESET' || error?.message?.includes('socket hang up')) {
    const mpesaError = new Error('socket hang up');
    mpesaError.name = "MpesaProviderError"; mpesaError.statusCode = 502; mpesaError.provider = "mpesa";
    return mpesaError;
  }
  if (error?.response) {
    const providerData = error.response.data;
    const providerMessage = providerData?.errorMessage || providerData?.ResponseDescription || providerData?.ResultDesc || providerData?.message || null;
    const statusCode = Number(error.response.status) || 502;
    let message = providerMessage || defaultMessage;
    if (statusCode === 429) message = "M-Pesa API rate limit reached. Please wait before retrying.";
    if (statusCode === 401) message = "M-Pesa authentication failed. Check consumer credentials.";
    const mpesaError = new Error(message);
    mpesaError.name = "MpesaProviderError"; mpesaError.statusCode = statusCode; mpesaError.provider = "mpesa"; mpesaError.providerResponse = providerData;
    return mpesaError;
  }
  const mpesaError = new Error(error?.message || defaultMessage);
  mpesaError.name = "MpesaProviderError"; mpesaError.statusCode = error?.statusCode || 502; mpesaError.provider = "mpesa";
  return mpesaError;
};

export default {
  getAccessToken, 
  initiateStkPush, 
  queryStkPush, 
  parseStkCallback, 
  mapResultCode, 
  normalizePhoneNumber, 
  validateAmount,
  initiateB2cPayment
};