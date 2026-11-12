import crypto from 'crypto';
import mongoose from 'mongoose';

// ======================================================================
// RATE LIMITING
// ======================================================================
//
// There was no rate limiting anywhere in this application. Combined with
// an OTP endpoint that had no attempt cap, that made a 6-digit code
// brute-forceable in minutes; it also left login, OTP send (which costs
// real money per SMS) and every other endpoint open to trivial abuse.
//
// IMPLEMENTATION NOTE — READ BEFORE DEPLOYING
// -------------------------------------------
// Existing platform routes use the process-local counter. The independently
// deployed Giving API opts into atomic MongoDB-backed counters shared by its
// instances. For high-volume deployments, replace that store with Redis.
//
// ======================================================================

const buckets = new Map();

// Unbounded Maps are a memory-leak-shaped hole in any naive limiter, so
// expired buckets are swept periodically.
const SWEEP_INTERVAL_MS = 60_000;

const sweep = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const sweeper = setInterval(sweep, SWEEP_INTERVAL_MS);
// Don't hold the event loop open on shutdown.
if (typeof sweeper.unref === 'function') sweeper.unref();

// Identifying by IP alone punishes everyone behind a shared NAT (common
// on Kenyan mobile networks) and misses a distributed attacker. Where a
// request carries an account identifier, the limiter keys on that too.
const defaultKeyGenerator = (req) => req.ip || 'unknown';

// Hashed so raw phone numbers and emails don't sit in process memory as
// map keys any longer than they have to.
export const identifierKeyGenerator = (req) => {
  const identifier =
    req.body?.identifier || req.body?.phone || req.body?.email || '';

  const scope = identifier
    ? crypto.createHash('sha256').update(String(identifier).trim().toLowerCase()).digest('hex').slice(0, 16)
    : 'anon';

  return `${req.ip || 'unknown'}:${scope}`;
};

/**
 * @param {object}   options
 * @param {number}   options.windowMs     Window length in milliseconds.
 * @param {number}   options.max          Requests permitted per window.
 * @param {function} options.keyGenerator Derives the bucket key from the request.
 * @param {string}   options.message      Response message when limited.
 * @param {boolean}  options.skipSuccessfulRequests
 *        Only count failures — the right setting for OTP verification,
 *        where a legitimate user's single success shouldn't consume
 *        budget but an attacker's wrong guesses should.
 */
export const rateLimit = ({
  windowMs = 60_000,
  max = 60,
  keyGenerator = defaultKeyGenerator,
  message = 'Too many requests. Please try again shortly.',
  skipSuccessfulRequests = false,
  distributed = false,
} = {}) => {
  let ttlIndexPromise;
  const distributedHit = async (key, now) => {
    const collection = mongoose.connection.collection('ratelimitbuckets');
    ttlIndexPromise ||= collection.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 }).catch(() => {});
    await ttlIndexPromise;
    const nowDate = new Date(now);
    const nextResetAt = new Date(now + windowMs);
    await collection.updateOne({ _id: key }, [{ $set: {
      count: { $cond: [{ $gt: ['$resetAt', nowDate] }, { $add: [{ $ifNull: ['$count', 0] }, 1] }, 1] },
      resetAt: { $cond: [{ $gt: ['$resetAt', nowDate] }, '$resetAt', nextResetAt] },
    } }], { upsert: true });
    return collection.findOne({ _id: key });
  };
  return (req, res, next) => {
    // Hash the path so bearer-like URL segments (e.g. donation status tokens)
    // never become keys in Mongo or process memory.
    const routeHash = crypto.createHash('sha256').update(req.path).digest('hex').slice(0, 16);
    const key = `${req.baseUrl}:${routeHash}:${keyGenerator(req)}`;
    const now = Date.now();

    if (distributed) {
      distributedHit(key, now).then((bucket) => {
        if (!bucket) return next(new Error('Shared rate limiter did not return a counter.'));
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt.getTime() - now) / 1000));
        res.setHeader('RateLimit-Limit', String(max));
        res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
        if (bucket.count > max) {
          res.setHeader('Retry-After', String(retryAfterSeconds));
          return res.status(429).json({ success: false, code: 'RATE_LIMITED', message, retryAfterSeconds });
        }
        return next();
      }).catch(next);
      return;
    }

    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    if (bucket.count >= max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(retryAfterSeconds));

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        message,
        retryAfterSeconds,
      });
    }

    bucket.count += 1;

    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));

    if (skipSuccessfulRequests) {
      // Refund the slot if the request turned out to be legitimate.
      res.on('finish', () => {
        if (res.statusCode < 400 && bucket.count > 0) bucket.count -= 1;
      });
    }

    return next();
  };
};

// ----------------------------------------------------------------------
// PRESETS
// ----------------------------------------------------------------------

// Broad backstop for the whole API. Generous enough that normal app use
// never touches it; tight enough to blunt scraping and credential
// stuffing.
export const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 300,
  message: 'Too many requests from this address. Please slow down.',
});

// Sending an OTP costs real money per SMS and is a spam vector aimed at
// the recipient, not just at us.
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_OTP_SEND_MAX) || 5,
  keyGenerator: identifierKeyGenerator,
  message: 'Too many verification codes requested. Please wait before requesting another.',
});

// The brute-force surface. Deliberately tight, and counts only failures,
// so a user who fat-fingers one digit isn't locked out while an attacker
// grinding the keyspace is stopped quickly. Works alongside the
// per-code attempt cap in auth.service.js: that caps guesses per
// delivered code, this caps guesses per caller across codes.
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_OTP_VERIFY_MAX) || 10,
  keyGenerator: identifierKeyGenerator,
  skipSuccessfulRequests: true,
  message: 'Too many verification attempts. Please wait before trying again.',
});

// Password login, registration, refresh — anything that mints or checks
// credentials.
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20,
  keyGenerator: identifierKeyGenerator,
  skipSuccessfulRequests: true,
  message: 'Too many attempts. Please wait before trying again.',
});

export default {
  rateLimit,
  globalLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  authLimiter,
  identifierKeyGenerator,
};
