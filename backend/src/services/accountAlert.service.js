import notificationService from './notification.service.js';
import NotificationPreference from '../models/NotificationPreference.js';
import { sendSms, isSmsChannelConfigured } from './notifications/sms.service.js';
import { sendWhatsappNotification, isWhatsappChannelConfigured } from './notifications/whatsapp.service.js';
import { sendNotificationEmail, isEmailChannelConfigured } from './notifications/email.service.js';

// ========================================
// ACCOUNT ALERTS
// ========================================
//
// For things that belong to a person rather than a chama - wallet deposits and
// withdrawals, wallet PIN changes, security events. (Chama notifications are keyed
// by chama membership, so these cannot go through createNotification.)
//
// Delivered over SMS + WhatsApp (+ email when `urgent`), honouring the user's
// own channel switches. Fire-and-forget: never throws, never blocks the caller.
//
export const alertUser = (userId, { title, message, urgent = false, actionPath = null }) => {
  if (!userId || !title || !message) return;

  (async () => {
    try {
      const prefs = await NotificationPreference.findOne({ user_id: userId })
        .select('default_channels do_not_disturb')
        .lean();
      const on = (key) => prefs?.default_channels?.[key] !== false;
      const contact = await notificationService.resolveContact(userId);
      const jobs = [];

      if (on('sms') && contact.sms && isSmsChannelConfigured()) {
        const text = `${title}: ${message}`.replace(/\s+/g, ' ').trim();
        jobs.push(sendSms({ to: contact.sms, message: `${text.slice(0, 300)} - VeriCircle` }));
      }
      if (on('whatsapp') && contact.whatsapp && isWhatsappChannelConfigured()) {
        jobs.push(sendWhatsappNotification({ to: contact.whatsapp, title, message }));
      }
      if (urgent && on('email') && contact.email && isEmailChannelConfigured()) {
        jobs.push(sendNotificationEmail({ to: contact.email, name: contact.name, title, message, priority: 'urgent' }));
      }

      const results = await Promise.allSettled(jobs);
      results
        .filter((r) => r.status === 'rejected')
        .forEach((r) => console.error('[accountAlert] delivery failed:', r.reason?.message));
    } catch (error) {
      console.error('[accountAlert] failed:', error.message);
    }
  })();
};

export default { alertUser };
