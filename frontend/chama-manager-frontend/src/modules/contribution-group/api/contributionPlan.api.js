import api from "@/app/services/api";

const contributionPlanApi = {
  // ── Financial years ──────────────────────────────────────
  getActiveFinancialYear(chamaId) {
    return api.get(`/chamas/${chamaId}/financial-years/active`);
  },
  listFinancialYears(chamaId) {
    return api.get(`/chamas/${chamaId}/financial-years`);
  },
  createFinancialYear(chamaId, payload) {
    return api.post(`/chamas/${chamaId}/financial-years`, payload);
  },
  activateFinancialYear(chamaId, yearId) {
    return api.patch(`/chamas/${chamaId}/financial-years/${yearId}/activate`);
  },
  closeFinancialYear(chamaId, yearId) {
    return api.patch(`/chamas/${chamaId}/financial-years/${yearId}/close`);
  },

  // ── Contribution plans (generic, cross-owner) ────────────
  getPlans(chamaId) {
    return api.get(`/contribution-plans`, { params: { owner_id: chamaId, owner_type: 'Chama' } });
  },

  configureSchedule(planId, payload) {
    return api.patch(`/contribution-plans/${planId}/configure-schedule`, payload);
  },

  // ── Contribution calendar (leadership + member read models) ──
  //
  // Everything below talks to contributionCalendar.routes.js, which wires
  // up the calendar engine in contributioncalendar.service.js: financial
  // year-aware obligation generation, carry-forward/advance, reminders and
  // month-closing.

  /** Leadership Desk: every plan, its schedule, and the whole obligations grid for a financial year. */
  getLeadershipOverview(chamaId, yearId) {
    return api.get(`/chamas/${chamaId}/contribution-calendar/overview`, {
      params: yearId ? { year: yearId } : undefined,
    });
  },

  /** Officials: every member's standing on the current plan. Needs the contributions module, not MGR. */
  getMemberContributions(chamaId) {
    return api.get(`/chamas/${chamaId}/contribution-calendar/members`);
  },

  /** Leadership Desk: the "who paid which month" grid for one plan. */
  getPlanGrid(chamaId, planId, yearId) {
    return api.get(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/grid`, {
      params: yearId ? { year: yearId } : undefined,
    });
  },

  /** Member dashboard: the signed-in member's own month-by-month calendar, reminders and advance. */
  getMemberCalendar(chamaId, yearId) {
    return api.get(`/chamas/${chamaId}/contribution-calendar/me`, {
      params: yearId ? { year: yearId } : undefined,
    });
  },

  /** Create a new calendar-aligned contribution (Welfare, Shares, Registration, ...). MGR is set up from its own page. */
  createScheduledPlan(chamaId, payload) {
    return api.post(`/chamas/${chamaId}/contribution-calendar/plans`, payload);
  },

  /** Edit name, behaviour, amount mode, amount, audience and per-member amounts. New amounts apply from the next period only. */
  updatePlanDetails(chamaId, planId, payload) {
    return api.patch(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/details`, payload);
  },

  /** Chama template library (table banking, welfare, shares, registration, annual subscription, project fund, harambee). */
  getTemplates(chamaId) {
    return api.get(`/chamas/${chamaId}/contribution-calendar/templates`);
  },

  /** Pause instead of delete: nothing opens, turns overdue or accrues penalties until resumed. */
  pausePlan(chamaId, planId, payload = {}) {
    return api.patch(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/pause`, payload);
  },

  /** Resume a paused plan. `skip_paused_periods` (default true) does not bill the months it was on hold. */
  resumePlan(chamaId, planId, payload = {}) {
    return api.patch(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/resume`, payload);
  },

  /** Archive instead of delete: hidden and inactive, all history kept. `cancel_open_unpaid` cancels untouched open dues. */
  archivePlan(chamaId, planId, payload = {}) {
    return api.patch(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/archive`, payload);
  },

  /** Bring an archived plan back (as paused, so leadership chooses when it starts billing again). */
  restorePlan(chamaId, planId) {
    return api.patch(`/chamas/${chamaId}/contribution-calendar/plans/${planId}/restore`);
  },

  /** "Refresh now" - runs the same generation/overdue-sweep/reminders job the hourly cron does, immediately. */
  runCalendarNow(chamaId) {
    return api.post(`/chamas/${chamaId}/contribution-calendar/run`);
  },
};

export default contributionPlanApi;