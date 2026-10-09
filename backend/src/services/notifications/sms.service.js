import axios from 'axios';

import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';

// ======================================================================
// AFRICA'S TALKING — SMS DELIVERY
// ======================================================================
//
// SMS was the DEFAULT OTP channel but had no provider behind it: every
// SMS OTP was printed to the server console and nothing else. In
// practice that meant either nobody could log in via the default
// channel, or the code was being read out of production logs — and
// anyone with log access could read every user's login code.
//
// This talks to Africa's Talking' HTTP API directly with axios (already
// a dependency, used by the M-Pesa client) rather than pulling in the
// SDK, so there's no new package to install.
//
// A NOTE ON WHAT I FOUND
// ----------------------
// You mentioned Africa's Talking is already wired into the USSD code.
// I searched for it and it isn't there — modules/burialChama/ussd.service.js
// only reads and writes UssdSession documents and has no AT client,
// credentials, or HTTP calls. So there were no existing credentials to
// reuse and this is a first integration, which means you will need to
// set AT_API_KEY and AT_USERNAME before SMS works.
//
// Verify against the current AT docs before going live; the request
// shape below matches their v1 bulk SMS endpoint as documented, but I
// could not make a live call from this environment to confirm it.
//
// ======================================================================

const SMS_PATH = '/messaging';
const REQUEST_TIMEOUT_MS = 15_000;

export const isSmsChannelConfigured = () =>
  Boolean(env.africasTalking?.apiKey && env.africasTalking?.username);

// AT expects E.164 with the leading '+'. Local Kenyan formats and the
// bare '254...' the rest of this codebase stores both need normalising.
const toE164 = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;

  return `+${digits}`;
};

/**
 * Sends one SMS. Throws AppError on failure so the caller can decide
 * whether to fall back or surface the error.
 */
export const sendSms = async ({ to, message }) => {
  if (!isSmsChannelConfigured()) {
    throw new AppError('SMS delivery is not configured on this server.', 500);
  }

  const { apiKey, username, senderId, baseUrl } = env.africasTalking;

  const params = new URLSearchParams({
    username,
    to: toE164(to),
    message,
  });

  // Optional: an unregistered sender ID is rejected outright by AT, so
  // only send it when one is actually configured.
  if (senderId) params.append('from', senderId);

  let response;
  try {
    response = await axios.post(`${baseUrl}${SMS_PATH}`, params.toString(), {
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
    });
  } catch (error) {
    // Never let the API key reach a log line or an error response.
    const detail =
      error.response?.data?.SMSMessageData?.Message ||
      error.response?.statusText ||
      error.message;
    throw new AppError(`SMS delivery failed: ${detail}`, 502);
  }

  // AT returns HTTP 200 with per-recipient statuses, so a 2xx alone
  // does NOT mean the message was accepted. Check the recipient status
  // or a silent failure looks like a success.
  const recipients = response.data?.SMSMessageData?.Recipients || [];
  const recipient = recipients[0];

  if (!recipient) {
    const summary = response.data?.SMSMessageData?.Message || 'no recipients returned';
    throw new AppError(`SMS delivery failed: ${summary}`, 502);
  }

  // 100 = processed, 101 = sent, 102 = queued. Anything else is a
  // failure (credit exhausted, invalid number, blocked sender ID...).
  const accepted = [100, 101, 102].includes(Number(recipient.statusCode));

  if (!accepted) {
    throw new AppError(
      `SMS delivery failed: ${recipient.status || 'unknown'} (code ${recipient.statusCode})`,
      502
    );
  }

  return {
    delivered: true,
    messageId: recipient.messageId || null,
    cost: recipient.cost || null,
    statusCode: recipient.statusCode,
  };
};

export const sendOtpSms = async ({ to, otpCode, expiryMinutes }) => {
  const message =
    `${otpCode} is your VeriCircle verification code. ` +
    `It expires in ${expiryMinutes} minute${expiryMinutes === 1 ? '' : 's'}. ` +
    'Do not share it with anyone.';

  return sendSms({ to, message });
};

export default { sendSms, sendOtpSms, isSmsChannelConfigured };