import { money, num, pct } from "./overview";

/* ==========================================================================
 * Pro Overview - pure derivation logic.
 *
 * Everything the Chairperson / Treasurer overview shows that is not a raw API
 * number is computed here, so each score, flag and to-do can be explained and
 * unit-tested without rendering anything.
 *
 * Colour logic (one rule, used everywhere):
 *   emerald = healthy   amber = needs attention   rose = risk
 * ========================================================================== */

export const DAY_MS = 86_400_000;

export const TARGET_TRUST = 80;

/** Higher is better. >= good -> emerald, >= warn -> amber, else rose. */
export const toneByPct = (value, good = 80, warn = 60) => {
  if (value == null || Number.isNaN(Number(value))) return "slate";
  const v = Number(value);
  return v >= good ? "emerald" : v >= warn ? "amber" : "rose";
};

/** Lower is better (loan-to-fund ratio, arrears share). */
export const toneByRatio = (value, safe = 40, watch = 60) => {
  if (value == null || Number.isNaN(Number(value))) return "slate";
  const v = Number(value);
  return v <= safe ? "emerald" : v <= watch ? "amber" : "rose";
};

export const worstTone = (tones) =>
  tones.includes("rose") ? "rose" : tones.includes("amber") ? "amber" : "emerald";

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many || `${one}s`}`;

export const daysFromNow = (value, now = new Date()) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return Math.round((d.setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY_MS);
};

/** "today", "tomorrow", "in 3 days", "2 days ago". */
export const relativeDay = (value, now = new Date()) => {
  const n = daysFromNow(value, now);
  if (n == null) return "soon";
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${Math.abs(n)} days ago`;
};

const memberName = (m) => m?.user_id?.name || m?.user?.name || m?.name || "Member";
const memberPhone = (m) => m?.user_id?.phone || m?.user?.phone || m?.phone || m?.phone_number || null;
const memberJoined = (m) => m?.joined_at || m?.createdAt || m?.created_at || null;
/** Phone for a collection row, matched to the members list by id then name. */
export function findMemberPhone(members = [], row) {
  const hit =
    members.find((m) => String(m._id ?? m.id) === String(row.id)) ||
    members.find((m) => memberName(m).toLowerCase() === String(row.name).toLowerCase());
  return hit ? memberPhone(hit) : null;
}

const roleKey = (m) => String(m?.role || "").toLowerCase().replace(/[\s-]/g, "_");

/* -------------------------------------------------------------------------- */
/* Health score                                                               */
/* -------------------------------------------------------------------------- */

// Weights are shown to the user in the "Why this score?" panel, so they are
// deliberately simple. Sub-scores with no data are left out and the remaining
// weights are re-normalised; the UI says how many signals the score rests on.
export const HEALTH_WEIGHTS = {
  contribution: 0.35,
  repayment: 0.3,
  kyc: 0.2,
  attendance: 0.15,
};

export const healthLabel = (score) =>
  score == null ? "Not enough data" : score >= 85 ? "Excellent" : score >= 70 ? "Healthy" : score >= 50 ? "Needs attention" : "At risk";

export function buildHealth({ collectionRate, repayment, kyc, attendance }) {
  const raw = { contribution: collectionRate, repayment, kyc, attendance };
  const parts = [
    { key: "contribution", label: "Contribution", hint: "Share of this cycle's expected contributions already paid." },
    { key: "repayment", label: "Repayment", hint: "Share of due loan instalments paid on time." },
    { key: "kyc", label: "KYC", hint: "Share of active members with a verified KYC record." },
    { key: "attendance", label: "Attendance", hint: "Share of members present at the last meeting." },
  ].map((p) => {
    const v = raw[p.key];
    const hasData = v != null && Number.isFinite(Number(v));
    const value = hasData ? Math.round(Number(v)) : null;
    return { ...p, value, hasData, weight: HEALTH_WEIGHTS[p.key], tone: toneByPct(value) };
  });

  const used = parts.filter((p) => p.hasData);
  const weightSum = used.reduce((a, p) => a + p.weight, 0);
  const score = used.length
    ? Math.round(used.reduce((a, p) => a + p.value * (p.weight / weightSum), 0))
    : null;

  return { score, label: healthLabel(score), tone: toneByPct(score, 85, 60), parts, signalsUsed: used.length, signalsTotal: parts.length };
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

const OFFICIAL_ROLES = [
  { key: "chairperson", label: "Chairperson" },
  { key: "treasurer", label: "Treasurer" },
  { key: "secretary", label: "Secretary" },
];

export function buildRoleCoverage(members = []) {
  const active = members.filter((m) => m.status === "active");
  const roles = OFFICIAL_ROLES.map((r) => {
    const holder = active.find((m) => roleKey(m) === r.key);
    return { ...r, filled: Boolean(holder), holder: holder ? memberName(holder) : null };
  });
  return { roles, missing: roles.filter((r) => !r.filled), complete: roles.every((r) => r.filled) };
}

export function buildMemberPulse(members = [], collection, now = new Date()) {
  const live = members.filter((m) => !["exited", "removed", "left"].includes(m.status));
  const active = live.filter((m) => m.status === "active");
  const pending = live.filter((m) => m.status === "pending");
  const inactive = live.filter((m) => !["active", "pending"].includes(m.status));

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const newThisMonth = live.filter((m) => {
    const j = memberJoined(m);
    return j && new Date(j).getTime() >= monthStart;
  });

  // Last 6 calendar months of joins / exits, oldest first.
  const buckets = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString("en-KE", { month: "short" }), joined: 0, exited: 0 };
  });
  const bucketOf = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return buckets.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`) || null;
  };
  members.forEach((m) => {
    const j = bucketOf(memberJoined(m));
    if (j) j.joined += 1;
    if (["exited", "removed", "left"].includes(m.status)) {
      const e = bucketOf(m.exited_at || m.left_at || m.updatedAt);
      if (e) e.exited += 1;
    }
  });

  const cm = collection?.members || [];
  const atRisk = cm
    .filter((m) => m.status !== "paid" && m.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  const top = cm
    .filter((m) => m.paid > 0)
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 3);

  const kycUnverified = live.filter((m) => {
    const s = String(m.kyc_status || m.kyc?.status || "").toLowerCase();
    return s && !["approved", "verified", "active"].includes(s);
  });

  return {
    total: live.length,
    active: active.length,
    inactive: inactive.length,
    pending: pending.length,
    newThisMonth,
    growth: buckets,
    atRisk,
    top,
    kycUnverified,
  };
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

const MPESA = /m-?pesa|mobile|paybill|till/i;
const BANK = /bank|equity|kcb|coop|co-op|ncba|absa|stanbic/i;
const PETTY = /petty|cash in hand|cash on hand|^cash$/i;

/** Splits treasury accounts into M-Pesa / Bank / Petty. Anything unclassified
 *  lands in `other` so the three parts always add up to the real total. */
export function buildTreasury(accounts = [], summary) {
  const rows = { mpesa: 0, bank: 0, petty: 0, other: 0 };
  let classified = false;
  accounts
    .filter((a) => /asset/i.test(String(a.type || a.account_type || "asset")))
    .forEach((a) => {
      const label = `${a.name || ""} ${a.category || ""} ${a.code || a.account_code || ""}`;
      const bal = num(a.balance);
      if (MPESA.test(label)) { rows.mpesa += bal; classified = true; }
      else if (BANK.test(label)) { rows.bank += bal; classified = true; }
      else if (PETTY.test(label)) { rows.petty += bal; classified = true; }
      else rows.other += bal;
    });
  const total = num(summary?.cash_balance);
  return { ...rows, total, classified };
}

/** Last N weeks vs the N before them. Returns null parts when there is no
 *  earlier window to compare against, so the UI can say so honestly. */
export function buildFlows(weeks = [], span = 4) {
  const sum = (arr, k) => arr.reduce((a, w) => a + num(w[k]), 0);
  const cur = weeks.slice(-span);
  const prev = weeks.slice(-span * 2, -span);
  const income = sum(cur, "income");
  const expense = sum(cur, "expense");
  const prevIncome = sum(prev, "income");
  const prevExpense = sum(prev, "expense");
  const net = income - expense;
  const prevNet = prevIncome - prevExpense;
  const hasPrev = prev.length >= Math.min(span, 2);
  const change = (now, before) => (hasPrev && before !== 0 ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null);
  return {
    weeks: cur.length,
    income, expense, net,
    incomeChange: change(income, prevIncome),
    expenseChange: change(expense, prevExpense),
    netChange: hasPrev ? net - prevNet : null,
  };
}

/** Loan-to-fund: the share of (cash + loans out) that is lent out. */
export function buildLoanToFund(summary) {
  const out = num(summary?.outstanding_loans);
  const base = num(summary?.cash_balance) + out;
  if (base <= 0) return { ratio: null, tone: "slate", zone: "No funds yet" };
  const ratio = Math.round((out / base) * 100);
  const tone = toneByRatio(ratio);
  return { ratio, tone, zone: tone === "emerald" ? "Safe zone" : tone === "amber" ? "Watch zone" : "Over-lent" };
}

/** Where the money sits. Only buckets the ledger really tracks. */
export function buildFundsBreakdown(summary) {
  const parts = [
    { key: "cash", label: "Cash & bank", value: num(summary?.cash_balance), color: "#10b981" },
    { key: "savings", label: "Member savings", value: num(summary?.savings_balance), color: "#8b5cf6" },
    { key: "loans", label: "Loans out", value: num(summary?.outstanding_loans), color: "#f59e0b" },
    { key: "business", label: "Business fund", value: num(summary?.business_balance), color: "#0ea5e9" },
  ].filter((p) => p.value > 0);
  const total = parts.reduce((a, p) => a + p.value, 0);
  return { parts: parts.map((p) => ({ ...p, pct: Math.round(pct(p.value, total)) })), total };
}

/* -------------------------------------------------------------------------- */
/* Loans                                                                      */
/* -------------------------------------------------------------------------- */

const loanDue = (l) => l.next_due_date || l.next_installment_date || l.next_installment_due || l.due_date || null;
const loanInstalment = (l) => num(l.next_installment_amount ?? l.installment_amount ?? l.instalment_amount ?? l.next_due_amount);

export function buildLoanWatch(rawLoans = [], now = new Date()) {
  const live = rawLoans.filter((l) => ["active", "partially_repaid", "disbursed", "overdue", "defaulted"].includes(l.status));
  const defaulted = rawLoans.filter((l) => l.status === "defaulted" || (l.status === "overdue" && num(l.days_overdue) > 0));
  const dueThisWeek = live
    .filter((l) => {
      const n = daysFromNow(loanDue(l), now);
      return n != null && n >= 0 && n <= 7;
    })
    .map((l) => ({ id: l.id || l._id, name: l.member_name || "Member", amount: loanInstalment(l), due: loanDue(l) }))
    .sort((a, b) => new Date(a.due) - new Date(b.due));
  const worst = defaulted.reduce((m, l) => Math.max(m, num(l.days_overdue)), 0);
  return {
    activeCount: live.length,
    defaultedCount: defaulted.length,
    worstDaysOverdue: worst,
    dueThisWeek,
    dueThisWeekAmount: dueThisWeek.reduce((a, l) => a + l.amount, 0),
  };
}

/* -------------------------------------------------------------------------- */
/* Meetings                                                                   */
/* -------------------------------------------------------------------------- */

export function buildMeetingState(meetings = [], now = new Date()) {
  const dated = meetings.filter((m) => m.startsAt && !Number.isNaN(new Date(m.startsAt).getTime()));
  const next = dated.filter((m) => new Date(m.startsAt) >= now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))[0] || null;
  const last = dated.filter((m) => new Date(m.startsAt) < now).sort((a, b) => new Date(b.startsAt) - new Date(a.startsAt))[0] || null;
  const daysSinceLast = last ? Math.max(0, Math.round((now - new Date(last.startsAt)) / DAY_MS)) : null;
  const attendance = last && last.attendedCount != null && num(last.invitedCount ?? last.expectedCount) > 0
    ? { attended: num(last.attendedCount), total: num(last.invitedCount ?? last.expectedCount) }
    : null;
  return {
    next,
    last,
    daysSinceLast,
    daysToNext: next ? daysFromNow(next.startsAt, now) : null,
    agendaPending: Boolean(next && !String(next.agenda || "").trim()),
    attendance,
    attendanceRate: attendance ? Math.round((attendance.attended / attendance.total) * 100) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Trust: "why is it 59, and how do I get it to 80?"                          */
/* -------------------------------------------------------------------------- */

export const TRUST_LABELS = {
  repayment: { label: "On-time repayment", fix: "Chase overdue instalments and agree repayment plans.", to: "loans" },
  kyc: { label: "KYC coverage", fix: "Ask members without a verified ID to submit KYC.", to: "members" },
  disputes: { label: "Dispute record", fix: "Resolve open disputes; fewer unresolved cases lift this.", to: "disputes" },
  auditIntegrity: { label: "Audit trail integrity", fix: "Run the audit chain check and clear any flagged entries.", to: "trust-timeline" },
  officialAccountability: { label: "Official accountability", fix: "Have members rate officials and use co-signers on large payouts.", to: "officials" },
};

export function buildTrustExplain(trust) {
  const score = trust?.score ?? null;
  const used = trust?.componentsUsed || [];
  const comps = Object.keys(TRUST_LABELS).map((key) => {
    const c = trust?.components?.[key];
    const hasData = Boolean(c?.hasData) && used.includes(key);
    return { key, ...TRUST_LABELS[key], hasData, score: hasData ? Math.round(num(c.score)) : null, tone: toneByPct(hasData ? num(c.score) : null) };
  });
  // Measured components below target are the real levers, lowest first.
  // Components with no data are not dragging the score (the backend leaves
  // them out), so they come last as "start tracking" suggestions.
  const lagging = comps
    .filter((c) => !c.hasData || c.score < TARGET_TRUST)
    .sort((a, b) => {
      if (a.hasData !== b.hasData) return a.hasData ? -1 : 1;
      return a.hasData ? a.score - b.score : 0;
    });
  return {
    score,
    grade: trust?.grade || null,
    gap: score == null ? null : Math.max(0, TARGET_TRUST - score),
    comps,
    lagging,
  };
}

/* -------------------------------------------------------------------------- */
/* Risk flags, governance to-dos, compliance                                  */
/* -------------------------------------------------------------------------- */

export function buildRiskFlags({ base, meeting, roles, kycPct, loanWatch, gl, collectionRate, collectionHasData, ltf }) {
  return [
    gl && gl.balanced === false && {
      key: "books", tone: "rose", title: "Books are out of balance",
      detail: `Ledger difference ${money(gl.difference)}`, cta: "Open trial balance", to: `${base}/finance/trial-balance`,
    },
    loanWatch?.defaultedCount > 0 && {
      key: "default", tone: "rose",
      title: `${plural(loanWatch.defaultedCount, "loan")} overdue${loanWatch.worstDaysOverdue ? `, worst ${loanWatch.worstDaysOverdue} days` : ""}`,
      detail: "Defaults erode repayment and the trust score.", cta: "Open loan book", to: `${base}/loans`,
    },
    meeting?.daysSinceLast != null && meeting.daysSinceLast > 30 && {
      key: "meeting", tone: meeting.daysSinceLast >= 45 ? "rose" : "amber",
      title: `No meeting in ${meeting.daysSinceLast} days`,
      detail: "Regular meetings are a core governance signal.", cta: "Schedule now", to: `${base}/meetings`,
    },
    meeting && !meeting.last && !meeting.next && {
      key: "meeting-none", tone: "amber", title: "No meeting on record",
      detail: "Schedule your first members meeting.", cta: "Schedule now", to: `${base}/meetings`,
    },
    kycPct != null && kycPct < 80 && {
      key: "kyc", tone: kycPct < 50 ? "rose" : "amber", title: `KYC coverage is ${Math.round(kycPct)}%`,
      detail: "Unverified members weigh down trust and compliance.", cta: "Review members", to: `${base}/members`,
    },
    roles?.missing?.length > 0 && {
      key: "roles", tone: "amber",
      title: `${roles.missing.map((r) => r.label).join(", ")} role vacant`,
      detail: "Every official seat should be filled.", cta: "Assign role", to: `${base}/members`,
    },
    collectionHasData && collectionRate != null && collectionRate < 50 && {
      key: "collection", tone: "rose", title: `Only ${Math.round(collectionRate)}% collected this cycle`,
      detail: "Send reminders before the cycle closes.", cta: "Fix arrears", to: `${base}/contributions`,
    },
    ltf?.ratio != null && ltf.ratio > 60 && {
      key: "ltf", tone: "rose", title: `${ltf.ratio}% of funds are lent out`,
      detail: "Liquidity is thin; hold new loans until repayments land.", cta: "Open loan book", to: `${base}/loans`,
    },
  ].filter(Boolean);
}

export function buildGovTodos({ base, loans, summary, meeting, hasGl }) {
  return [
    loans?.awaiting > 0 && {
      key: "loan", title: `Approve ${plural(loans.awaiting, "loan application")}`,
      detail: loans.pending?.[0] ? `${loans.pending[0].member_name || "Member"} · ${money(loans.pending[0].amount)}` : "Waiting on an official", to: `${base}/loans`,
    },
    num(summary?.pending_payouts) > 0 && {
      key: "payout", title: "Approve payouts", detail: `${money(summary.pending_payouts)} awaiting approval`, to: `${base}/finance/payouts`,
    },
    meeting && !meeting.next && {
      key: "sched", title: "Schedule the next meeting", detail: meeting.daysSinceLast != null ? `Last meeting ${meeting.daysSinceLast} days ago` : "None scheduled", to: `${base}/meetings`,
    },
    meeting?.agendaPending && {
      key: "agenda", title: "Draft the meeting agenda", detail: `Meeting ${relativeDay(meeting.next.startsAt)}`, to: `${base}/meetings`,
    },
    hasGl && num(summary?.failed_transactions) > 0 && {
      key: "recon", title: "Reconcile failed M-Pesa payments", detail: plural(summary.failed_transactions, "failed payment"), to: `${base}/finance/reconciliation`,
    },
  ].filter(Boolean);
}

export function buildCompliance({ roles, kycPct, meeting, gl, trust }) {
  const checks = [
    { key: "officials", label: "Chairperson, Treasurer and Secretary in place", ok: roles ? roles.complete : null, to: "members" },
    { key: "kyc", label: "KYC coverage at or above 80%", ok: kycPct == null ? null : kycPct >= 80, to: "members" },
    { key: "meeting", label: "Met within the last 30 days", ok: meeting?.daysSinceLast == null ? (meeting?.next ? true : null) : meeting.daysSinceLast <= 30, to: "meetings" },
    { key: "books", label: "Books balanced", ok: gl?.checkFailed ? null : gl ? gl.balanced !== false : null, to: "finance/trial-balance" },
    { key: "trust", label: `Trust score at or above ${TARGET_TRUST}`, ok: trust?.score == null ? null : trust.score >= TARGET_TRUST, to: "trust-score" },
  ];
  const known = checks.filter((c) => c.ok !== null);
  const failing = known.filter((c) => !c.ok);
  const passPct = known.length ? Math.round(((known.length - failing.length) / known.length) * 100) : null;
  const tone = failing.length === 0 ? "emerald" : failing.length >= 3 || checks.find((c) => c.key === "books" && c.ok === false) ? "rose" : "amber";
  return {
    checks, failing, passPct, tone,
    label: failing.length === 0 ? "Compliant" : "Action needed",
  };
}

/* -------------------------------------------------------------------------- */
/* Calendar strip: next 14 days                                               */
/* -------------------------------------------------------------------------- */

export function buildCalendar({ now = new Date(), meetings = [], loanWatch, contribDue, mgrDue }) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS);
    return { date: d, key: d.toISOString().slice(0, 10), events: [] };
  });
  const put = (value, kind, label) => {
    if (!value) return;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return;
    const slot = days.find((x) => x.date.toDateString() === d.toDateString());
    if (slot) slot.events.push({ kind, label });
  };
  meetings.forEach((m) => put(m.startsAt, "meeting", m.title || "Meeting"));
  (loanWatch?.dueThisWeek || []).forEach((l) => put(l.due, "loan", `${l.name} repayment`));
  put(contribDue, "contribution", "Contributions due");
  put(mgrDue, "mgr", "Merry-go-round due");
  return days;
}

/* -------------------------------------------------------------------------- */
/* Share text                                                                 */
/* -------------------------------------------------------------------------- */

export function buildSnapshotText({ name, health, treasury, collection, members, trust, compliance }) {
  return [
    `${name} - health snapshot`,
    health?.score != null ? `Health: ${health.score}/100 (${health.label})` : null,
    `Treasury: ${money(treasury)}`,
    collection?.rate != null ? `Collected this cycle: ${Math.round(collection.rate)}%` : null,
    members ? `Members: ${members.active} active of ${members.total}` : null,
    trust?.score != null ? `Trust score: ${trust.score}${trust.grade ? ` (${trust.grade})` : ""}` : null,
    compliance ? `Compliance: ${compliance.label}` : null,
    `Every shilling accounted for.`,
  ].filter(Boolean).join("\n");
}

/* -------------------------------------------------------------------------- */
/* One priority list                                                          */
/* -------------------------------------------------------------------------- */

// Risk flags, system alerts and governance to-dos overlap (the same failed
// payment or loan decision can surface in all three). Merge them into one
// list, de-duplicated by topic and ordered by how much each matters.
const TOPIC = { books: "books", failed: "failed", recon: "failed", loans: "loan", loan: "loan", payouts: "payout", payout: "payout", default: "default" };
const TONE_ORDER = { rose: 0, amber: 1, violet: 2, sky: 3, emerald: 4, slate: 5 };

export function buildPriorityList({ risks = [], alerts = [], todos = [] }) {
  const seen = new Set();
  const out = [];
  const push = (item, tone, detail) => {
    const topic = TOPIC[item.key] || item.key;
    if (seen.has(topic)) return;
    seen.add(topic);
    out.push({ key: topic, tone, title: item.title, detail, to: item.to, icon: item.icon });
  };
  risks.forEach((r) => push(r, r.tone, `${r.detail} · ${r.cta}`));
  alerts.forEach((a) => push(a, a.tone, a.sub));
  todos.forEach((t) => push(t, "violet", t.detail));
  return out.sort((a, b) => (TONE_ORDER[a.tone] ?? 9) - (TONE_ORDER[b.tone] ?? 9));
}
