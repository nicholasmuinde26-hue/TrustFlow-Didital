import axios from 'axios';
import env from '../../config/env.js';

// ========================================
// WHATSAPP CLOUD API (META) - OTP DELIVERY
// ========================================
//
// Uses Meta's official WhatsApp Business Cloud API.
// https://developers.facebook.com/docs/whatsapp/cloud-api
//
// IMPORTANT: WhatsApp requires OTP/authentication messages to be
// sent as a pre-approved "authentication" template (not free-form
// text) unless the user messaged your business number in the last
// 24 hours. Create a template named to match WHATSAPP_OTP_TEMPLATE_NAME
// in Meta Business Manager with a single {{1}} body variable for the
// code (and, optionally, a copy-code button).
//
// ========================================

const isConfigured = () =>
  Boolean(env.whatsapp.phoneNumberId && env.whatsapp.accessToken);

const buildUrl = () =>
  `https://graph.facebook.com/${env.whatsapp.apiVersion}/${env.whatsapp.phoneNumberId}/messages`;

// ========================================
// SEND OTP VIA WHATSAPP TEMPLATE MESSAGE
// ========================================

export const sendOtpWhatsapp = async ({ to, otpCode, expiryMinutes }) => {
  if (!isConfigured()) {
    throw new Error(
      'WhatsApp API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to enable WhatsApp OTP delivery.'
    );
  }

  // WhatsApp Cloud API expects the recipient in international format
  // without a leading '+' (e.g. 254712345678) - matches our internal
  // phone format already, so no re-formatting needed here.
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: env.whatsapp.templateName,
      language: { code: env.whatsapp.templateLanguage },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: otpCode }],
        },
        {
          // Standard Meta "copy code" quick-reply button on
          // authentication templates - omit this block if your
          // approved template doesn't include a button.
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: otpCode }],
        },
      ],
    },
  };

  try {
    await axios.post(buildUrl(), payload, {
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  } catch (err) {
    const apiError = err.response?.data?.error?.message;
    throw new Error(
      apiError
        ? `WhatsApp delivery failed: ${apiError}`
        : `WhatsApp delivery failed: ${err.message}`
    );
  }

  return { channel: 'whatsapp', to };
};

export const isWhatsappChannelConfigured = isConfigured;

export default { sendOtpWhatsapp, isWhatsappChannelConfigured };
