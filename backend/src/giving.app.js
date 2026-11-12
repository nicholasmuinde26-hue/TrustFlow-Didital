import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import env from './config/env.js';
import { rateLimit } from './middleware/rateLimit.middleware.js';
import { notFound } from './middleware/notFound.middleware.js';
import { errorHandler } from './middleware/error.middleware.js';
import { publicGivingRoutes } from './modules/publicGiving/index.js';

const app = express();
app.use(helmet());
app.use((req, res, next) => {
  req.requestId = req.get('x-request-id')?.slice(0, 100) || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const startedAt = Date.now();
  res.on('finish', () => console.log(JSON.stringify({ level: 'info', requestId: req.requestId, method: req.method, path: `${req.baseUrl || ''}${req.route?.path || req.path}`, status: res.statusCode, durationMs: Date.now() - startedAt })));
  next();
});

if (process.env.TRUST_PROXY) {
  const proxy = process.env.TRUST_PROXY;
  app.set('trust proxy', Number.isNaN(Number(proxy)) ? proxy : Number(proxy));
}

const allowedOrigins = env.givingAllowedOrigins;
if (!allowedOrigins.length && env.isProduction) {
  throw new Error('GIVING_ALLOWED_ORIGINS must be set in production.');
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!env.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.get('/api/v1/health', (_req, res) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ success: dbReady, message: dbReady ? 'Giving API is healthy' : 'Giving database is unavailable', checks: { database: dbReady ? 'up' : 'down' }, timestamp: new Date() });
});
app.use(rateLimit({ windowMs: 60_000, max: Number(process.env.RATE_LIMIT_GLOBAL_MAX) || 300, distributed: true, message: 'Too many requests from this address. Please slow down.' }));
app.use('/api/v1/giving', publicGivingRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
