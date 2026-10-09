/**
 * ============================================================================
 * CONTRIBUTION BEHAVIOR - MIGRATION DECISION TESTS
 * ============================================================================
 *
 * backfillContributionBehavior.js stores, once, what the old name-guessing
 * logic used to work out on every read. These tests pin the per-plan decision
 * (behaviorBackfillPatch) without a database, because this is the part that
 * is easy to get subtly wrong and expensive to fix after it has been written
 * to production:
 *
 *   1. Legacy plans map to the behaviour the old guesser implied
 *   2. The built-in Savings plan is tagged exactly once per chama
 *   3. schedule.category stays compatible for readers that still use it
 *   4. The decision is stable - re-deriving from a migrated plan changes nothing
 * ============================================================================
 */

import {
  behaviorBackfillPatch,
  behaviorFromLegacy,
  legacyCategoryOf,
} from '../constants/contributionBehavior.constants.js';

const plan = (over = {}) => ({
  owner_type: 'Chama',
  owner_id: 'chama-1',
  name: 'Plan',
  contribution_type: 'fixed',
  schedule: { category: 'other' },
  ...over,
});

describe('behaviorFromLegacy', () => {
  it('maps merry-go-round plans to rotation regardless of name', () => {
    expect(behaviorFromLegacy(plan({ name: 'Hisa', contribution_type: 'merry_go_round' }))).toBe('rotation');
  });

  it('maps target plans to target', () => {
    expect(behaviorFromLegacy(plan({ name: 'Building fund', contribution_type: 'target' }))).toBe('target');
  });

  it('honours an explicit category before guessing from the name', () => {
    expect(behaviorFromLegacy(plan({ name: 'Savings club', schedule: { category: 'welfare' } }))).toBe('welfare');
  });

  it('falls back to the same name rules the old guesser used', () => {
    expect(behaviorFromLegacy(plan({ name: 'Monthly Savings' }))).toBe('savings');
    expect(behaviorFromLegacy(plan({ name: 'Bereavement fund' }))).toBe('welfare');
    expect(behaviorFromLegacy(plan({ name: 'Land purchase' }))).toBe('shares');
    expect(behaviorFromLegacy(plan({ name: 'Joining fee' }))).toBe('fee');
    expect(behaviorFromLegacy(plan({ name: 'Late penalties' }))).toBe('fine');
    expect(behaviorFromLegacy(plan({ name: 'Monthly dues' }))).toBe('dues');
  });

  it('treats the late-penalties system plan as a fine whatever it is called', () => {
    expect(behaviorFromLegacy(plan({ name: 'Faini', system_key: 'late_penalties' }))).toBe('fine');
  });
});

describe('behaviorBackfillPatch - built-in savings', () => {
  const savings = () => plan({ name: 'Savings', contribution_type: 'free_will' });

  it('tags the built-in Savings plan with system_key', () => {
    const { behavior, $set, isBuiltInSavings } = behaviorBackfillPatch(savings());
    expect(behavior).toBe('savings');
    expect(isBuiltInSavings).toBe(true);
    expect($set.system_key).toBe('savings');
  });

  it('does not tag a second Savings plan in a chama that already has one', () => {
    const { behavior, $set, isBuiltInSavings } = behaviorBackfillPatch(savings(), { savingsTaken: true });
    expect(behavior).toBe('savings');
    expect(isBuiltInSavings).toBe(false);
    expect($set.system_key).toBeUndefined();
  });

  it('only tags free_will plans named exactly Savings', () => {
    expect(behaviorBackfillPatch(plan({ name: 'Monthly Savings', contribution_type: 'free_will' })).isBuiltInSavings).toBe(false);
    expect(behaviorBackfillPatch(plan({ name: 'Savings', contribution_type: 'fixed' })).isBuiltInSavings).toBe(false);
  });

  it('never tags plans that are not owned by a Chama', () => {
    expect(behaviorBackfillPatch({ ...savings(), owner_type: 'ContributionGroup' }).isBuiltInSavings).toBe(false);
  });

  it('never re-tags a plan that already carries a system_key', () => {
    expect(behaviorBackfillPatch({ ...savings(), system_key: 'late_penalties' }).isBuiltInSavings).toBe(false);
  });
});

describe('behaviorBackfillPatch - schedule.category compatibility', () => {
  it('fills a missing category', () => {
    const { $set } = behaviorBackfillPatch(plan({ name: 'Welfare', schedule: {} }));
    expect($set['schedule.category']).toBe('welfare');
  });

  it("replaces the default 'other' when the old guesser would have said something else", () => {
    const { $set } = behaviorBackfillPatch(plan({ name: 'Emergency fund', schedule: { category: 'other' } }));
    expect($set.behavior).toBe('welfare');
    expect($set['schedule.category']).toBe('welfare');
  });

  it('writes mgr for rotation plans', () => {
    const { $set } = behaviorBackfillPatch(plan({ contribution_type: 'merry_go_round', schedule: { category: 'other' } }));
    expect($set['schedule.category']).toBe('mgr');
  });

  it('keeps annual subscriptions as annual_fee instead of collapsing to registration', () => {
    const { behavior, $set } = behaviorBackfillPatch(plan({ name: 'Annual subscription' }));
    expect(behavior).toBe('fee');
    expect($set['schedule.category']).toBe('annual_fee');
  });

  it('keeps registration fees as registration', () => {
    const { $set } = behaviorBackfillPatch(plan({ name: 'Registration fee' }));
    expect($set['schedule.category']).toBe('registration');
  });

  it('does not write a category that is already correct', () => {
    const { $set } = behaviorBackfillPatch(plan({ name: 'Monthly dues', schedule: { category: 'other' } }));
    expect($set.behavior).toBe('dues');
    expect('schedule.category' in $set).toBe(false);
  });

  it('never overwrites a category leadership picked explicitly', () => {
    const { $set } = behaviorBackfillPatch(plan({ name: 'Anything', schedule: { category: 'annual_fee' } }));
    expect($set.behavior).toBe('fee');
    expect('schedule.category' in $set).toBe(false);
  });
});

describe('behaviorBackfillPatch - stability', () => {
  it('produces a behaviour whose legacy category matches what readers see', () => {
    const cases = ['Savings', 'Welfare', 'Annual subscription', 'Fines', 'Monthly dues', 'Land purchase'];
    for (const name of cases) {
      const p = plan({ name, contribution_type: name === 'Savings' ? 'free_will' : 'fixed' });
      const { behavior, $set } = behaviorBackfillPatch(p);
      const category = $set['schedule.category'] ?? p.schedule.category;
      // The category readers will see must be a member of the behaviour's family.
      expect(legacyCategoryOf(behavior, category)).toBe(category);
    }
  });

  it('is idempotent: applying the patch and deriving again changes nothing', () => {
    const p = plan({ name: 'Emergency fund' });
    const first = behaviorBackfillPatch(p);
    const migrated = { ...p, behavior: first.behavior, schedule: { category: first.$set['schedule.category'] } };
    expect(behaviorFromLegacy(migrated)).toBe(first.behavior);
    expect(behaviorBackfillPatch(migrated).$set['schedule.category']).toBeUndefined();
  });
});
