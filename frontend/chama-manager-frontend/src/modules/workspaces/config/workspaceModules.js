/**
 * Workspace modules (frontend side)
 * ---------------------------------
 * The backend decides WHICH modules a chama has
 * (be/src/constants/workspaceModules.constants.js) and sends the enabled keys
 * with every workspace as `workspace.modules`. This file only knows which
 * ROUTES belong to which module, so one map drives:
 *
 *   - sidebar / drawer / command-palette navigation  (workspaceNavigation.js)
 *   - the route guard in WorkspaceLayout              (deep links)
 *   - dashboard quick actions and Leadership Desk tabs
 *
 * Paths are relative to /workspace/:workspaceId/. A route that is not listed
 * here belongs to a locked core module (members, books, settings) and is
 * always available.
 *
 * Matching is by whole path segment, longest first, so "finance/savings"
 * does not swallow "finance/savings-shareout".
 *
 * `modules` undefined/null means "no module information" (older cached
 * payload, contribution groups, businesses): nothing is hidden.
 */

export const MODULE_ROUTES = {
  contributions: ["contributions", "finance/contributions", "finance/record-contribution", "chama-contributions"],
  savings: ["finance/savings"],
  savings_shareout: ["finance/savings-shareout"],
  mgr: ["mgr"],
  payouts: ["finance/payouts"],
  withdrawals: ["finance/withdrawals"],
  loans: ["loans"],
  assets: ["assets"],
  meetings: ["meetings"],
  polls: ["polls"],
  announcements: ["announcements"],
  chat: ["chat"],
  trust: ["trust-score", "trust-timeline"],
  officials: ["officials"],
  disputes: ["disputes"],
  burial_welfare: ["burial-chama-setup", "beneficiaries", "burial-cases", "member-statement"],
  equipment_hire: ["equipment-hire"],
  fundraising: ["fundraising"],
};

// Flattened + sorted once: longest prefix first.
const ROUTE_TABLE = Object.entries(MODULE_ROUTES)
  .flatMap(([module, prefixes]) => prefixes.map((prefix) => ({ module, prefix })))
  .sort((a, b) => b.prefix.length - a.prefix.length);

const CHAMA_BACKED = ["chama", "burial-chama"];

export const isChamaBackedType = (type) => CHAMA_BACKED.includes(type);

/** "loans/123" -> "loans"; "finance/ledger" -> null (core). */
export function moduleForPath(relativePath = "") {
  const clean = String(relativePath).split(/[?#]/)[0].replace(/^\/+|\/+$/g, "");
  if (!clean) return null;
  const hit = ROUTE_TABLE.find(({ prefix }) => clean === prefix || clean.startsWith(`${prefix}/`));
  return hit ? hit.module : null;
}

/** Is this module switched on? Unknown module info => allowed. */
export function hasModule(modules, key) {
  if (!Array.isArray(modules)) return true;
  return modules.includes(key);
}

/** Is a workspace-relative path reachable given the enabled modules? */
export function isPathEnabled(modules, relativePath) {
  if (!Array.isArray(modules)) return true;
  const module = moduleForPath(relativePath);
  return module === null || modules.includes(module);
}

/** Strip "/workspace/:id" from a full pathname. */
export function relativeWorkspacePath(pathname = "", workspaceId = "") {
  const prefix = `/workspace/${workspaceId}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length).replace(/^\/+/, "") : "";
}
