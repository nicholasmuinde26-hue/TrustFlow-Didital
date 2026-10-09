/**
 * ============================================================================
 * WORKSPACE MODULE CATALOG
 * ============================================================================
 *
 * The single source of truth for "what can a chama workspace contain".
 *
 *   - Each MODULE is one switchable feature (loans, MGR, assets, polls ...).
 *   - A chama stores which modules it has in `Chama.workspace_config`.
 *   - The backend enforces it (middleware/module.middleware.js -> requireModule)
 *     and ships the enabled list to the frontend with the workspace payload, so
 *     navigation, route guards and the command palette all hide what a chama
 *     chose not to have.
 *
 * Presets reuse the names already accepted by chama.service.js (CHAMA_PRESETS)
 * so there is only ONE "preset" concept in the system. `standard` is added as
 * the legacy "everything a standard chama had before configurability" set.
 *
 * Module fields
 *   key        stable id, stored in the DB. NEVER rename once shipped.
 *   label      shown to admins in the setup picker
 *   group      picker section
 *   locked     always on, cannot be switched off
 *   requires   other modules that must be on for this one to work
 *   description one line for the picker
 * ============================================================================
 */

export const MODULE_GROUPS = Object.freeze([
  { key: 'core', label: 'Core' },
  { key: 'money', label: 'Money & contributions' },
  { key: 'lending', label: 'Lending' },
  { key: 'portfolio', label: 'Assets, property & businesses' },
  { key: 'governance', label: 'Meetings & communication' },
  { key: 'trust', label: 'Trust & accountability' },
  { key: 'welfare', label: 'Welfare / burial' },
]);

export const WORKSPACE_MODULES = Object.freeze({
  // ---- core (locked) ------------------------------------------------------
  members: {
    label: 'Members & roles',
    group: 'core',
    locked: true,
    requires: [],
    description: 'Member list, roles, invitations and the leadership desk.',
  },
  finance_core: {
    label: 'Books & financial statements',
    group: 'core',
    locked: true,
    requires: [],
    description: 'Wallet, ledger, transactions, bank accounts, statements and reports.',
  },
  settings: {
    label: 'Governance & settings',
    group: 'core',
    locked: true,
    requires: [],
    description: 'Chama governance policies, roles and workspace configuration.',
  },

  // ---- money --------------------------------------------------------------
  contributions: {
    label: 'Contributions',
    group: 'money',
    requires: ['finance_core'],
    description: 'Contribution plans, recording and tracking what members owe.',
  },
  savings: {
    label: 'Savings',
    group: 'money',
    requires: ['contributions'],
    description: 'Free-will member savings.',
  },
  savings_shareout: {
    label: 'Savings share-out',
    group: 'money',
    requires: ['savings'],
    description: 'Policy-driven division of savings back to members.',
  },
  mgr: {
    label: 'Merry-go-round',
    group: 'money',
    requires: ['contributions'],
    description: 'Rotating payouts between members.',
  },
  payouts: {
    label: 'Payouts',
    group: 'money',
    requires: ['finance_core'],
    description: 'Paying money out of the chama to members.',
  },
  withdrawals: {
    label: 'Member withdrawals',
    group: 'money',
    requires: ['savings'],
    description: 'Member withdrawal requests and policies.',
  },

  // ---- lending ------------------------------------------------------------
  loans: {
    label: 'Loans',
    group: 'lending',
    requires: ['finance_core'],
    description: 'Member loans, guarantors, approvals and repayments.',
  },

  // ---- portfolio ----------------------------------------------------------
  assets: {
    label: 'Asset portfolio',
    group: 'portfolio',
    requires: ['finance_core'],
    description: 'Property, vehicles, equipment, investments and proposals.',
  },
  businesses: {
    label: 'Chama businesses',
    group: 'portfolio',
    requires: ['assets'],
    description: 'Chama-owned business workspaces and their progress on the Leadership Desk.',
  },
  property_leases: {
    label: 'Property, leases & compliance',
    group: 'portfolio',
    requires: ['assets'],
    description: 'Tenancies, rent, and compliance obligations for owned property.',
  },

  // ---- governance / communication ----------------------------------------
  meetings: { label: 'Meetings', group: 'governance', requires: [], description: 'Meeting records and minutes.' },
  polls: { label: 'Polls & voting', group: 'governance', requires: [], description: 'Member polls.' },
  announcements: { label: 'Announcements', group: 'governance', requires: [], description: 'Broadcast notices to members.' },
  chat: { label: 'Chat', group: 'governance', requires: [], description: 'Member messaging.' },

  // ---- trust --------------------------------------------------------------
  trust: { label: 'Trust score & timeline', group: 'trust', requires: ['finance_core'], description: 'Chama trust score and trust timeline.' },
  officials: { label: 'Official accountability', group: 'trust', requires: [], description: 'Rating and reviewing officials.' },
  disputes: { label: 'Disputes', group: 'trust', requires: [], description: 'Raising and resolving disputes.' },

  // ---- welfare ------------------------------------------------------------
  burial_welfare: {
    label: 'Burial & welfare cover',
    group: 'welfare',
    requires: ['contributions'],
    description: 'Beneficiaries, burial cases, member statements and setup wizard.',
  },
  equipment_hire: {
    label: 'Equipment & tent hire',
    group: 'welfare',
    requires: ['assets'],
    description: 'Hiring out tents, chairs and equipment.',
  },
  fundraising: {
    label: 'Harambee & fundraising',
    group: 'welfare',
    requires: ['finance_core'],
    description: 'Fundraising drives.',
  },
});

export const MODULE_KEYS = Object.freeze(Object.keys(WORKSPACE_MODULES));
export const LOCKED_MODULE_KEYS = Object.freeze(
  MODULE_KEYS.filter((key) => WORKSPACE_MODULES[key].locked)
);

const without = (keys) => MODULE_KEYS.filter((key) => !keys.includes(key));
const only = (keys) => [...new Set([...LOCKED_MODULE_KEYS, ...keys])];

/**
 * PRESETS -> which modules start enabled.
 *
 * `standard` and `burial` reproduce EXACTLY what those two chama types showed
 * in the old hardcoded navigation, so migrating existing chamas changes
 * nothing for them. The other presets are sensible starting points that an
 * admin then adjusts module by module.
 */
export const WORKSPACE_PRESETS = Object.freeze({
  standard: {
    label: 'Standard chama (everything)',
    modules: without(['burial_welfare', 'equipment_hire', 'fundraising']),
  },
  burial: {
    label: 'Burial / welfare chama',
    modules: only([
      'contributions', 'savings', 'payouts', 'loans',
      'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements',
      'burial_welfare', 'equipment_hire', 'fundraising',
    ]),
  },
  burial_welfare: {
    label: 'Burial / welfare chama',
    modules: only([
      'contributions', 'savings', 'payouts', 'loans',
      'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements',
      'burial_welfare', 'equipment_hire', 'fundraising',
    ]),
  },
  merry_go_round: {
    label: 'Merry-go-round',
    modules: only(['contributions', 'mgr', 'payouts', 'meetings', 'polls', 'announcements', 'chat']),
  },
  table_banking: {
    label: 'Table banking',
    modules: only([
      'contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans',
      'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes',
    ]),
  },
  investment: {
    label: 'Investment group',
    modules: only([
      'contributions', 'payouts', 'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes',
    ]),
  },
  investment_group: {
    label: 'Investment group',
    modules: only([
      'contributions', 'payouts', 'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes',
    ]),
  },
  property_sacco: {
    label: 'Property SACCO / Land syndicate',
    modules: only([
      'contributions', 'savings', 'payouts', 'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes',
    ]),
  },
  mixed: {
    label: 'Mixed (rotating pot + lending + assets)',
    modules: without(['burial_welfare', 'equipment_hire', 'fundraising']),
  },
  custom: {
    label: 'Custom',
    modules: only(['contributions', 'meetings', 'announcements']),
  },
});

export const PRESET_KEYS = Object.freeze(Object.keys(WORKSPACE_PRESETS));

/** chama_type -> the preset that reproduces its legacy behaviour. */
export const LEGACY_PRESET_BY_CHAMA_TYPE = Object.freeze({
  standard: 'standard',
  burial: 'burial',
  table_banking: 'table_banking',
  merry_go_round: 'merry_go_round',
  investment: 'investment_group',
  investment_group: 'investment_group',
  property_sacco: 'property_sacco',
  burial_welfare: 'burial_welfare',
});

// ---------------------------------------------------------------------------
// Resolution helpers
// ---------------------------------------------------------------------------

/**
 * Close a set of enabled keys over the locked modules. Does NOT auto-enable
 * `requires` - use validateModuleSelection() to report those instead, so an
 * admin sees a clear error rather than getting surprise modules.
 */
const withLocked = (keys) => [...new Set([...LOCKED_MODULE_KEYS, ...keys])];

/** Accepts ['loans'], {loans:true} or {loans:{enabled:true}} -> string[] */
export function toEnabledKeys(modules) {
  if (!modules) return [];
  if (Array.isArray(modules)) return modules.filter((key) => MODULE_KEYS.includes(key));
  return Object.entries(modules)
    .filter(([key, value]) => {
      if (!MODULE_KEYS.includes(key)) return false;
      return typeof value === 'object' && value !== null ? value.enabled !== false : Boolean(value);
    })
    .map(([key]) => key);
}

/** Build the stored shape from an enabled-keys array. */
export function buildWorkspaceConfig({
  preset = 'custom',
  enabled,
  terminology = { workspace: 'Chama' },
  assetTypes = null,
  configuredBy = null,
} = {}) {
  const normalizedPreset = PRESET_KEYS.includes(preset) ? preset : 'custom';
  const keys = withLocked(toEnabledKeys(enabled ?? WORKSPACE_PRESETS[normalizedPreset]?.modules ?? []));
  const modules = {};
  for (const key of MODULE_KEYS) modules[key] = { enabled: keys.includes(key) };
  return {
    preset: normalizedPreset,
    modules,
    terminology: terminology || { workspace: 'Chama' },
    asset_types: Array.isArray(assetTypes) ? assetTypes : undefined,
    version: 1,
    configured_by: configuredBy,
    configured_at: new Date(),
  };
}

/**
 * The enabled module keys for a chama document (or lean object).
 *
 * A chama with no stored config (created before this feature, migration not
 * run yet) resolves from its chama_type, so the app keeps working unchanged.
 */
export function getEnabledModules(chama) {
  const stored = chama?.workspace_config?.modules;
  if (stored && Object.keys(stored).length > 0) {
    // Mongoose Mixed may hand back a Map-like or plain object; toEnabledKeys copes.
    const plain = typeof stored.toObject === 'function' ? stored.toObject() : stored;
    return withLocked(toEnabledKeys(plain));
  }
  const presetKey = LEGACY_PRESET_BY_CHAMA_TYPE[chama?.chama_type] || 'standard';
  return withLocked(WORKSPACE_PRESETS[presetKey].modules);
}

export const isModuleEnabled = (chama, moduleKey) => getEnabledModules(chama).includes(moduleKey);

/**
 * Validate an admin's selection. Returns { ok, errors[], enabled[] }.
 *   - unknown keys are rejected
 *   - locked modules are forced on
 *   - every enabled module must have its `requires` enabled too
 */
export function validateModuleSelection(modules) {
  const errors = [];
  // toEnabledKeys drops unknown keys, so they can never reach the dependency
  // loop below; they are reported separately from the raw input.
  const requested = toEnabledKeys(modules);

  const rawKeys = Array.isArray(modules)
    ? modules
    : Object.keys(modules || {});
  for (const key of rawKeys) {
    if (!MODULE_KEYS.includes(key)) errors.push(`Unknown module "${key}"`);
  }

  const enabled = withLocked(requested);
  for (const key of enabled) {
    for (const needed of WORKSPACE_MODULES[key].requires) {
      if (!enabled.includes(needed)) {
        errors.push(`"${WORKSPACE_MODULES[key].label}" needs "${WORKSPACE_MODULES[needed].label}" to be enabled`);
      }
    }
  }
  return { ok: errors.length === 0, errors, enabled };
}

/** Shape sent to the admin picker. */
export function getCatalogForClient() {
  return {
    groups: MODULE_GROUPS,
    modules: MODULE_KEYS.map((key) => ({ key, ...WORKSPACE_MODULES[key] })),
    presets: PRESET_KEYS.map((key) => ({
      key,
      label: WORKSPACE_PRESETS[key].label,
      modules: withLocked(WORKSPACE_PRESETS[key].modules),
    })),
  };
}
