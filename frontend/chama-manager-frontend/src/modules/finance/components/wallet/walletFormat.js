// Shared helpers for the member wallet UI. Pure functions only.

export const PHONE_STORAGE_KEY = "wallet:phone";
export const HIDE_STORAGE_KEY = "wallet:hide-balance";

export const readStored = (key, fallback = "") => {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage can be unavailable (private mode) — the wallet still works */
  }
};

// Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX and
// returns the 254XXXXXXXXX form the M-Pesa API expects, or null if invalid.
export const normalizePhone = (raw) => {
  const digits = String(raw || "").replace(/\D/g, "");
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
};

export const maskPhone = (phone) => {
  const p = String(phone || "");
  return p.length >= 9 ? `${p.slice(0, 5)}•••${p.slice(-3)}` : p || "—";
};

const SOURCE_LABELS = {
  Payout: "Chama payout",
  Withdrawal: "Savings withdrawal",
  ChamaLoan: "Loan disbursement",
  MemberExitRequest: "Membership exit refund",
  SavingsShareoutItem: "Savings shareout",
  ChamaContribution: "Contribution payout",
  ChamaAssetDistribution: "Business profit share",
};

// direction: "in" adds to the wallet, "out" takes from it.
export const describeEntry = (entry) => {
  if (entry.type === "deposit") {
    return { title: "Top-up from M-Pesa", subtitle: "Added to your wallet", direction: "in" };
  }
  if (entry.type === "withdrawal") {
    return { title: "Sent to M-Pesa", subtitle: "Withdrawn from your wallet", direction: "out" };
  }
  return {
    title: SOURCE_LABELS[entry.source_type] || "Chama disbursement",
    subtitle: "Paid into your wallet by your chama",
    direction: "in",
  };
};

export const STATUS_LABEL = { pending: "Processing", completed: "Completed", failed: "Failed" };

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

export const dayLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};

export const timeLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });
};

export const fullDateTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export const groupByDay = (entries) => {
  const groups = [];
  for (const entry of entries) {
    const label = dayLabel(entry.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(entry);
    else groups.push({ label, items: [entry] });
  }
  return groups;
};

export const kes = (value) =>
  `KES ${Number(value || 0).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
