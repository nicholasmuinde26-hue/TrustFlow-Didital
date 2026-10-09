import User from '../models/User.js';
import { verifyAccessToken, verifyToken } from '../utils/jwt.js';

// ========================================
// OPTIONAL AUTH
// ========================================
//
// For endpoints that are public but show a bit more to a signed-in member
// (e.g. a person's profile card, whose visibility can be "members only").
// A missing, expired or invalid token is NOT an error here: the request
// simply continues as an anonymous visitor.
//
// ========================================

export const optionalAuth = async (req, _res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return next();
    const decoded = (verifyAccessToken || verifyToken)(header.split(' ')[1]);
    if (!decoded?.id || decoded.type === 'otp_pending' || decoded.isOtpPending) return next();
    const user = await User.findById(decoded.id).select('-password');
    if (user && !['inactive', 'suspended', 'unverified'].includes(user.status)) req.user = user;
  } catch {
    // anonymous visitor
  }
  next();
};
