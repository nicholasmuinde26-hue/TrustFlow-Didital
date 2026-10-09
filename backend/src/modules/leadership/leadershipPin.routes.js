import express from 'express';
import AppError from '../../utils/AppError.js';

import { protect } from '../../middleware/auth.middleware.js';
import {
  requireChamaMember
} from '../../middleware/chama.middleware.js';

import {
  getPinStatusController,
  setPinController,
  changePinController,
  unlockController,
  stepUpController,
  requestPinResetController,
  confirmPinResetController
} from './leadershipPin.controller.js';

// ========================================
// LEADERSHIP PIN ROUTES
// ========================================
//
// Mounted at /api/v1/chamas (see app.js), so every path here is
// /:chamaId/leadership/...
//
// Note what these routes do NOT require: a leadership session token.
// They are how you GET one. The role gate
// (requireTopOfficial) is what stops a plain member
// from setting a PIN on a seat they don't hold.
//
// ========================================

const router = express.Router();

// The three top officials hold a desk PIN. (requireChamaLeadershipOfficial is
// wider - auditors and committee members - so it is not used here.)
const TOP_OFFICIAL_ROLES = ['chairperson', 'treasurer', 'secretary'];
const requireTopOfficial = (req, _res, next) => {
  const isSystemAdmin = ['super_admin', 'sub_admin'].includes(req.user?.systemRole);
  if (!TOP_OFFICIAL_ROLES.includes(req.membership?.role) && !isSystemAdmin) {
    return next(new AppError('Only the chairperson, treasurer or secretary can use the Leadership Desk', 403));
  }
  return next();
};

const guard = [protect, requireChamaMember, requireTopOfficial];

// Which PIN screen should the client show?
router.get('/:chamaId/leadership/pin/status', ...guard, getPinStatusController);

// First-time PIN creation, and changing a PIN you still know.
router.post('/:chamaId/leadership/pin', ...guard, setPinController);
router.patch('/:chamaId/leadership/pin', ...guard, changePinController);

// Forgotten PIN — rides the existing OTP delivery used for phone
// verification, so the code lands on the leader's own handset.
router.post('/:chamaId/leadership/pin/reset/request', ...guard, requestPinResetController);
router.post('/:chamaId/leadership/pin/reset/confirm', ...guard, confirmPinResetController);

// Unlock the desk for this visit.
router.post('/:chamaId/leadership/unlock', ...guard, unlockController);

// Re-confirm the PIN immediately before one high-risk action.
router.post('/:chamaId/leadership/step-up', ...guard, stepUpController);

export default router;
