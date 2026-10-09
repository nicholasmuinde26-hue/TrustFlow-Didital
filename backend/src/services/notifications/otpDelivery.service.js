import env from '../../config/env.js';
import AppError from '../../utils/AppError.js';
import { OTP_CHANNELS, OTP_CHANNEL_VALUES, OTP_CHANNEL_LABELS } from '../../constants/otp.constants.js';
import { sendOtpEmail, isEmailChannelConfigured } from './email.service.js';
import { sendOtpWhatsapp, isWhatsappChannelConfigured } from './whatsapp.service.js';
import { sendOtpSms, isSmsChannelConfigured } from './sms.service.js';

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
  // ========================================
  // DEV: ALWAYS ECHO TO CONSOLE, UP FRONT
  // ========================================
  //
  // Previously this only logged to console as a *fallback* — when the
  // provider wasn't configured, or when a real send attempt failed.
  // That's fragile for local testing with fake numbers/emails: SMS.com
  // credentials might be configured, so it would try a real send, and
  // whether you got a console code depended on the provider rejecting
  // the fake destination in exactly the right way.
  //
  // Now, in development, the code is unconditionally printed to the
  // console before anything else happens, so it's always there
  // regardless of channel or provider state. Real delivery is still
  // attempted below when a provider is configured (useful if you want
  // to test against a real phone/email too), but it's now best-effort
  // in dev — its success or failure never blocks you from getting the
  // code. Production behavior is untouched: no console echo, real
  // delivery is required, and failures still throw.
  //
  // ========================================
  const dev = isDev();

  if (dev) {
    const destination = channel === OTP_CHANNELS.EMAIL ? user.email : user.phone;
    logOtpToConsole({ label: channel.toUpperCase(), destination, otpCode });
  }

  switch (channel) {
    case OTP_CHANNELS.EMAIL: {
      if (!isEmailChannelConfigured()) {
        if (dev) return { channel, delivered: false, dev: true };
        throw new AppError('Email delivery is not configured. Choose SMS or WhatsApp instead.', 500);
      }
      try {
        await sendOtpEmail({ to: user.email, otpCode, expiryMinutes });
        return { channel, delivered: true };
      } catch (err) {
        console.warn(`[OTP Delivery] Email sending failed: ${err.message}${dev ? ' (code already echoed to console above)' : ''}`);
        if (dev) return { channel, delivered: false, dev: true };
        throw err;
      }
    }

    case OTP_CHANNELS.WHATSAPP: {
      if (!isWhatsappChannelConfigured()) {
        if (dev) return { channel, delivered: false, dev: true };
        throw new AppError('WhatsApp delivery is not configured. Choose SMS or email instead.', 500);
      }
      try {
        await sendOtpWhatsapp({ to: user.phone, otpCode, expiryMinutes });
        return { channel, delivered: true };
      } catch (err) {
        console.warn(`[OTP Delivery] WhatsApp sending failed: ${err.message}${dev ? ' (code already echoed to console above)' : ''}`);
        if (dev) return { channel, delivered: false, dev: true };
        throw err;
      }
    }

    case OTP_CHANNELS.SMS:
    default: {
      if (!isSmsChannelConfigured()) {
        if (dev) return { channel: OTP_CHANNELS.SMS, delivered: false, dev: true };
        // Fail loudly in production rather than pretending to send.
        // A user waiting for a code that will never arrive is worse
        // than an error that tells them to try another channel.
        throw new AppError(
          'SMS delivery is not configured. Choose email or WhatsApp instead.',
          500
        );
      }

      try {
        await sendOtpSms({ to: user.phone, otpCode, expiryMinutes });
        return { channel: OTP_CHANNELS.SMS, delivered: true };
      } catch (err) {
        console.warn(`[OTP Delivery] SMS sending failed: ${err.message}${dev ? ' (code already echoed to console above)' : ''}`);
        if (dev) return { channel: OTP_CHANNELS.SMS, delivered: false, dev: true };
        throw err;
      }
    }
  }
};

export default { getAvailableOtpChannels, resolveOtpChannel, deliverOtp };