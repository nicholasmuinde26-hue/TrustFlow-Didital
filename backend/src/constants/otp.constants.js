// ========================================
// OTP DELIVERY CHANNELS
// ========================================

export const OTP_CHANNELS = {
  SMS: 'sms',
  EMAIL: 'email',
  WHATSAPP: 'whatsapp',
};

export const OTP_CHANNEL_VALUES = Object.values(OTP_CHANNELS);

export const OTP_CHANNEL_LABELS = {
  [OTP_CHANNELS.SMS]: 'SMS',
  [OTP_CHANNELS.EMAIL]: 'Email',
  [OTP_CHANNELS.WHATSAPP]: 'WhatsApp',
};

export default OTP_CHANNELS;
