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

import {
  ORGANIZATION_FAMILIES,
  ORGANIZATION_TYPES,
  ORGANIZATION_TERMINOLOGY,
  getOrganizationPresetKey,
} from './organizationTypes.constants.js';

export const MODULE_GROUPS = Object.freeze([
  { key: 'core', label: 'Core' },
  { key: 'money', label: 'Money & contributions' },
  { key: 'lending', label: 'Lending' },
  { key: 'member_capital', label: 'Member capital & returns' },
  { key: 'cooperative_trade', label: 'Cooperative trade' },
  { key: 'portfolio', label: 'Assets, property & businesses' },
  { key: 'governance', label: 'Meetings & communication' },
  { key: 'compliance', label: 'Compliance & reporting' },
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

  // ---- SACCO capital and lending -----------------------------------------
  share_capital: {
    label: 'Share capital & member share accounts',
    group: 'member_capital',
    requires: ['finance_core', 'members'],
    description: 'Member share capital balances, transactions and statements.',
  },
  dividends_interest: {
    label: 'Dividends & deposit interest',
    group: 'member_capital',
    requires: ['finance_core', 'savings', 'share_capital'],
    description: 'Configure and allocate dividends and interest on member deposits.',
  },
  member_numbers: {
    label: 'SACCO member numbers',
    group: 'member_capital',
    requires: ['members'],
    description: 'Assign and manage each member’s permanent SACCO number.',
  },
  loan_products: {
    label: 'Loan products & rules',
    group: 'lending',
    requires: ['loans'],
    description: 'Set separate eligibility, pricing and repayment rules for loan types.',
  },
  share_linked_limits: {
    label: 'Share & savings-linked loan limits',
    group: 'lending',
    requires: ['loans', 'loan_products', 'share_capital', 'savings'],
    description: 'Set loan limits as a multiple of member shares or savings.',
  },

  // ---- cooperative trade --------------------------------------------------
  produce_collection: {
    label: 'Produce collection & sales',
    group: 'cooperative_trade',
    requires: ['members', 'finance_core'],
    description: 'Record member produce deliveries, grading, sales and settlements.',
  },
  cooperative_sales: {
    label: 'Goods & cooperative sales',
    group: 'cooperative_trade',
    requires: ['finance_core'],
    description: 'Track goods sold by the cooperative and member transactions.',
  },
  patronage_refunds: {
    label: 'Patronage refunds',
    group: 'cooperative_trade',
    requires: ['finance_core', 'members'],
    description: 'Allocate surplus to members based on their cooperative activity.',
  },
  cooperative_store: {
    label: 'Supplies & cooperative store',
    group: 'cooperative_trade',
    requires: ['finance_core', 'members'],
    description: 'Manage store stock, member purchases and supplies issued.',
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
  agm: { label: 'AGM scheduling', group: 'governance', requires: ['meetings'], description: 'Schedule annual general meetings and manage attendance.' },
  resolutions: { label: 'Resolutions & quorum', group: 'governance', requires: ['meetings'], description: 'Record motions, quorum, votes and adopted resolutions.' },
  committees: { label: 'Board & supervisory committees', group: 'governance', requires: ['members'], description: 'Assign board and supervisory committee roles and terms.' },

  // ---- compliance ---------------------------------------------------------
  regulator_reporting: { label: 'Regulator reporting (SASRA)', group: 'compliance', requires: ['finance_core', 'members'], description: 'Prepare SACCO regulatory reports, including SASRA returns where applicable.' },
  annual_returns: { label: 'Annual returns', group: 'compliance', requires: ['finance_core'], description: 'Track annual return requirements, filing dates and submitted records.' },

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
const GENERAL_MODULES = ['contributions', 'savings', 'savings_shareout', 'mgr', 'payouts', 'withdrawals', 'loans', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes'];

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
    modules: only(GENERAL_MODULES),
  },
  burial: {
    label: 'Burial / welfare chama',
    modules: only([
      'contributions', 'payouts',
      'assets', 'businesses', 'property_leases',
      'meetings', 'polls', 'announcements',
      'burial_welfare', 'equipment_hire', 'fundraising',
    ]),
  },
  burial_welfare: {
    label: 'Burial / welfare chama',
    modules: only([
      'contributions', 'payouts',
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
  community_sacco: {
    label: 'Community SACCO',
    modules: only(['contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans', 'loan_products', 'share_capital', 'dividends_interest', 'member_numbers', 'share_linked_limits', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'regulator_reporting', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  farmer_sacco: {
    label: 'Farmer SACCO',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'loan_products', 'share_capital', 'dividends_interest', 'member_numbers', 'share_linked_limits', 'produce_collection', 'cooperative_sales', 'patronage_refunds', 'assets', 'businesses', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'regulator_reporting', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  employee_sacco: {
    label: 'Employee SACCO',
    modules: only(['contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans', 'loan_products', 'share_capital', 'dividends_interest', 'member_numbers', 'share_linked_limits', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'regulator_reporting', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  investment_sacco: {
    label: 'Investment SACCO',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'loan_products', 'share_capital', 'dividends_interest', 'member_numbers', 'share_linked_limits', 'assets', 'businesses', 'property_leases', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'regulator_reporting', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  housing_sacco: {
    label: 'Housing SACCO',
    modules: only(['contributions', 'savings', 'savings_shareout', 'payouts', 'loans', 'loan_products', 'share_capital', 'dividends_interest', 'member_numbers', 'share_linked_limits', 'assets', 'businesses', 'property_leases', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'regulator_reporting', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  cooperative: {
    label: 'General cooperative',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'cooperative_sales', 'patronage_refunds', 'cooperative_store', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  agricultural_cooperative: {
    label: 'Agricultural cooperative',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'produce_collection', 'cooperative_sales', 'patronage_refunds', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  housing_cooperative: {
    label: 'Housing cooperative',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'property_leases', 'patronage_refunds', 'meetings', 'agm', 'resolutions', 'committees', 'polls', 'announcements', 'chat', 'annual_returns', 'trust', 'officials', 'disputes']),
  },
  farmer_group: {
    label: 'Farmer group',
    modules: only(['contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  },
  housing_group: {
    label: 'Housing group',
    modules: only(['contributions', 'savings', 'payouts', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  },
  mixed: {
    label: 'Mixed (rotating pot + lending + assets)',
    modules: only(GENERAL_MODULES),
  },
  custom: {
    label: 'Custom',
    modules: only(['contributions', 'meetings', 'announcements']),
  },
});

export const PRESET_KEYS = Object.freeze(Object.keys(WORKSPACE_PRESETS));

// Frozen pre-customization module sets for workspaces that have never stored
// an explicit config. Do not derive these from WORKSPACE_PRESETS: preset edits
// apply to newly created workspaces only, and must not expand existing ones.
export const LEGACY_MODULES_BY_PRESET = Object.freeze({
  standard: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'savings_shareout', 'mgr', 'payouts', 'withdrawals', 'loans', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  burial: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'payouts', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'burial_welfare', 'equipment_hire', 'fundraising']),
  merry_go_round: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'mgr', 'payouts', 'meetings', 'polls', 'announcements', 'chat']),
  table_banking: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  investment_group: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'payouts', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  property_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  community_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  farmer_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  employee_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'savings_shareout', 'payouts', 'withdrawals', 'loans', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  investment_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  housing_sacco: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'savings_shareout', 'payouts', 'loans', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  cooperative: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  agricultural_cooperative: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  housing_cooperative: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  farmer_group: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'loans', 'assets', 'businesses', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  housing_group: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'savings', 'payouts', 'assets', 'businesses', 'property_leases', 'meetings', 'polls', 'announcements', 'chat', 'trust', 'officials', 'disputes']),
  custom: Object.freeze(['members', 'finance_core', 'settings', 'contributions', 'meetings', 'announcements']),
});

/** chama_type -> the preset that reproduces its legacy behaviour. */
export const LEGACY_PRESET_BY_CHAMA_TYPE = Object.freeze({
  standard: 'standard',
  burial: 'burial',
  table_banking: 'table_banking',
  merry_go_round: 'merry_go_round',
  investment: 'investment_group',
  investment_group: 'investment_group',
  property_sacco: 'property_sacco',
  community_sacco: 'community_sacco',
  employee_sacco: 'employee_sacco',
  investment_sacco: 'investment_sacco',
  farmer_sacco: 'farmer_sacco',
  housing_sacco: 'housing_sacco',
  farmer_group: 'farmer_group',
  housing_group: 'housing_group',
  agricultural: 'agricultural_cooperative',
  housing: 'housing_cooperative',
  consumer: 'cooperative',
  worker: 'cooperative',
  producer: 'cooperative',
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
  const isBurial = ['burial', 'burial_welfare'].includes(chama?.chama_type)
    || ['burial', 'burial_welfare'].includes(chama?.workspace_config?.preset);
  const burialSafe = (keys) => isBurial
    ? keys.filter((key) => !['loans', 'savings', 'savings_shareout', 'withdrawals'].includes(key))
    : keys;
  const stored = chama?.workspace_config?.modules;
  if (stored && Object.keys(stored).length > 0) {
    // Mongoose Mixed may hand back a Map-like or plain object; toEnabledKeys copes.
    const plain = typeof stored.toObject === 'function' ? stored.toObject() : stored;
    return withLocked(burialSafe(toEnabledKeys(plain)));
  }
  const presetKey = LEGACY_PRESET_BY_CHAMA_TYPE[chama?.chama_type] || 'standard';
  return withLocked(burialSafe(LEGACY_MODULES_BY_PRESET[presetKey] || LEGACY_MODULES_BY_PRESET.standard));
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

/** { moduleKey: 'label' } -> only known keys, trimmed, non-empty, max 60 chars. */
export function sanitizeModuleLabels(labels) {
  if (!labels || typeof labels !== 'object') return {};
  return Object.fromEntries(
    Object.entries(labels)
      .filter(([key, label]) => WORKSPACE_MODULES[key] && typeof label === 'string')
      .map(([key, label]) => [key, label.trim().slice(0, 60)])
      .filter(([, label]) => label)
  );
}

/** Shape sent to the admin picker. */
export function getCatalogForClient() {
  return {
    organizations: ORGANIZATION_FAMILIES.map((family) => ({
      ...family,
      terminology: ORGANIZATION_TERMINOLOGY[family.key],
      types: ORGANIZATION_TYPES[family.key].map((type) => ({
        ...type,
        preset: getOrganizationPresetKey(family.key, type.key),
      })),
    })),
    groups: MODULE_GROUPS,
    modules: MODULE_KEYS.map((key) => ({ key, ...WORKSPACE_MODULES[key] })),
    presets: PRESET_KEYS.map((key) => ({
      key,
      label: WORKSPACE_PRESETS[key].label,
      modules: withLocked(WORKSPACE_PRESETS[key].modules),
    })),
  };
}
