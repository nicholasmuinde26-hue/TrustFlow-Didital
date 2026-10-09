import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  AlertTriangle,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Settings2,
  Users,
} from "lucide-react";

import contributionPlanApi from "../../contribution-group/api/contributionPlan.api.js";
import ContributionWizard from "../components/ContributionWizard";
import {
  EmptyState,
  InputField,
  MetricCard,
  Notice,
  SectionCard,
  SelectField,
  Stepper,
  ToggleRow,
  money,
} from "../components/DeskUI";

// ========================================
// CONTRIBUTIONS OVERSIGHT TAB
// ========================================
//
// The Treasurer/Chairperson cockpit for the Contribution Calendar engine
// (contributioncalendar.service.js): set the financial year every other
// contribution is drawn inside, give each contribution (MGR, Welfare,
// Shares, ...) its own start/end month, due day and grace period, and
// see - per month - how much was expected, collected and who is
// overdue. Everything here calls the real API; nothing is mocked.
//
// This is the leadership-side twin of the member's own calendar
// (getMemberCalendar, read by the member dashboard).
// ========================================

/** "2026-09-15T..." -> "2026-09-15" for a <input type="date">. */
const toDateInput = (value) => (value ? String(value).slice(0, 10) : "");
/** "2026-09-...(anything)" -> "2026-09" for a <input type="month">. */
const toMonthInput = (value) => (value ? String(value).slice(0, 7) : "");

const STATE_TONE = {
  overdue: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  due: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  open: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  upcoming: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  closed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const emptyNewYear = { label: "", start_date: "", end_date: "" };
export default function ContributionsOversightTab({ chamaId }) {
  const [overview, setOverview] = useState(null);
  const [viewYearId, setViewYearId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  const [newYear, setNewYear] = useState(emptyNewYear);
  const [showWizard, setShowWizard] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [scheduleDrafts, setScheduleDrafts] = useState({});
  // Pause / resume / archive confirmation: { plan, action, reason, cancelOpen, skipPaused }
  const [lifecycle, setLifecycle] = useState(null);

  const load = useCallback(
    async (yearId = viewYearId) => {
      setLoading(true);
      try {
        const res = await contributionPlanApi.getLeadershipOverview(chamaId, yearId || undefined);
        setOverview(res.data?.data || null);
      } catch (err) {
        setNotice({ type: "error", text: err.response?.data?.message || "Failed to load contribution overview." });
      } finally {
        setLoading(false);
      }
    },
    [chamaId, viewYearId]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamaId]);

  const runAction = async (fn, successText) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
      if (successText) setNotice({ type: "success", text: successText });
      await load();
    } catch (err) {
      setNotice({ type: "error", text: err.response?.data?.message || "That action failed." });
    } finally {
      setBusy(false);
    }
  };

  const handleCreateYear = () =>
    runAction(async () => {
      if (!newYear.label || !newYear.start_date || !newYear.end_date) {
        throw { response: { data: { message: "Give the financial year a label, start date and end date." } } };
      }
      await contributionPlanApi.createFinancialYear(chamaId, newYear);
      setNewYear(emptyNewYear);
    }, "Financial year created and activated. Any previous active year was closed.");

  const applyPreset = (preset) => {
    setNewYear({
      label: preset.year_label,
      start_date: toDateInput(preset.start_date),
      end_date: toDateInput(preset.end_date),
    });
  };

  const handleActivateYear = (yearId) =>
    runAction(
      () => contributionPlanApi.activateFinancialYear(chamaId, yearId),
      "Financial year activated."
    );

  const handleCloseYear = (yearId) =>
    runAction(
      () => contributionPlanApi.closeFinancialYear(chamaId, yearId),
      "Financial year closed."
    );

  const handleRefreshNow = () =>
    runAction(async () => {
      const res = await contributionPlanApi.runCalendarNow(chamaId);
      const summary = res.data?.data;
      if (summary) {
        setNotice({
          type: "success",
          text: `Calendar refreshed: ${summary.created} obligation(s) opened, ${summary.overdue} marked overdue, ${summary.reminders} reminder(s) sent${
            summary.penalties_raised || summary.penalties_grown
              ? `, ${summary.penalties_raised || 0} late penalt${summary.penalties_raised === 1 ? "y" : "ies"} added and ${summary.penalties_grown || 0} increased`
              : ""
          }.`,
        });
      }
    });

  const draftFor = (plan) =>
    scheduleDrafts[plan.id] || {
      category: plan.schedule.category,
      due_day: String(plan.schedule.due_day),
      grace_days: String(plan.schedule.grace_days),
      reminder_days_before: String(plan.schedule.reminder_days_before),
      start_month: toMonthInput(plan.start_month),
      end_month: toMonthInput(plan.end_month),
      aligned_to_calendar: plan.schedule.aligned_to_calendar,
    };

  const updateDraft = (planId, patch) =>
    setScheduleDrafts((prev) => ({
      ...prev,
      [planId]: { ...draftFor(overview.plans.find((p) => p.id === planId)), ...prev[planId], ...patch },
    }));

  const handleSaveSchedule = (plan) =>
    runAction(async () => {
      const draft = draftFor(plan);
      const payload = {
        owner_id: chamaId,
        owner_type: "Chama",
        category: draft.category,
        due_day: Number(draft.due_day),
        grace_days: Number(draft.grace_days),
        reminder_days_before: Number(draft.reminder_days_before),
        start_month: draft.start_month || undefined,
        end_month: draft.end_month === "" ? "" : draft.end_month || undefined,
        aligned_to_calendar: draft.aligned_to_calendar,
      };
      const res = await contributionPlanApi.configureSchedule(plan.id, payload);
      const outcome = res.data?.data?.outcome;
      setScheduleDrafts((prev) => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
      if (outcome) {
        const bits = [];
        if (outcome.rescheduled) bits.push(`${outcome.rescheduled} rescheduled`);
        if (outcome.cancelled) bits.push(`${outcome.cancelled} cancelled (fell outside the new window)`);
        if (outcome.created) bits.push(`${outcome.created} newly opened`);
        setNotice({
          type: "success",
          text: bits.length ? `Timings updated for ${plan.name}: ${bits.join(", ")}.` : `Timings updated for ${plan.name}.`,
        });
      }
    });

  const startLifecycle = (plan, action) =>
    setLifecycle({ plan, action, reason: "", cancelOpen: false, skipPaused: true });

  const confirmLifecycle = () =>
    runAction(async () => {
      const { plan, action, reason, cancelOpen, skipPaused } = lifecycle;
      let res;
      if (action === "pause") res = await contributionPlanApi.pausePlan(chamaId, plan.id, { reason });
      if (action === "resume") res = await contributionPlanApi.resumePlan(chamaId, plan.id, { skip_paused_periods: skipPaused });
      if (action === "archive") res = await contributionPlanApi.archivePlan(chamaId, plan.id, { reason, cancel_open_unpaid: cancelOpen });
      setLifecycle(null);
      const o = res?.data?.data?.outcome || {};
      const text = {
        pause: `${plan.name} paused. Nothing will open, turn overdue or accrue penalties until you resume it.`,
        resume: `${plan.name} resumed${o.skipped_periods?.length ? `; ${o.skipped_periods.length} paused period(s) will not be billed` : ""}${
          o.deadlines_moved ? `; ${o.deadlines_moved} open deadline(s) moved out` : ""
        }.`,
        archive: `${plan.name} archived. Its history is kept${o.cancelled_unpaid ? `; ${o.cancelled_unpaid} unpaid due(s) cancelled` : ""}.`,
      }[action];
      setNotice({ type: "success", text });
    });

  const handleRestore = (plan) =>
    runAction(
      () => contributionPlanApi.restorePlan(chamaId, plan.id),
      `${plan.name} restored as paused. Resume it when you want it to start billing again.`
    );

  const handleWizardDone = async (result) => {
    setShowWizard(false);
    setEditingPlan(null);
    if (result?.mode === "edit") {
      const o = result.outcome || {};
      const bits = [];
      if (o.repriced) bits.push(`${o.repriced} future period(s) repriced`);
      if (o.cancelled) bits.push(`${o.cancelled} cancelled`);
      if (o.created) bits.push(`${o.created} newly opened`);
      setNotice({ type: "success", text: `Contribution updated${bits.length ? `: ${bits.join(", ")}` : ""}. New amounts apply from the next period.` });
    } else {
      setNotice({ type: "success", text: result?.rotation ? "Merry-go-round set up." : "Contribution created and scheduled." });
    }
    await load();
  };

  const categories = overview?.categories || [];
  const years = overview?.years || [];
  const fy = overview?.financial_year;
  const summary = overview?.summary;
  const presets = overview?.presets || [];

  if (loading && !overview) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && <Notice tone={notice.type === "error" ? "error" : "success"}>{notice.text}</Notice>}

      {/* ---------------- Financial year ---------------- */}
      <SectionCard
        icon={CalendarRange}
        title="Financial year"
        description="Every contribution's calendar - MGR, welfare, shares, whatever this chama runs - is drawn inside this year. Kenyan chamas don't all run January-December, so set whatever range fits yours."
        action={
          fy ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 size={13} />
              Active: {fy.label}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle size={13} />
              No active year set
            </span>
          )
        }
      >
        {fy && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
            <div className="text-xs text-slate-600 dark:text-slate-300">
              <p className="font-black text-slate-900 dark:text-white">{fy.label}</p>
              <p>
                {toDateInput(fy.start_date)} to {toDateInput(fy.end_date)}
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleCloseYear(fy.id)}
              className="rounded-xl border border-rose-200 px-3.5 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/30"
            >
              Close this year early
            </button>
          </div>
        )}

        {years.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Past &amp; upcoming years</p>
            <div className="space-y-2">
              {years
                .filter((y) => y.id !== fy?.id)
                .map((y) => (
                  <div
                    key={y.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-2.5 text-xs dark:border-slate-800"
                  >
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {y.label} · {toDateInput(y.start_date)} to {toDateInput(y.end_date)} ·{" "}
                      <span className="capitalize text-slate-400">{y.status}</span>
                    </span>
                    {y.status !== "closed" && y.status !== "active" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleActivateYear(y.id)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                      >
                        Activate
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-800">
          <p className="mb-3 text-xs font-black text-slate-700 dark:text-slate-200">
            {fy ? "Start a new financial year" : "Set the financial year"}
          </p>

          {presets.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300"
                  title={p.description}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <InputField
              label="Label"
              value={newYear.label}
              onChange={(v) => setNewYear((n) => ({ ...n, label: v }))}
              placeholder="FY 2026/2027"
            />
            <InputField
              label="Start date"
              type="date"
              value={newYear.start_date}
              onChange={(v) => setNewYear((n) => ({ ...n, start_date: v }))}
            />
            <InputField
              label="End date"
              type="date"
              value={newYear.end_date}
              onChange={(v) => setNewYear((n) => ({ ...n, end_date: v }))}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={handleCreateYear}
            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-500 disabled:opacity-50"
          >
            <Plus size={14} />
            {fy ? "Create & activate (closes current year)" : "Create & activate"}
          </button>
        </div>
      </SectionCard>

      {!fy ? (
        <EmptyState
          icon={CalendarClock}
          title="Set the financial year to continue"
          detail="Contributions are scheduled inside a financial year, so nothing else on this tab is available until one is active."
        />
      ) : (
        <>
          {/* ---------------- Summary ---------------- */}
          {summary && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="Outstanding now" value={money(summary.outstanding_now)} icon={AlertTriangle} />
              <MetricCard title="Overdue members" value={summary.overdue_members} icon={Users} />
              <MetricCard title="Collected this period" value={money(summary.collected_this_period)} icon={CheckCircle2} />
              <MetricCard
                title="On the calendar"
                value={summary.aligned_plans}
                subtitle={`${summary.rolling_plans} rolling (not calendar-aligned)`}
                icon={CalendarClock}
              />
            </div>
          )}

          {/* ---------------- Contribution plans ---------------- */}
          <SectionCard
            icon={Settings2}
            title="Contribution obligations"
            description="Each contribution keeps its own start/end month, due day, grace period and reminder lead time - configure MGR to start in a different month than Welfare, for example. Merry-Go-Round rotations are still set up from the MGR page; align them to the calendar here once created."
            action={
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRefreshNow}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
                  Refresh now
                </button>
                <button
                  type="button"
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-md transition hover:bg-emerald-500"
                >
                  <Plus size={14} />
                  New contribution
                </button>
              </div>
            }
          >
            {(showWizard || editingPlan) && (
              <ContributionWizard
                chamaId={chamaId}
                behaviors={overview?.behaviors || []}
                templates={overview?.templates || []}
                plan={editingPlan}
                onClose={() => {
                  setShowWizard(false);
                  setEditingPlan(null);
                }}
                onDone={handleWizardDone}
              />
            )}

            {(overview?.plans || []).length === 0 ? (
              <EmptyState icon={CalendarClock} title="No contributions yet" detail="Create the first one above." />
            ) : (
              <div className="space-y-3">
                {overview.plans.map((plan) => {
                  const expanded = expandedPlanId === plan.id;
                  const draft = draftFor(plan);
                  const currentPeriod = plan.periods?.find((p) => p.key === plan.current_period_key);
                  return (
                    <div key={plan.id} className="rounded-2xl border border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setExpandedPlanId(expanded ? null : plan.id)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white">
                            {plan.name}{" "}
                            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {plan.category}
                            </span>
                            {plan.status === "paused" && (
                              <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                Paused
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {plan.aligned
                              ? `${plan.frequency} · due day ${plan.schedule.due_day} · ${
                                  plan.amount ? money(plan.amount) : "variable amount"
                                } per period`
                              : plan.can_align
                              ? "Not yet aligned to the calendar - configure it below."
                              : `${plan.frequency} contribution (rolling, not calendar-aligned)`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {plan.aligned && currentPeriod && (
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATE_TONE[currentPeriod.state] || STATE_TONE.upcoming}`}>
                              {currentPeriod.label}: {currentPeriod.paid_count}/{currentPeriod.members} paid
                              {currentPeriod.overdue_count > 0 ? ` · ${currentPeriod.overdue_count} overdue` : ""}
                            </span>
                          )}
                          {!plan.aligned && plan.legacy && plan.legacy.overdue_count > 0 && (
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${STATE_TONE.overdue}`}>
                              {plan.legacy.overdue_count} overdue
                            </span>
                          )}
                          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="space-y-4 border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                          {plan.status === "paused" && (
                            <Notice tone="info">
                              Paused{plan.paused_at ? ` since ${toDateInput(plan.paused_at)}` : ""}
                              {plan.pause_reason ? ` (${plan.pause_reason})` : ""}. No new periods open, nothing turns overdue and no penalties accrue.
                            </Notice>
                          )}
                          {plan.behavior !== "rotation" && (
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] text-slate-500">
                                Amount mode: {plan.amount_mode || "fixed"} · applies to{" "}
                                {plan.applies_to?.mode === "selected" ? `${plan.applies_to.count} selected member(s)` : "all members"}
                                {plan.member_amount_overrides?.length ? ` · ${plan.member_amount_overrides.length} custom amount(s)` : ""}
                                <br />
                                Late penalty: {plan.late_penalty?.summary || "None"}
                              </p>
                              <button
                                type="button"
                                onClick={() => setEditingPlan(plan)}
                                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Edit details
                              </button>
                            </div>
                          )}
                          {plan.aligned && plan.periods?.length > 0 && (
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[480px] text-left text-[11px]">
                                <thead className="text-slate-400">
                                  <tr>
                                    <th className="pb-2 font-bold">Month</th>
                                    <th className="pb-2 font-bold">Expected</th>
                                    <th className="pb-2 font-bold">Collected</th>
                                    <th className="pb-2 font-bold">Paid</th>
                                    <th className="pb-2 font-bold">Overdue</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {plan.periods.map((p) => (
                                    <tr
                                      key={p.key}
                                      className={`border-t border-slate-50 dark:border-slate-800/60 ${
                                        p.key === plan.current_period_key ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""
                                      }`}
                                    >
                                      <td className="py-1.5 font-semibold text-slate-700 dark:text-slate-300">{p.label}</td>
                                      <td className="py-1.5">{money(p.expected)}</td>
                                      <td className="py-1.5">{money(p.paid)}</td>
                                      <td className="py-1.5">
                                        {p.paid_count}/{p.members}
                                      </td>
                                      <td className={`py-1.5 ${p.overdue_count > 0 ? "font-bold text-rose-600" : ""}`}>{p.overdue_count}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {!plan.aligned && plan.legacy && (
                            <p className="text-xs text-slate-500">
                              {plan.legacy.open_count} open obligation(s), {money(plan.legacy.outstanding)} outstanding
                              {plan.legacy.next_due ? `, next due ${toDateInput(plan.legacy.next_due)}` : ""}.
                            </p>
                          )}

                          <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/40">
                            <p className="mb-3 text-xs font-black text-slate-700 dark:text-slate-200">
                              {plan.aligned ? "Reset timings" : "Configure & align to the calendar"}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                              <SelectField
                                label="Category"
                                value={draft.category}
                                onChange={(v) => updateDraft(plan.id, { category: v })}
                                options={categories.map((c) => ({ value: c.value, label: c.label }))}
                              />
                              <InputField
                                label="Start month"
                                type="month"
                                value={draft.start_month}
                                onChange={(v) => updateDraft(plan.id, { start_month: v })}
                              />
                              <InputField
                                label="End month"
                                type="month"
                                value={draft.end_month}
                                onChange={(v) => updateDraft(plan.id, { end_month: v })}
                                hint="Clear to make it ongoing"
                              />
                              <Stepper
                                label="Due day of the month"
                                value={draft.due_day}
                                onChange={(v) => updateDraft(plan.id, { due_day: String(v) })}
                                min={1}
                                max={31}
                              />
                              <Stepper
                                label="Grace days"
                                value={draft.grace_days}
                                onChange={(v) => updateDraft(plan.id, { grace_days: String(v) })}
                                min={0}
                                max={60}
                                suffix="days"
                              />
                              <Stepper
                                label="Reminder before due"
                                value={draft.reminder_days_before}
                                onChange={(v) => updateDraft(plan.id, { reminder_days_before: String(v) })}
                                min={0}
                                max={30}
                                suffix="days"
                              />
                            </div>
                            {plan.can_align && (
                              <div className="mt-3">
                                <ToggleRow
                                  label="Follow the financial year calendar"
                                  description="Monthly, quarterly and yearly contributions only."
                                  checked={Boolean(draft.aligned_to_calendar)}
                                  onChange={(v) => updateDraft(plan.id, { aligned_to_calendar: v })}
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleSaveSchedule(plan)}
                              className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                            >
                              Save &amp; apply
                            </button>
                            <p className="mt-2 text-[11px] text-slate-400">
                              Changing timings recomputes due dates for open obligations and re-arms reminders. Obligations already
                              paid are never touched; unpaid ones that fall outside the new window are cancelled.
                            </p>
                          </div>

                          {/* Pause / archive instead of delete */}
                          {plan.can_pause_or_archive && (
                            <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                              <p className="mb-1 text-xs font-black text-slate-700 dark:text-slate-200">Put this contribution on hold</p>
                              <p className="mb-3 text-[11px] text-slate-500">
                                Contributions are never deleted, so every payment and record stays. Pause it for a while, or archive it when it
                                is finished.
                              </p>
                              {lifecycle?.plan.id === plan.id ? (
                                <div className="space-y-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40">
                                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                    {lifecycle.action === "pause" && `Pause ${plan.name}?`}
                                    {lifecycle.action === "resume" && `Resume ${plan.name}?`}
                                    {lifecycle.action === "archive" && `Archive ${plan.name}?`}
                                  </p>
                                  {lifecycle.action === "pause" && (
                                    <p className="text-[11px] text-slate-500">
                                      No new periods will open, nothing will turn overdue and no penalties will accrue while it is paused.
                                    </p>
                                  )}
                                  {lifecycle.action !== "resume" && (
                                    <InputField
                                      label="Reason (optional)"
                                      value={lifecycle.reason}
                                      onChange={(v) => setLifecycle((l) => ({ ...l, reason: v }))}
                                      placeholder={lifecycle.action === "pause" ? "e.g. Off-season, project on hold" : "e.g. Land purchase completed"}
                                    />
                                  )}
                                  {lifecycle.action === "resume" && (
                                    <ToggleRow
                                      label="Skip the months that opened while paused"
                                      description="Deadlines that were still ahead move out by the length of the pause."
                                      checked={Boolean(lifecycle.skipPaused)}
                                      onChange={(v) => setLifecycle((l) => ({ ...l, skipPaused: v }))}
                                    />
                                  )}
                                  {lifecycle.action === "archive" && (
                                    <ToggleRow
                                      label="Cancel dues that are still open and unpaid"
                                      description="Anyone who has part-paid must finish paying (or be waived) first."
                                      checked={Boolean(lifecycle.cancelOpen)}
                                      onChange={(v) => setLifecycle((l) => ({ ...l, cancelOpen: v }))}
                                    />
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={busy}
                                      onClick={confirmLifecycle}
                                      className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setLifecycle(null)}
                                      className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {plan.status === "active" && (
                                    <button
                                      type="button"
                                      onClick={() => startLifecycle(plan, "pause")}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/30"
                                    >
                                      <Pause size={13} /> Pause
                                    </button>
                                  )}
                                  {plan.status === "paused" && (
                                    <button
                                      type="button"
                                      onClick={() => startLifecycle(plan, "resume")}
                                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                    >
                                      <Play size={13} /> Resume
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startLifecycle(plan, "archive")}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                                  >
                                    <Archive size={13} /> Archive
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {(overview?.archived_plans || []).length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Archived (history kept)</p>
                <div className="space-y-2">
                  {overview.archived_plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-2.5 text-xs dark:border-slate-800"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {plan.name}
                        <span className="ml-2 font-normal text-slate-400">
                          archived {toDateInput(plan.archived_at)}
                          {plan.archive_reason ? ` · ${plan.archive_reason}` : ""}
                        </span>
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleRestore(plan)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}