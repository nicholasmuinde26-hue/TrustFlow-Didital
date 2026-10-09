// ============================================================
// SAMPLE DATA for features that have no backend source yet.
//
// Everything real (balances, contributions, ledger, reconciliation
// sessions, payments) comes from your hooks and services. Only the
// blocks below fall back to this file, and each of those renders a
// "Sample data" tag so illustrative numbers are never passed off as
// real ones.
//
// Set SHOW_SAMPLE to false to hide every sample-backed block, for
// example once the matching endpoints exist.
// ============================================================

export const SHOW_SAMPLE = true;

const now = () => Date.now();
const mins = (m) => new Date(now() - m * 60_000).toISOString();
const days = (d) => new Date(now() - d * 86_400_000).toISOString();

// Constitution rules. The engine in ContributionsPage applies these to
// real arrears. Editing them belongs in the Leadership Desk.
export const PENALTY_RULES = [
  { id: "late", type: "Late fee", label: "Paid more than 2 days after the due date", graceDays: 2, fee: 500 },
  { id: "missed", type: "Missed cycle fee", label: "Nothing paid by the end of the cycle", graceDays: 30, fee: 1000 },
  { id: "bounced", type: "Bounced M-Pesa fee", label: "Reversed or failed M-Pesa payment", graceDays: 0, fee: 300 },
];

export const SAMPLE_PAYBILL = { paybill: "400200" };

export const SAMPLE_FEED = () => [
  { id: "f1", name: "Mary Wambui", amount: 5000, code: "QKJ4T7M2XA", at: mins(4), status: "completed" },
  { id: "f2", name: "Grace Achieng", amount: 2500, code: "QKJ4T3B8LP", at: mins(38), status: "completed" },
  { id: "f3", name: "Esther Njeri", amount: 1000, code: "QKJ4S9C1RD", at: mins(95), status: "completed" },
  { id: "f4", name: "Lucy Wanjiru", amount: 5000, code: "—", at: mins(130), status: "pending" },
];

export const SAMPLE_UNMATCHED = () => [
  { id: "u1", code: "QKJ4R2N7YT", amount: 2000, payer: "J KAMAU", phone: "0722 *** 481", at: mins(210) },
  { id: "u2", code: "QKJ4Q8D5WE", amount: 500, payer: "P OTIENO", phone: "0711 *** 092", at: days(1) },
];

// ---------- treasury ----------
export const SAMPLE_MONTHS = () => {
  const out = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(m.toLocaleDateString("en-KE", { month: "short" }));
  }
  return out;
};
export const SAMPLE_INCOME = [118000, 126000, 121000, 139000, 147000, 158000];
export const SAMPLE_EXPENSE = [64000, 71000, 69000, 76000, 83000, 81000];

export const SAMPLE_EXPENSE_CATS = [
  { label: "Welfare payouts", value: 38000, color: "#10b981" },
  { label: "Loans disbursed", value: 24000, color: "#6366f1" },
  { label: "Office", value: 9500, color: "#f59e0b" },
  { label: "Bank charges", value: 5400, color: "#f43f5e" },
  { label: "M-Pesa fees", value: 4100, color: "#0ea5e9" },
];

export const SAMPLE_WALLETS = [
  { label: "Welfare", pct: 60, color: "#10b981" },
  { label: "Investment", pct: 30, color: "#6366f1" },
  { label: "Emergency", pct: 10, color: "#f59e0b" },
];

export const SAMPLE_PETTY = { custodian: "Treasurer", location: "Group office", onHand: 4200 };
export const SAMPLE_BANK = { name: "Equity", masked: "**9012" };

export const SAMPLE_APPROVALS = () => [
  { id: "a1", title: "Hall hire for AGM", amount: 18000, by: "Treasurer", at: mins(55), channel: "Bank", category: "Office" },
  { id: "a2", title: "Printing of member cards", amount: 12500, by: "Treasurer", at: days(1), channel: "M-Pesa", category: "Office" },
];

export const SAMPLE_UNCLEARED = () => [
  { id: "c1", ref: "CHQ-0412", description: "Cheque to hall owner", amount: -6000, date: days(3) },
];

export const SAMPLE_RECON_HISTORY = () => [
  { id: "r1", period: "Sep 2026", status: "completed", by: "Treasurer", at: days(6), difference: 0 },
  { id: "r2", period: "Aug 2026", status: "completed", by: "Treasurer", at: days(37), difference: 0 },
  { id: "r3", period: "Jul 2026", status: "completed", by: "Treasurer", at: days(68), difference: 350 },
];

export const SAMPLE_AUDIT = () => [
  { id: "x1", action: "Expense LDG-10294 approved", by: "Chairperson", at: mins(40), hash: "9f3c1a7e" },
  { id: "x2", action: "Expense LDG-10294 created", by: "Treasurer", at: mins(52), hash: "41be08d2" },
  { id: "x3", action: "Bank statement reconciled", by: "Treasurer", at: days(6), hash: "c07a55f9" },
];