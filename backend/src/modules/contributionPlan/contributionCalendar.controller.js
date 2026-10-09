import AppError from '../../utils/AppError.js';
import { pausePlan, resumePlan, archivePlan, restorePlan } from './planLifecycle.service.js';
import mgrService from '../mgr/mgr.service.js';
import { CHAMA_TEMPLATES } from '../../constants/chamaTemplates.constants.js';
import {
  getLeadershipOverview,
  getPlanGrid,
  getMemberCalendar,
  createScheduledPlan,
  runCalendarForChama,
} from './contributioncalendar.service.js';

// ========================================
// CONTRIBUTION CALENDAR CONTROLLER
// ========================================
//
// HTTP boundary for the calendar engine in contributioncalendar.service.js.
// That service already did all the real work (generation, carry-forward,
// reminders, read models) - it was simply never reachable from the API,
// so the leadership grid and member calendar it was built for had nothing
// to call. This wires it up.
//
// Every handler here is mounted under a chama-scoped router that has
// already run requireChamaMember (attaching req.chama / req.membership),
// so req.chama._id is always the chama in scope.
// ========================================

const getAuthenticatedUserId = (req) => {
  const userId = req.user?._id || req.user?.id || req.user?.user_id;
  if (!userId) throw new AppError('Authenticated user not found', 401);
  return userId;
};

/** GET /chamas/:chamaId/contribution-calendar/overview?year=<financialYearId> */
export const overview = async (req, res, next) => {
  try {
    const overviewData = await getLeadershipOverview({
      chamaId: req.chama._id,
      yearId: req.query.year || null,
    });
    return res.json({ success: true, data: overviewData });
  } catch (error) {
    next(error);
  }
};

/** GET /chamas/:chamaId/contribution-calendar/plans/:planId/grid?year=<financialYearId> */
export const planGrid = async (req, res, next) => {
  try {
    const grid = await getPlanGrid({
      chamaId: req.chama._id,
      planId: req.params.planId,
      yearId: req.query.year || null,
    });
    return res.json({ success: true, data: grid });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /chamas/:chamaId/contribution-calendar/me?year=<financialYearId>
 *
 * The member's own month-by-month calendar: what's paid, what's owed,
 * reminders and any advance carried forward - never someone else's.
 */
export const myCalendar = async (req, res, next) => {
  try {
    const calendar = await getMemberCalendar({
      chamaId: req.chama._id,
      membership: req.membership,
      yearId: req.query.year || null,
    });
    return res.json({ success: true, data: calendar });
  } catch (error) {
    next(error);
  }
};

/** POST /chamas/:chamaId/contribution-calendar/plans - create a new calendar-aligned contribution (welfare, shares, registration, ...). */
export const createPlan = async (req, res, next) => {
  try {
    const actorUserId = getAuthenticatedUserId(req);
    const { plan, generated } = await createScheduledPlan({
      chamaId: req.chama._id,
      actorUserId,
      body: req.body,
    });
    return res.status(201).json({
      success: true,
      message: 'Contribution created and scheduled.',
      data: { plan, generated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /chamas/:chamaId/contribution-calendar/run
 *
 * Leadership's "Refresh now" button - the same work the hourly job does
 * (generate opened obligations, sweep overdue, send reminders/closed
 * notices) run on demand so a newly configured schedule reflects
 * immediately instead of waiting for the next job tick.
 */
export const runNow = async (req, res, next) => {
  try {
    const summary = await runCalendarForChama({ chamaId: req.chama._id });
    return res.json({ success: true, message: 'Contribution calendar refreshed.', data: summary });
  } catch (error) {
    next(error);
  }
};

export default { overview, planGrid, myCalendar, createPlan, runNow };
// ========================================
// TEMPLATES + LIFECYCLE
// ========================================

/** GET /chamas/:chamaId/contribution-calendar/templates - the chama template library (pre-fills the wizard). */
export const listTemplates = async (_req, res, next) => {
  try {
    return res.json({ success: true, data: { templates: CHAMA_TEMPLATES } });
  } catch (error) {
    next(error);
  }
};

const lifecycle = (fn, message) => async (req, res, next) => {
  try {
    const result = await fn({
      chamaId: req.chama._id,
      planId: req.params.planId,
      actorUserId: getAuthenticatedUserId(req),
      body: req.body || {},
    });
    return res.json({ success: true, message, data: result });
  } catch (error) {
    next(error);
  }
};

/** PATCH .../plans/:planId/pause    body: { reason? } */
export const pause = lifecycle(pausePlan, 'Contribution paused.');
/** PATCH .../plans/:planId/resume   body: { skip_paused_periods? = true } */
export const resume = lifecycle(resumePlan, 'Contribution resumed.');
/** PATCH .../plans/:planId/archive  body: { reason?, cancel_open_unpaid? } */
export const archive = lifecycle(archivePlan, 'Contribution archived. Its history is kept.');
/** PATCH .../plans/:planId/restore */
export const restore = lifecycle(restorePlan, 'Contribution restored as paused. Resume it when you are ready.');

// Every active member with what they owe and have paid on the chama's current
// plan. Reads contribution plans and obligations only, so it works whether or
// not the chama runs a merry-go-round. Route-level guard:
// requireViewAllContributions (officials only).
export const memberContributions = async (req, res, next) => {
  try {
    const data = await mgrService.getChamaContributions(req.chama._id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
};