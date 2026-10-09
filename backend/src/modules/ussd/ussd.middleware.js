import crypto from 'crypto';

// ======================================================================
// AFRICA'S TALKING WEBHOOK GUARD
// ======================================================================
// The callback is public by design (AT cannot log in), so anyone who finds
// the URL could otherwise POST a forged phoneNumber and probe PINs for a
// victim's number. Two independent, opt-in checks:
//
//   USSD_WEBHOOK_TOKEN   shared secret. Configure the callback URL in the AT
//                        dashboard as  .../api/v1/ussd/callback?token=<secret>
//   USSD_ALLOWED_IPS     comma-separated AT egress IPs (matched against
//                        req.ip, so `trust proxy` must be set correctly)
//
// If neither is set the webhook stays open (so existing deployments do not
// break on upgrade) and a warning is logged once; set at least the token
// in production.

const safeEqual = (a, b) => {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
};

let warned = false;

export const verifyUssdWebhook = (req, res, next) => {
  const token = process.env.USSD_WEBHOOK_TOKEN;
  const allowedIps = (process.env.USSD_ALLOWED_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (!token && allowedIps.length === 0) {
    if (!warned && process.env.NODE_ENV === 'production') {
      warned = true;
      console.warn('[ussd] WARNING: USSD_WEBHOOK_TOKEN / USSD_ALLOWED_IPS not set - callback is unauthenticated.');
    }
    return next();
  }

  if (token && !safeEqual(req.query?.token, token)) {
    res.set('Content-Type', 'text/plain');
    return res.status(200).send('END Invalid USSD request.');
  }

  if (allowedIps.length > 0) {
    const ip = String(req.ip || '').replace(/^::ffff:/, '');
    if (!allowedIps.includes(ip)) {
      res.set('Content-Type', 'text/plain');
      return res.status(200).send('END Invalid USSD request.');
    }
  }

  return next();
};

export default verifyUssdWebhook;
