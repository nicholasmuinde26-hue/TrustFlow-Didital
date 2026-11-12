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

// ========================================
// GENERAL NOTIFICATION VIA WHATSAPP
// ========================================
//
// Alerts, approvals, reminders - anything that is not a login code.
//
// Business-initiated WhatsApp messages must use a pre-approved template unless
// the user messaged the business number within the last 24 hours. Create a
// UTILITY template in Meta Business Manager named to match
// WHATSAPP_ALERT_TEMPLATE_NAME with TWO body variables:
//     {{1}} = headline   {{2}} = detail
// e.g.  "VeriCircle: *{{1}}*\n{{2}}"
//
// If no template name is configured we fall back to a free-form text message,
// which Meta only delivers inside that 24-hour window. The failure is reported
// honestly so the notification centre shows "failed" rather than "sent".
//
const clean = (value, max) =>
  String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max);

export const sendWhatsappNotification = async ({ to, title, message }) => {
  if (!isConfigured()) {
    throw new Error('WhatsApp API is not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.');
  }

  const recipient = String(to || '').replace(/[^\d]/g, '');
  if (!recipient) throw new Error('WhatsApp delivery failed: recipient has no phone number');

  const alertTemplate = env.whatsapp.alertTemplateName;
  const payload = alertTemplate
    ? {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: alertTemplate,
          language: { code: env.whatsapp.alertTemplateLanguage || env.whatsapp.templateLanguage },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: clean(title, 120) || 'Notification' },
                { type: 'text', text: clean(message, 900) || '-' },
              ],
            },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body: `*${clean(title, 120)}*\n${clean(message, 900)}` },
      };

  try {
    const { data } = await axios.post(buildUrl(), payload, {
      headers: {
        Authorization: `Bearer ${env.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    return { channel: 'whatsapp', to: recipient, messageId: data?.messages?.[0]?.id || null };
  } catch (err) {
    const apiError = err.response?.data?.error?.message;
    throw new Error(`WhatsApp delivery failed: ${apiError || err.message}`);
  }
};

export const isWhatsappChannelConfigured = isConfigured;

export default { sendOtpWhatsapp, sendWhatsappNotification, isWhatsappChannelConfigured };
