import crypto from 'crypto';
import { rateLimit } from '../../middleware/rateLimit.middleware.js';

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export const burialUssdRateLimit = rateLimit({ windowMs: 60_000, max: 60, message: 'Too many USSD requests.' });

export const verifyBurialUssdProvider = (req, res, next) => {
  const token = process.env.BURIAL_USSD_WEBHOOK_TOKEN;
  const ips = (process.env.BURIAL_USSD_ALLOWED_IPS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (!token && ips.length === 0) return res.status(503).json({ success: false, message: 'Burial USSD provider verification is not configured' });
  const supplied = req.get('x-ussd-token') || req.query?.token;
  const tokenValid = token && safeEqual(supplied, token);
  const ip = String(req.ip || '').replace(/^::ffff:/, '');
  if (!tokenValid && !(ips.length && ips.includes(ip))) return res.status(401).json({ success: false, message: 'Invalid USSD provider credentials' });
  return next();
};

export const verifyBurialUssdCleanup = (req, res, next) => {
  const secret = process.env.BURIAL_USSD_CLEANUP_SECRET;
  if (!secret) return res.status(503).json({ success: false, message: 'USSD cleanup is not configured' });
  if (!safeEqual(req.get('x-cleanup-secret'), secret)) return res.status(401).json({ success: false, message: 'Invalid cleanup credentials' });
  return next();
};
