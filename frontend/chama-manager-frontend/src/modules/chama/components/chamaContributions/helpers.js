import {
  Siren,
  Gem,
  Stethoscope,
  Flower2,
  ShoppingBag,
  CircleDollarSign,
} from "lucide-react";

// Amounts can arrive as numbers, numeric strings, or a raw Mongo Decimal128
// ({ $numberDecimal: "500.00" }). Always resolve to a finite number so a bad
// value can never render as "NaN".
export const toNumber = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const raw = typeof val === "object" ? val.$numberDecimal ?? String(val) : val;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

export const money = (val) => `KES ${toNumber(val).toLocaleString()}`;

export const compactMoney = (val) => {
  const n = toNumber(val);
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `KES ${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `KES ${n.toLocaleString()}`;
};

export const OFFICIAL_ROLES = ["chairperson", "treasurer", "secretary"];

export const PURPOSES = {
  emergency: { label: "Emergency", icon: Siren, tone: "text-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:text-rose-300" },
  wedding: { label: "Wedding", icon: Gem, tone: "text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-950/50 dark:text-fuchsia-300" },
  medical: { label: "Medical", icon: Stethoscope, tone: "text-sky-600 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300" },
  funeral: { label: "Funeral", icon: Flower2, tone: "text-slate-600 bg-slate-100 dark:bg-obsidian-raised dark:text-mist-muted" },
  purchase: { label: "Chama purchase", icon: ShoppingBag, tone: "text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300" },
  other: { label: "Other", icon: CircleDollarSign, tone: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300" },
};

export const purposeOf = (key) => PURPOSES[key] || PURPOSES.other;

export const STATUS = {
  pending_approval: { label: "Awaiting approval", dot: "bg-amber-500", chip: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  active: { label: "Collecting", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  closed: { label: "Collection closed", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600 dark:bg-obsidian-raised dark:text-mist-muted" },
  payout_pending: { label: "Payout in approval", dot: "bg-violet-500", chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
  completed: { label: "Paid out", dot: "bg-emerald-600", chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200" },
  rejected: { label: "Rejected", dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  cancelled: { label: "Cancelled", dot: "bg-slate-300", chip: "bg-slate-100 text-slate-500 dark:bg-obsidian-raised dark:text-mist-muted" },
};

export const statusOf = (key) => STATUS[key] || { label: key, dot: "bg-slate-400", chip: "bg-slate-100 text-slate-600" };

// The five stages a contribution moves through. Rejected and cancelled
// contributions leave the sequence, so they get no stepper.
export const STAGES = [
  { key: "pending_approval", label: "Proposed" },
  { key: "active", label: "Collecting" },
  { key: "closed", label: "Closed" },
  { key: "payout_pending", label: "Payout approval" },
  { key: "completed", label: "Paid out" },
];

export const stageIndex = (status) => STAGES.findIndex((s) => s.key === status);

export const getCollected = (c) =>
  c.balance !== undefined && c.balance !== null ? toNumber(c.balance) : toNumber(c.collected_amount);

export const getTarget = (c) => {
  const t = toNumber(c.target_amount);
  return t > 0 ? t : null;
};

export const getPct = (c) => {
  const t = getTarget(c);
  if (!t) return null;
  return Math.min(100, Math.round((getCollected(c) / t) * 100));
};

export const daysLeft = (c) => {
  if (!c.deadline || c.status !== "active") return null;
  const ms = new Date(c.deadline).setHours(23, 59, 59, 999) - Date.now();
  return Math.ceil(ms / 86_400_000);
};

export const deadlineLabel = (c) => {
  const d = daysLeft(c);
  if (d === null) return null;
  if (d < 0) return { text: `Deadline passed ${Math.abs(d)}d ago`, urgent: true };
  if (d === 0) return { text: "Closes today", urgent: true };
  if (d === 1) return { text: "1 day left", urgent: true };
  if (d <= 7) return { text: `${d} days left`, urgent: true };
  return { text: `${d} days left`, urgent: false };
};

export const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "";

export const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "M";

export const beneficiaryName = (c) => c.beneficiary_membership_id?.user_id?.name || null;

// What this viewer can do next on a contribution. One place decides, so the
// card, the drawer and the "needs attention" tab always agree.
export const nextStepFor = (c, { isOfficial, myMembershipId }) => {
  const approval = c.payout_approval;
  const iSigned = approval?.signed_by?.includes(String(myMembershipId));
  const iStartedIt = approval?.initiated_by && approval.initiated_by === String(myMembershipId);
  const fullyApproved = approval?.status === "approved";

  switch (c.status) {
    case "pending_approval":
      return isOfficial ? { key: "review", label: "Review request", attention: true } : null;
    case "active":
      return { key: "chip_in", label: "Chip in", attention: false };
    case "closed":
      return isOfficial ? { key: "propose_payout", label: "Propose payout", attention: true } : null;
    case "payout_pending":
      if (!isOfficial) return null;
      if (fullyApproved) return { key: "disburse", label: "Disburse", attention: true };
      if (!iSigned && !iStartedIt && approval?.status === "pending") {
        return { key: "sign_off", label: "Sign off payout", attention: true };
      }
      return null;
    default:
      return null;
  }
};

export const errMessage = (err) =>
  err?.response?.data?.message || err?.message || "Something went wrong";
