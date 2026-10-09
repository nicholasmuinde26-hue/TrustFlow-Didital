import crypto from 'crypto';

import env from '../config/env.js';

// ======================================================================
// C2B WEBHOOK AUTHENTICATION
// ======================================================================
//
// The ConfirmationURL webhook creates money: processConfirmation() writes
// a C2bPayment row and, when the BillRefNumber matches a member, posts a
// real contribution to the general ledger. Before this middleware it was
// an unauthenticated public endpoint that accepted any JSON body, so
// anyone who found the URL could POST a fabricated payment and credit any
// member's account for any amount.
//
// Safaricom's Daraja C2B API sends no signature and no shared secret of
// its own, so authenticity has to be established another way. Three
// independent checks, all of which must pass:
//
//   1. SECRET PATH SEGMENT - the URL registered with Safaricom carries a
//      high-entropy secret. An attacker who doesn't have it can't even
//      find the endpoint. Compared in constant time.
//
//   2. SOURCE IP ALLOWLIST - the request must come from a Safaricom
//      egress range. This is what stops a leaked URL (they end up in
//      logs, proxies and screenshots) from being replayable by anyone
//      else.
//
//   3. SHORTCODE MATCH - enforced in the reconciliation service, since
//      it's a property of the payload rather than the transport. A
//      payment addressed to someone else's paybill is not ours to book.
//
// Layer 1 alone is a bearer token in a URL, which leaks. Layer 2 alone
// is spoofable at the edge if anything upstream terminates TLS and
// forwards headers unsanitised. Together they're a reasonable bar for an
// API that has no signing scheme.
//
// ======================================================================

// Safaricom's published production egress ranges for Daraja callbacks.
// Override with M_PESA_CALLBACK_IPS if Safaricom changes them or you
// front the API with a proxy whose egress differs.
const DEFAULT_SAFARICOM_RANGES = [
  '196.201.214.200/32',
  '196.201.214.206/32',
  '196.201.213.114/32',
  '196.201.214.207/32',
  '196.201.214.208/32',
  '196.201.213.44/32',
  '196.201.212.127/32',
  '196.201.212.138/32',
  '196.201.212.129/32',
  '196.201.212.136/32',
  '196.201.212.74/32',
  '196.201.212.69/32',
];

// ----------------------------------------------------------------------
// IP MATCHING
// ----------------------------------------------------------------------

const ipv4ToInt = (ip) => {
  const parts = String(ip).trim().split('.');
  if (parts.length !== 4) return null;

  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    value = value * 256 + octet;
  }
  return value >>> 0;
};

// Express reports IPv4-mapped IPv6 addresses as "::ffff:196.201.214.200"
// when the socket is dual-stack, which never matches a bare IPv4 range.
const normaliseIp = (ip) => {
  const raw = String(ip || '').trim();
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
};

const ipInCidr = (ip, cidr) => {
  const [range, bitsRaw] = String(cidr).split('/');
  const bits = bitsRaw === undefined ? 32 : Number(bitsRaw);

  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;

  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;

  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
};

const allowedRanges = () => {
  const configured = process.env.M_PESA_CALLBACK_IPS;
  if (!configured) return DEFAULT_SAFARICOM_RANGES;
  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

// ----------------------------------------------------------------------
// CONSTANT-TIME SECRET COMPARE
// ----------------------------------------------------------------------
//
// A plain === leaks the length of the matching prefix through timing.
// It's a narrow channel over a network, but the fix costs nothing.

const secretMatches = (provided, expected) => {
  if (!provided || !expected) return false;

  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(expected));

  // timingSafeEqual throws on length mismatch, so compare digests of a
  // fixed width instead of the raw values.
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();

  return crypto.timingSafeEqual(aHash, bHash);
};

// ----------------------------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------------------------

export const verifyC2bWebhook = (req, res, next) => {
  const expectedSecret = env.mpesa.c2bWebhookSecret;

  // Fail closed. A deployment without the secret configured must not
  // quietly accept unauthenticated money-creating callbacks - that is
  // exactly the state this middleware exists to end.
  if (!expectedSecret) {
    console.error(
      '[c2b] M_PESA_C2B_WEBHOOK_SECRET is not set — rejecting callback. ' +
        'Set it and re-register your Safaricom URLs.'
    );
    return res.status(503).json({ ResultCode: 1, ResultDesc: 'Service unavailable' });
  }

  if (!secretMatches(req.params.webhookSecret, expectedSecret)) {
    // Deliberately vague and logged without the provided value, so the
    // logs don't become a place to read off near-miss guesses.
    console.warn(`[c2b] callback rejected: bad webhook secret from ${normaliseIp(req.ip)}`);
    return res.status(404).json({ ResultCode: 1, ResultDesc: 'Not found' });
  }

  // The IP check can be turned off for local testing with the Daraja
  // sandbox or a tunnel, but never silently: it logs loudly, and it is
  // ignored outright in production.
  const skipIpCheck =
    process.env.M_PESA_SKIP_IP_CHECK === 'true' && env.nodeEnv !== 'production';

  if (skipIpCheck) {
    console.warn('[c2b] IP allowlist bypassed (M_PESA_SKIP_IP_CHECK=true, non-production)');
    return next();
  }

  // req.ip is only trustworthy if Express knows which proxies to trust -
  // see app.set('trust proxy', ...) in app.js. Without that, a forwarded
  // header could be attacker-controlled.
  const sourceIp = normaliseIp(req.ip);
  const ranges = allowedRanges();
  const permitted = ranges.some((cidr) => ipInCidr(sourceIp, cidr));

  if (!permitted) {
    console.warn(`[c2b] callback rejected: source IP ${sourceIp} is not a Safaricom address`);
    return res.status(403).json({ ResultCode: 1, ResultDesc: 'Forbidden' });
  }

  return next();
};

export default { verifyC2bWebhook };