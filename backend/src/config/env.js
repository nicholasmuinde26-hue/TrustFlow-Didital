import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if ((!jwtAccessSecret || !jwtRefreshSecret) && nodeEnv !== 'development') {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables are required outside development'
  );
}

const env = {
  nodeEnv,

  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI,

  // Short-lived Access Token (15 minutes default)
  jwtAccessSecret: jwtAccessSecret || 'dev-access-secret-change-in-prod',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

  // Long-lived Refresh Token (7 days default)
  jwtRefreshSecret: jwtRefreshSecret || 'dev-refresh-secret-change-in-prod',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // OTP Configuration
  otpExpiresInMinutes: Number(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
  otpLength: Number(process.env.OTP_LENGTH) || 6,

  // Default channel used when the client doesn't specify one ('sms' | 'email' | 'whatsapp')
  otpDefaultChannel: process.env.OTP_DEFAULT_CHANNEL || 'sms',

  // ========================================
  // SMTP (EMAIL OTP DELIVERY)
  // ========================================
  // Two supported setups, tried in this order by email.service.js:
  //   1. Gmail app-password login  -> EMAIL_USER + EMAIL_PASS
  //      (no domain/DNS verification needed - sends via Gmail's own servers)
  //   2. Generic SMTP host/port    -> SMTP_HOST + SMTP_USER + SMTP_PASS
  //      (e.g. Resend's SMTP relay, which DOES require a verified sending domain)
  // ========================================
  smtp: {
    // Gmail app-password credentials (preferred - already verified working)
    gmailUser: process.env.EMAIL_USER,
    gmailPass: process.env.EMAIL_PASS,

    // Generic SMTP host fallback
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for other ports
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,

    fromName: process.env.SMTP_FROM_NAME || 'VeriCircle Pro',
    fromEmail:
      process.env.SMTP_FROM_EMAIL || process.env.EMAIL_USER || process.env.SMTP_USER,

    // Resend HTTP API key - preferred path (see email.service.js)
    resendApiKey: process.env.RESEND_API_KEY,
    // Only used once a domain is verified in Resend; until then the
    // service falls back to Resend's sandbox sender automatically.
    resendFromEmail: process.env.RESEND_FROM_EMAIL,
  },

  // ========================================
  // WHATSAPP (META CLOUD API OTP DELIVERY)
  // ========================================
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION || 'v20.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    // Name of the pre-approved WhatsApp message template used to deliver the OTP.
    // Meta requires OTP messages sent outside a 24h user-initiated session to use
    // an approved "authentication" template - free-form text will be rejected.
    templateName: process.env.WHATSAPP_OTP_TEMPLATE_NAME || 'otp_verification',
    templateLanguage: process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en_US',
  },
};

export default env;