import express from 'express';

import { memberContributions, overview, planGrid, myCalendar, createPlan, runNow, listTemplates, pause, resume, archive, restore } from './contributionCalendar.controller.js';
import { dashboard, myMonth, updateDetails } from './contributionDashboard.controller.js';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireChamaTreasurerOrChairperson } from '../../middleware/chama.middleware.js';
import { requireModule } from '../../middleware/module.middleware.js';
import { requireViewAllContributions } from '../../middleware/contributionsAccess.middleware.js';

// Base route: /api/v1/chamas/:chamaId/contribution-calendar
const router = express.Router({ mergeParams: true });

router.use(protect, requireChamaMember);

// Any active member can see their own month-by-month calendar and
// reminders - this is what the member dashboard reads.
router.get('/me', myCalendar);
// The same member's records for ONE month (month toggle) plus a year matrix.
router.get('/me/month', myMonth);

// Leadership-only: the full grid of every plan's obligations across
// members, per-plan configuration, and the ability to add a new
// calendar-aligned contribution or force an immediate refresh.
router.get('/overview', requireChamaTreasurerOrChairperson, overview);
// Every member's standing on the current plan. Gated by the contributions
// module (not MGR) and by 'all'-scope contributions.view.
router.get('/members', requireModule('contributions'), requireViewAllContributions, memberContributions);
// Every contribution the chama runs, with figures, for one month.
router.get('/dashboard', requireChamaTreasurerOrChairperson, dashboard);
router.get('/plans/:planId/grid', requireChamaTreasurerOrChairperson, planGrid);
router.post('/plans', requireChamaTreasurerOrChairperson, createPlan);
router.patch('/plans/:planId/details', requireChamaTreasurerOrChairperson, updateDetails);
router.post('/run', requireChamaTreasurerOrChairperson, runNow);
// Template library (pre-fills the new-contribution wizard).
router.get('/templates', requireChamaTreasurerOrChairperson, listTemplates);
// Pause / archive instead of delete: history is always kept.
router.patch('/plans/:planId/pause', requireChamaTreasurerOrChairperson, pause);
router.patch('/plans/:planId/resume', requireChamaTreasurerOrChairperson, resume);
router.patch('/plans/:planId/archive', requireChamaTreasurerOrChairperson, archive);
router.patch('/plans/:planId/restore', requireChamaTreasurerOrChairperson, restore);

export default router;