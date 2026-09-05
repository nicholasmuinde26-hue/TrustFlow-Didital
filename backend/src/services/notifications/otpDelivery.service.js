import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';
import { OTP_CHANNELS, OTP_CHANNEL_VALUES, OTP_CHANNEL_LABELS } from '../../constants/otp.constants.js';
import { sendOtpEmail, isEmailChannelConfigured } from './email.service.js';
import { sendOtpWhatsapp, isWhatsappChannelConfigured } from './whatsapp.service.js';

const isDev = () =>
  process.env.NODE_ENV === 'development' || env?.nodeEnv === 'development';

// ========================================
// LOG OTP TO CONSOLE (DEV FALLBACK / SMS PLACEHOLDER)
// ========================================
//
// SMS delivery has no real provider wired up yet (Twilio / Africa's
// Talking integration point - see comment below), so 'sms' still
// logs to console for now, same as before this change.
//
// ========================================

const logOtpToConsole = ({ label, destination, otpCode }) => {
  console.log('\n========================================');
  console.log(`[DEMO OTP - ${label}] Sent to: ${destination}`);
  console.log(`[DEMO OTP - ${label}] Code: ${otpCode}`);
  console.log('========================================\n');
};

// ========================================
// WHICH CHANNELS CAN THIS USER ACTUALLY USE?
// ========================================
//
// SMS and WhatsApp both ride on the user's phone number, so they're
// available whenever the user has a phone on file. Email requires
// the user to have added an email address to their profile.
//
// ========================================

export const getAvailableOtpChannels = (user) => {
  const channels = [];

  if (user?.phone) {
    channels.push({ channel: OTP_CHANNELS.SMS, label: OTP_CHANNEL_LABELS.sms });
    channels.push({ channel: OTP_CHANNELS.WHATSAPP, label: OTP_CHANNEL_LABELS.whatsapp });
  }

  if (user?.email) {
    channels.push({ channel: OTP_CHANNELS.EMAIL, label: OTP_CHANNEL_LABELS.email });
  }

  return channels;
};

// ========================================
// VALIDATE THE REQUESTED CHANNEL FOR THIS USER
// ========================================

export const resolveOtpChannel = (requestedChannel, user) => {
  const channel = (requestedChannel || env.otpDefaultChannel || OTP_CHANNELS.SMS).toLowerCase();

  if (!OTP_CHANNEL_VALUES.includes(channel)) {
    throw new AppError(
      `Invalid OTP channel. Choose one of: ${OTP_CHANNEL_VALUES.join(', ')}`,
      400
    );
  }

  if (channel === OTP_CHANNELS.EMAIL && !user?.email) {
    throw new AppError(
      'No email address on file. Add an email to your profile or choose SMS/WhatsApp instead.',
      400
    );
  }

  if ((channel === OTP_CHANNELS.SMS || channel === OTP_CHANNELS.WHATSAPP) && !user?.phone) {
    throw new AppError('No phone number on file for OTP delivery.', 400);
  }

  return channel;
};

// ========================================
// SEND OTP THROUGH THE CHOSEN CHANNEL
// ========================================
//
// Falls back to logging the code to the console whenever the
// underlying provider isn't configured yet (handy for local dev
// without SMTP/WhatsApp credentials set up) - but only outside
// production, so a misconfigured deployment fails loudly instead
// of silently "sending" nowhere.
//
// ========================================

export const deliverOtp = async ({ channel, user, otpCode, expiryMinutes }) => {
  switch (channel) {
    case OTP_CHANNELS.EMAIL: {
      try {
        if (!isEmailChannelConfigured() && isDev()) {
          logOtpToConsole({ label: 'EMAIL', destination: user.email, otpCode });
          return { channel, delivered: false, dev: true };
        }
        await sendOtpEmail({ to: user.email, otpCode, expiryMinutes });
        return { channel, delivered: true };
      } catch (err) {
        console.warn(`[OTP Delivery] Email sending failed: ${err.message}. Falling back to console in development.`);
        if (isDev()) {
          logOtpToConsole({ label: 'EMAIL-DEV-FALLBACK', destination: user.email, otpCode });
          return { channel, delivered: false, dev: true };
        }
        throw err;
      }
    }

    case OTP_CHANNELS.WHATSAPP: {
      try {
        if (!isWhatsappChannelConfigured() && isDev()) {
          logOtpToConsole({ label: 'WHATSAPP', destination: user.phone, otpCode });
          return { channel, delivered: false, dev: true };
        }
        await sendOtpWhatsapp({ to: user.phone, otpCode, expiryMinutes });
        return { channel, delivered: true };
      } catch (err) {
        console.warn(`[OTP Delivery] WhatsApp sending failed: ${err.message}. Falling back to console in development.`);
        if (isDev()) {
          logOtpToConsole({ label: 'WHATSAPP-DEV-FALLBACK', destination: user.phone, otpCode });
          return { channel, delivered: false, dev: true };
        }
        throw err;
      }
    }

    case OTP_CHANNELS.SMS:
    default: {
      // Integration point for Twilio or Africa's Talking SMS API.
      // Until an SMS provider is wired up, this always logs to console.
      logOtpToConsole({ label: 'SMS', destination: user.phone, otpCode });
      return { channel: OTP_CHANNELS.SMS, delivered: false, dev: true };
    }
  }
};

export default { getAvailableOtpChannels, resolveOtpChannel, deliverOtp };
