export const isPublicGivingIntent = (intent) => Boolean(intent?.metadata?.publicDonation || intent?.reference?.startsWith('GIVE-'));

export function idempotentIntentMatches(intent, { tokenHash, groupId }) {
  return Boolean(isPublicGivingIntent(intent)
    && intent.metadata?.publicPaymentTokenHash === tokenHash
    && String(intent.owner_id) === String(groupId));
}

export const isAttemptInFlight = (status) => ['pending', 'processing'].includes(String(status || '').toLowerCase());

export function shouldProcessCallback(currentStatus, callbackStatus) {
  const current = String(currentStatus || '').toLowerCase();
  const incoming = String(callbackStatus || '').toLowerCase();
  if (current === 'completed') return false;
  if (['failed', 'cancelled'].includes(current) && current === incoming) return false;
  // A late success may settle a payment that a timeout previously marked failed.
  return true;
}

export function expectedDonationTotal({ paid = 0, pending = 0, attempt = 0 }) {
  return Number(paid || 0) + Number(pending || 0) + Number(attempt || 0);
}
