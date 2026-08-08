import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

if ((!jwtAccessSecret || !jwtRefreshSecret) && nodeEnv !== 'development') {
  throw new Error(
    'JWT_ACCESS_SECRET and JWT_REFRESH_SECRET environment variables are required outside development'
  );
}

const env = {
  nodeEnv,

  port: Number(process.env.PORT) || 5000,

  mongoUri: process.env.MONGO_URI,

  // Short-lived Access Token (15 minutes default)
  jwtAccessSecret: jwtAccessSecret || 'dev-access-secret-change-in-prod',
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',

  // Long-lived Refresh Token (7 days default)
  jwtRefreshSecret: jwtRefreshSecret || 'dev-refresh-secret-change-in-prod',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // OTP Configuration
  otpExpiresInMinutes: Number(process.env.OTP_EXPIRES_IN_MINUTES) || 10,
  otpLength: Number(process.env.OTP_LENGTH) || 6,
};

export default env;