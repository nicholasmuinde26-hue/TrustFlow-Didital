import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

// ========================================
// JWT SECRET
// ========================================
//
// This must never silently fall back to a
// known, public value. A guessable secret
// lets anyone forge auth tokens for any user.
//
// In non-development environments, a missing
// JWT_SECRET must fail startup loudly rather
// than run with a compromised secret.
//
// In development only, a fixed placeholder is
// tolerated so the app can boot locally without
// a .env file, but it is never used outside
// development.
//
// ========================================

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret && nodeEnv !== 'development') {

  throw new Error(
    'JWT_SECRET environment variable is required outside development'
  );

}

const env = {
  nodeEnv,

  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI,

  jwtSecret: jwtSecret || 'development-only-insecure-secret',

  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d'
};

export default env;