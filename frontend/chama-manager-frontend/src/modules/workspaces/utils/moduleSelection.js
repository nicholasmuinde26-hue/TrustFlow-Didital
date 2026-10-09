/**
 * Pure helpers for the workspace module picker. They mirror the rules in
 * be/src/constants/workspaceModules.constants.js (validateModuleSelection) so
 * the UI can warn before the server has to reject - the server stays the
 * authority.
 *
 * `catalog` is { groups, modules: [{ key, label, group, locked, requires, description }], presets }.
 */

export const keysOf = (catalog) => (catalog?.modules || []).map((m) => m.key);
export const lockedKeys = (catalog) => (catalog?.modules || []).filter((m) => m.locked).map((m) => m.key);

const byKey = (catalog) => Object.fromEntries((catalog?.modules || []).map((m) => [m.key, m]));

/** Selected keys always include the locked core modules. */
export function withLocked(catalog, keys = []) {
  return [...new Set([...lockedKeys(catalog), ...keys])];
}

/** Everything that is switched on but cannot work because a prerequisite is off. */
export function dependencyProblems(catalog, selected) {
  const index = byKey(catalog);
  const on = new Set(selected);
  const problems = [];
  for (const key of selected) {
    const missing = (index[key]?.requires || []).filter((req) => !on.has(req));
    if (missing.length) problems.push({ key, missing });
  }
  return problems;
}

/** Modules (currently on) that need `key`, directly or through another module. */
export function dependentsOf(catalog, key, selected) {
  const index = byKey(catalog);
  const on = new Set(selected);
  const found = new Set();
  const visit = (target) => {
    for (const m of catalog?.modules || []) {
      if (on.has(m.key) && !found.has(m.key) && (index[m.key].requires || []).includes(target)) {
        found.add(m.key);
        visit(m.key);
      }
    }
  };
  visit(key);
  return [...found];
}

/** `key` plus every prerequisite it needs, transitively. */
export function withPrerequisites(catalog, key) {
  const index = byKey(catalog);
  const out = new Set();
  const visit = (k) => {
    if (out.has(k) || !index[k]) return;
    out.add(k);
    (index[k].requires || []).forEach(visit);
  };
  visit(key);
  return [...out];
}

/** Diff between two selections - what an approver is being asked to do. */
export function diffSelections(current = [], target = []) {
  return {
    enable: target.filter((k) => !current.includes(k)),
    disable: current.filter((k) => !target.includes(k)),
  };
}

export const sameSelection = (a = [], b = []) =>
  a.length === b.length && a.every((k) => b.includes(k));

/** Which preset (if any) exactly matches this selection. */
export function matchPreset(catalog, selected) {
  const set = new Set(withLocked(catalog, selected));
  const hit = (catalog?.presets || []).find(
    (p) => p.modules.length === set.size && p.modules.every((k) => set.has(k))
  );
  return hit ? hit.key : "custom";
}
