import { CATEGORY_LABELS } from "@/modules/finance/services/finance.service";

// Coerce to a finite number (handles Mongo Decimal128, strings, null).
export const num = (v) => {
  if (v && typeof v === "object" && "$numberDecimal" in v) v = v.$numberDecimal;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const money = (v) =>
  `KES ${num(v).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;

// 1.2M / 45K / 980 - for axes and collapsed section summaries.
export const compact = (v) => {
  const n = num(v);
  const a = Math.abs(n);
  const f = (x, s) => `${Math.round(x * 10) / 10}${s}`;
  if (a >= 1e6) return f(n / 1e6, "M");
  if (a >= 1e3) return f(n / 1e3, "K");
  return String(Math.round(n));
};

export const pct = (part, whole) => (num(whole) > 0 ? Math.min(100, (num(part) / num(whole)) * 100) : 0);

const ROLE_LABELS = {
  member: "Member", treasurer: "Treasurer", secretary: "Secretary", auditor: "Auditor",
  chairperson: "Chairperson", committee_member: "Committee Member", patron: "Patron",
};
export const roleLabel = (role) => {
  if (!role) return "Member";
  const k = String(role).toLowerCase();
  return ROLE_LABELS[k] || k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " ");
};

export const greeting = (hour) =>
  hour >= 5 && hour < 12 ? "Good morning" : hour < 17 && hour >= 12 ? "Good afternoon" : hour >= 17 && hour < 21 ? "Good evening" : "Good night";

export const formatWhen = (value, withTime = true) => {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "Recent";
  return d.toLocaleString("en-KE", withTime
    ? { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
};

// ── Money-movement direction & status (one place, so every table agrees) ──
const INFLOW = new Set(["deposit", "contribution", "contribution_payment", "mgr_contribution", "chama_contribution_payment", "loan_repayment", "sale"]);
const OUTFLOW = new Set(["withdrawal", "payout", "payout_settlement", "loan_disbursement", "expense", "customer_payout"]);
export const directionOf = (type) => (INFLOW.has(type) ? "in" : OUTFLOW.has(type) ? "out" : null);

export const statusOf = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (["completed", "success", "successful", "posted", "paid"].includes(s)) return "Success";
  if (["failed", "rejected", "cancelled", "canceled", "reversed"].includes(s)) return "Failed";
  return "Pending";
};

export const CATEGORY_BADGE = {
  deposit: "bg-violet-100 text-violet-700 dark:bg-mint-deep/60 dark:text-mint",
  contribution_payment: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  mgr_contribution: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  chama_contribution_payment: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  loan_disbursement: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
  loan_repayment: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  payout: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};
export const DEFAULT_BADGE = "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted";

export const normalizeTransaction = (t, i) => {
  const type = String(t.transaction_type || t.category || "").toLowerCase();
  return {
    id: t._id || t.id || t.reference || i,
    title: t.reference || t.description || "Transaction",
    category: type,
    categoryLabel: CATEGORY_LABELS[type] || (type ? type.replace(/_/g, " ") : "Other"),
    amount: num(t.amount),
    direction: directionOf(type),
    status: statusOf(t.status),
    at: t.completed_at || t.created_at || t.createdAt || t.posted_at || null,
  };
};

export const normalizeMyPayment = (p, i) => ({
  id: p.id || p._id || i,
  title: p.reference ? `Contribution · ${p.reference}` : "Your contribution",
  category: "contribution_payment",
  categoryLabel: CATEGORY_LABELS.contribution_payment,
  amount: num(p.amount),
  direction: "in",
  status: statusOf(p.status),
  at: p.paid_at || p.created_at || null,
});

// ── Per-member contribution position (GET /mgr/contributions/:id) ──
export function buildCollection(data) {
  const plan = data?.activePlan || null;
  const planAmount = plan?.amount != null ? num(plan.amount)
    : plan?.contribution_rule?.uniform_amount != null ? num(plan.contribution_rule.uniform_amount) : 0;
  const members = (data?.members || []).map((m, i) => {
    const expected = num(m.expected) || planAmount;
    const paid = num(m.paid);
    const status = m.status === "paid" ? "paid"
      : !expected ? (paid > 0 ? "paid" : "unpaid")
      : paid >= expected ? "paid" : paid > 0 ? "partial" : "unpaid";
    return { id: String(m._id ?? i), name: m.user_id?.name || `Member ${i + 1}`, expected, paid, balance: Math.max(0, expected - paid), status };
  });
  const sum = (k) => members.reduce((a, m) => a + m[k], 0);
  const expected = sum("expected");
  const paid = sum("paid");
  const counts = { paid: 0, partial: 0, unpaid: 0 };
  members.forEach((m) => { counts[m.status] += 1; });
  return {
    hasData: members.length > 0,
    planName: plan?.name || plan?.title || null,
    members, expected, paid, balance: sum("balance"), counts,
    rate: expected > 0 ? Math.round((paid / expected) * 1000) / 10 : null,
  };
}

// ── Current merry-go-round (GET /mgr/overview/:id) ──
export function buildMgr(data) {
  const round = data?.currentRound || null;
  const obligations = data?.obligations || [];
  const total = obligations.length || data?.policy?.participants?.length || 0;
  const paid = obligations.filter((o) => o.status === "paid").length;
  const expected = num(round?.expected_amount);
  const collected = num(round?.collected_amount);
  return {
    hasPolicy: Boolean(data?.hasPolicy),
    active: Boolean(round),
    number: round?.round_number || 1,
    due: round?.due_date || null,
    expected, collected, pct: pct(collected, expected),
    recipient: round?.recipient_id?.user_id?.name || round?.recipient_id?.name || null,
    paid, total, pending: Math.max(0, total - paid),
    roundCount: (data?.rounds || []).length,
  };
}

// ── Loan book (loanService.getDashboard → portfolio, officials only) ──
const BUCKETS = [
  { key: "active", label: "Active", color: "#0ea5e9", statuses: ["active", "partially_repaid", "disbursed"] },
  { key: "pending", label: "Pending", color: "#f59e0b", statuses: ["pending_approval", "pending_guarantee", "approved", "eligible"] },
  { key: "overdue", label: "Overdue", color: "#f97316", statuses: ["overdue"] },
  { key: "defaulted", label: "Defaulted", color: "#ef4444", statuses: ["defaulted"] },
  { key: "closed", label: "Closed", color: "#10b981", statuses: ["closed"] },
];
export function buildLoans(dash) {
  const p = dash?.portfolio;
  if (!p) return null;
  const s = p.summary || {};
  const loans = p.loans || [];
  const pending = loans.filter((l) => ["pending_approval", "eligible", "approved"].includes(l.status));
  return {
    outstanding: num(s.total_outstanding),
    count: num(s.loan_count) || loans.length,
    repayment: typeof s.repayment_rate_percent === "number" ? s.repayment_rate_percent : null,
    allCurrent: Boolean(s.all_loans_current),
    atRisk: num(s.overdue) + num(s.defaulted),
    interest: num(s.interest_earned),
    awaiting: num(s.awaiting_decision_count) || pending.length,
    pending,
    buckets: BUCKETS.map((b) => ({ ...b, value: loans.filter((l) => b.statuses.includes(l.status)).length })),
  };
}