// Which parts of a chama are locked by its subscription plan.
//
// A module is locked only when billing is actually enforced (the server says so
// in the billing summary) and the plan does not include it. Until the summary
// has loaded nothing is treated as locked, so there is never a flash of locked
// icons or a wrong redirect.

const LABELS = {
  contributions: "Contributions",
  savings: "Savings",
  savings_shareout: "Savings share-out",
  mgr: "Merry-go-round",
  payouts: "Payouts",
  withdrawals: "Withdrawals",
  loans: "Loans",
  assets: "Chama assets",
  meetings: "Meetings",
  polls: "Polls",
  announcements: "Announcements",
  chat: "Messages",
  trust: "Trust score",
  officials: "Officials",
  disputes: "Disputes",
  burial_welfare: "Burial welfare",
  equipment_hire: "Equipment hire",
  fundraising: "Fundraising",
};

export const moduleLabel = (key) =>
  LABELS[key] ||
  String(key || "")
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());

export function isModuleLocked(summary, moduleKey) {
  if (!moduleKey || !summary || summary.enforced !== true) return false;
  const included = summary.plan?.modules;
  if (!Array.isArray(included)) return false;
  return !included.includes(moduleKey);
}

/** Cheapest paid plan that includes the module, from the chama's plan list. */
export function cheapestPlanWith(plans = [], moduleKey) {
  return (
    [...plans]
      .filter((p) => p.price_monthly > 0 && Array.isArray(p.modules) && p.modules.includes(moduleKey))
      .sort((a, b) => a.price_monthly - b.price_monthly)[0] || null
  );
}

/** Return the nav sections with `locked: true` on items the plan does not include. */
export function markLockedItems(sections, summary) {
  if (!summary || summary.enforced !== true) return sections;
  return sections.map((section) => ({
    ...section,
    items: (section.items || []).map((item) =>
      isModuleLocked(summary, item.module) ? { ...item, locked: true } : item
    ),
  }));
}