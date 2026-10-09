/**
 * ============================================================================
 * CONTRIBUTION BEHAVIOURS
 * ============================================================================
 *
 * A contribution's NAME is chosen freely by the chama ("Hisa", "Mchango wa
 * Mazishi", "Ada ya Mwaka"...). Its BEHAVIOUR is the small, fixed set of
 * things the system has to know in order to treat the money correctly.
 *
 *   name       -> for humans, free text, any language
 *   behavior   -> for the system, one of the values below
 *
 * Nothing in the codebase should infer behaviour from a plan's name any more.
 * `behaviorFromLegacy` exists only for the one-off migration of plans that
 * were created before `behavior` existed.
 * ============================================================================
 */

export const CONTRIBUTION_BEHAVIORS = Object.freeze([
  {
    value: 'dues',
    label: 'Regular contribution',
    description: 'Members pay a set amount each period into the chama.',
    legacy_category: 'other',
  },
  {
    value: 'savings',
    label: 'Savings',
    description: 'Members build personal savings, optionally shared out later.',
    legacy_category: 'savings',
  },
  {
    value: 'rotation',
    label: 'Merry-go-round',
    description: 'Contributions are paid out to one member per round, in turn.',
    legacy_category: 'mgr',
  },
  {
    value: 'welfare',
    label: 'Welfare / emergency fund',
    description: 'A pooled fund used to support members in need.',
    legacy_category: 'welfare',
  },
  {
    value: 'shares',
    label: 'Shares / investment',
    description: 'Members buy into a shared investment or asset.',
    legacy_category: 'shares',
  },
  {
    value: 'target',
    label: 'Target / project fund',
    description: 'Contributions work toward a specific goal or harambee.',
    legacy_category: 'other',
  },
  {
    value: 'fee',
    label: 'Fee (registration, annual subscription)',
    description: 'A joining or recurring administrative fee.',
    legacy_category: 'registration',
  },
  {
    value: 'fine',
    label: 'Fines & penalties',
    description: 'Charges raised for lateness, absence or breaches.',
    legacy_category: 'fine',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Anything that does not fit the options above.',
    legacy_category: 'other',
  },
]);

export const BEHAVIOR_VALUES = Object.freeze(CONTRIBUTION_BEHAVIORS.map((b) => b.value));

export const isBehavior = (value) => BEHAVIOR_VALUES.includes(value);

export const behaviorMeta = (value) =>
  CONTRIBUTION_BEHAVIORS.find((b) => b.value === value) || CONTRIBUTION_BEHAVIORS.find((b) => b.value === 'dues');

/**
 * The older `schedule.category` values the existing UI still reads. Kept in
 * step with `behavior` so nothing that reads category breaks. An existing
 * category is preserved when it is already a valid member of the behaviour's
 * family (e.g. `annual_fee` stays `annual_fee` under behaviour `fee`).
 */
export const legacyCategoryOf = (behavior, currentCategory = null) => {
  if (behavior === 'fee' && (currentCategory === 'registration' || currentCategory === 'annual_fee')) {
    return currentCategory;
  }
  return behaviorMeta(behavior).legacy_category;
};

/** One-off migration helper: what would the OLD name-guessing logic have said? */
export const behaviorFromLegacy = (plan) => {
  if (plan?.system_key === 'savings') return 'savings';
  if (plan?.system_key === 'late_penalties') return 'fine';
  if (plan?.contribution_type === 'merry_go_round') return 'rotation';
  if (plan?.contribution_type === 'target') return 'target';

  const set = plan?.schedule?.category;
  const byCategory = { mgr: 'rotation', savings: 'savings', welfare: 'welfare', shares: 'shares', registration: 'fee', annual_fee: 'fee', fine: 'fine' };
  if (set && byCategory[set]) return byCategory[set];

  const name = String(plan?.name || '').toLowerCase();
  if (/saving/.test(name)) return 'savings';
  if (/welfare|emergency|bereave|funeral|burial/.test(name)) return 'welfare';
  if (/share|invest|land|stock/.test(name)) return 'shares';
  if (/regist|joining|entry|annual|subscription|agm/.test(name)) return 'fee';
  if (/fine|penalt/.test(name)) return 'fine';
  return 'dues';
};

/**
 * The migration decision for ONE legacy plan, kept pure (no DB) so it can be
 * unit-tested and dry-run reasoned about. Returns the `$set` to apply.
 *
 *   - behavior: what the old name-guessing said, stored once from now on
 *   - system_key 'savings': only for the built-in plan (owner-scoped: the
 *     caller passes `savingsTaken` when the chama already has one, because the
 *     unique index allows a single system plan per key per owner)
 *   - schedule.category: filled when missing OR still the schema default
 *     'other' (the old guesser treated 'other' as "not picked" too). An
 *     annual subscription keeps `annual_fee` rather than collapsing into
 *     `registration` when both map to behaviour `fee`.
 */
export const behaviorBackfillPatch = (plan, { savingsTaken = false } = {}) => {
  const behavior = behaviorFromLegacy(plan);
  const $set = { behavior };

  const isBuiltInSavings =
    plan?.owner_type === 'Chama' &&
    behavior === 'savings' &&
    plan.contribution_type === 'free_will' &&
    String(plan.name || '').trim().toLowerCase() === 'savings' &&
    !plan.system_key &&
    !savingsTaken;
  if (isBuiltInSavings) $set.system_key = 'savings';

  const stored = plan?.schedule?.category;
  if (!stored || stored === 'other') {
    const name = String(plan?.name || '').toLowerCase();
    const hint = behavior === 'fee' && /annual|subscription|agm/.test(name) ? 'annual_fee' : null;
    const category = legacyCategoryOf(behavior, hint);
    if (category !== stored) $set['schedule.category'] = category;
  }

  return { behavior, $set, isBuiltInSavings };
};

/**
 * Which plans get their own ledger account?
 *   - rotation plans post through the MGR rule (own pool accounts)
 *   - the built-in Savings plan posts to MEMBER_SAVINGS
 * everything else posts through CONTRIBUTION_PAYMENT and now gets a dedicated
 * account so its figures are separate on the trial balance and balance sheet.
 */
export const ownsLedgerAccount = (plan) => plan?.behavior !== 'rotation' && plan?.system_key !== 'savings';