import * as service from './leadershipPin.service.js';

// ========================================
// LEADERSHIP PIN CONTROLLER
// ========================================
//
// Every handler here operates on req.membership — the authenticated
// user's OWN membership in this Chama, attached by requireChamaMember.
// There is intentionally no route that lets one leader touch another
// leader's PIN: a PIN nobody else can set is the only kind worth having.
//
// ========================================

const ctx = (req) => ({
  membership: req.membership,
  chamaId: req.chama._id,
  userId: req.user._id
});

// GET /api/v1/chamas/:chamaId/leadership/pin/status
export const getPinStatusController = async (req, res, next) => {
  try {
    const data = await service.getPinStatus({ membership: req.membership });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/chamas/:chamaId/leadership/pin
export const setPinController = async (req, res, next) => {
  try {
    const session = await service.setPin({ ...ctx(req), pin: req.body?.pin });

    res.status(201).json({
      success: true,
      message: 'Leadership Desk PIN created',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/chamas/:chamaId/leadership/pin
export const changePinController = async (req, res, next) => {
  try {
    const session = await service.changePin({
      ...ctx(req),
      currentPin: req.body?.currentPin,
      newPin: req.body?.newPin
    });

    res.status(200).json({
      success: true,
      message: 'Leadership Desk PIN updated',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/chamas/:chamaId/leadership/unlock
export const unlockController = async (req, res, next) => {
  try {
    const session = await service.unlockDesk({ ...ctx(req), pin: req.body?.pin });

    res.status(200).json({
      success: true,
      message: 'Leadership Desk unlocked',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/chamas/:chamaId/leadership/step-up
export const stepUpController = async (req, res, next) => {
  try {
    const session = await service.stepUp({
      ...ctx(req),
      pin: req.body?.pin,
      action: req.body?.action
    });

    res.status(200).json({
      success: true,
      message: 'Action confirmed',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/chamas/:chamaId/leadership/pin/reset/request
export const requestPinResetController = async (req, res, next) => {
  try {
    const data = await service.requestPinReset({
      ...ctx(req),
      channel: req.body?.channel
    });

    res.status(200).json({
      success: true,
      message: `Reset code sent via ${data.channel}`,
      data
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/chamas/:chamaId/leadership/pin/reset/confirm
export const confirmPinResetController = async (req, res, next) => {
  try {
    const session = await service.confirmPinReset({
      ...ctx(req),
      otpCode: req.body?.otpCode,
      newPin: req.body?.newPin
    });

    res.status(200).json({
      success: true,
      message: 'Leadership Desk PIN reset',
      data: session
    });
  } catch (error) {
    next(error);
  }
};
