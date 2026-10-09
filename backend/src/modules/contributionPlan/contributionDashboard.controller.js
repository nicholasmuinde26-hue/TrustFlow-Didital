import AppError from '../../utils/AppError.js';
import { getContributionDashboard, getMemberMonthView } from './contributionDashboard.service.js';
import { updatePlanDetails } from './contributioncalendar.service.js';

// Handlers for /chamas/:chamaId/contribution-calendar/{dashboard,me/month,plans/:planId/details}.
// Mounted behind protect + requireChamaMember, so req.chama / req.membership are set.

const getAuthenticatedUserId = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.user_id;
  if (!userId) throw new AppError('Authenticated user not found', 401);
  return userId;
};

/** GET /chamas/:chamaId/contribution-calendar/dashboard?month=2026-09[&year=<fyId>][&include=all] - leadership. */
export const dashboard = async (req, res, next) => {
  try {
    const data = await getContributionDashboard({
      chamaId: req.chama._id,
      month: req.query.month || null,
      yearId: req.query.year || null,
      statuses: req.query.include === 'all' ? undefined : ['active'],
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** GET /chamas/:chamaId/contribution-calendar/me/month?month=2026-09 - the caller's own rows + year matrix. */
export const myMonth = async (req, res, next) => {
  try {
    if (!req.membership?._id) throw new AppError('Chama membership context is required.', 400);
    const data = await getMemberMonthView({
      chamaId: req.chama._id,
      membership: req.membership,
      month: req.query.month || null,
      yearId: req.query.year || null,
    });
    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/** PATCH /chamas/:chamaId/contribution-calendar/plans/:planId/details - leadership edits a contribution. */
export const updateDetails = async (req, res, next) => {
  try {
    const { plan, outcome } = await updatePlanDetails({
      chamaId: req.chama._id,
      planId: req.params.planId,
      actorUserId: getAuthenticatedUserId(req),
      body: req.body || {},
    });
    return res.json({ success: true, message: 'Contribution updated.', data: { plan, outcome } });
  } catch (error) {
    next(error);
  }
};

export default { dashboard, myMonth, updateDetails };