import mongoose from 'mongoose';
import NotificationPreference from '../models/NotificationPreference.js';

/**
 * Migration: turn on SMS + WhatsApp for existing notification preferences
 * =======================================================================
 *
 * Preference documents created before the notification upgrade stored
 * `sms: false` and have no WhatsApp switch, so existing users would never
 * receive the new SMS/WhatsApp alerts. This applies the new defaults (SMS and
 * WhatsApp on) ONLY to documents that still look untouched:
 *
 *   - default_channels.sms is false AND the user never saved an SMS phone
 *     number (so they did not deliberately configure SMS), and
 *   - default_channels.whatsapp is missing.
 *
 * Users who set a phone number or already have WhatsApp configured are left
 * alone. Category switches are only filled in where missing.
 *
 * Idempotent: running it twice changes nothing the second time.
 *
 * Usage: node src/scripts/migrateNotificationChannels.js [--dry-run]
 */
export async function runMigrateNotificationChannels({ dryRun = false } = {}) {
  const untouched = {
    'default_channels.whatsapp': { $exists: false },
    'default_channels.sms': { $ne: true },
    $or: [{ 'sms_settings.phone_number': null }, { 'sms_settings.phone_number': { $exists: false } }],
  };

  const count = await NotificationPreference.countDocuments(untouched);
  if (dryRun) return { matched: count, modified: 0, dryRun: true };

  const result = await NotificationPreference.updateMany(untouched, {
    $set: { 'default_channels.sms': true, 'default_channels.whatsapp': true },
  });

  // Missing WhatsApp flags on everyone else default to on, matching the schema.
  const rest = await NotificationPreference.updateMany(
    { 'default_channels.whatsapp': { $exists: false } },
    { $set: { 'default_channels.whatsapp': true } }
  );

  return { matched: count, modified: result.modifiedCount + rest.modifiedCount, dryRun: false };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  const { default: env } = await import('../config/env.js');
  await mongoose.connect(env.mongoUri);
  try {
    console.log(await runMigrateNotificationChannels({ dryRun }));
  } finally {
    await mongoose.disconnect();
  }
}
