import {
  getModuleSettings,
  requestModuleChange,
  cancelModuleChange,
} from './workspacemodulechange.service.js';

const userIdOf = (req) => req.user?._id || req.user?.id;

/** GET /chamas/:chamaId/workspace-modules - setup, blockers, pending request. */
export async function getWorkspaceModuleSettingsController(req, res, next) {
  try {
    const data = await getModuleSettings(req.params.chamaId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/** POST /chamas/:chamaId/workspace-modules/requests - Chama leadership requests an admin-reviewed feature set. */
export async function requestWorkspaceModuleChangeController(req, res, next) {
  try {
    const { modules, note } = req.body || {};
    const data = await requestModuleChange({
      chamaId: req.params.chamaId,
      userId: userIdOf(req),
      membershipId: req.membership._id,
      modules,
      note: typeof note === 'string' ? note.trim().slice(0, 500) : '',
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

/** POST /chamas/:chamaId/workspace-modules/requests/:requestId/cancel */
export async function cancelWorkspaceModuleChangeController(req, res, next) {
  try {
    const data = await cancelModuleChange({
      chamaId: req.params.chamaId,
      requestId: req.params.requestId,
      userId: userIdOf(req),
      membershipId: req.membership._id,
      reason: typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 300) : '',
    });
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}
