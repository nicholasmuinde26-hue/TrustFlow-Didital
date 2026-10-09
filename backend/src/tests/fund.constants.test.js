import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FUND_KINDS, kindFromBehavior, fundFromPlan, mergeSettlementOverrides,
} from '../constants/fund.constants.js';
import { BEHAVIOR_VALUES } from '../constants/contributionBehavior.constants.js';
import { resolveSettlement } from '../modules/yearEnd/yearEnd.calc.js';

const OWNER = 'a'.repeat(24);
const ACC = 'b'.repeat(24);
const plan = (o = {}) => ({
  _id: 'c'.repeat(24), owner_type: 'Chama', owner_id: OWNER, name: 'Burial levy',
  behavior: 'welfare', ledger_account_id: ACC, ...o,
});

test('every behaviour except rotation maps to a known fund kind', () => {
  for (const b of BEHAVIOR_VALUES.filter((v) => v !== 'rotation')) {
    assert.ok(FUND_KINDS.includes(kindFromBehavior(b)), b);
  }
});

test('fundFromPlan reuses the plan\'s existing ledger account and starts retained', () => {
  const f = fundFromPlan(plan());
  assert.equal(f.ledger_account_id, ACC);
  assert.equal(f.kind, 'welfare');
  assert.equal(f.settlement, 'retained');
  assert.equal(f.name, 'Burial levy');
  assert.equal(f.owner_id, OWNER);
});

test('a target plan becomes a project fund', () => {
  assert.equal(fundFromPlan(plan({ behavior: 'target' })).kind, 'project');
});

test('a name already used by the same owner gets the account code as a suffix', () => {
  const f = fundFromPlan(plan(), { taken: new Set(['burial levy']), accountCode: 'CP-ABC123' });
  assert.equal(f.name, 'Burial levy (CP-ABC123)');
});

test('the suffixed name still fits the 100 character limit', () => {
  const f = fundFromPlan(plan({ name: 'x'.repeat(150) }), { taken: new Set(['x'.repeat(100)]), accountCode: 'CP-ABC123' });
  assert.ok(f.name.length <= 100);
  assert.ok(f.name.endsWith('(CP-ABC123)'));
});

test('fund settlements become overrides keyed by ledger account id', () => {
  const o = mergeSettlementOverrides([{ ledger_account_id: ACC, settlement: 'distributed' }]);
  assert.deepEqual(o, { [ACC]: 'distributed' });
});

test('funds without an account or settlement add nothing', () => {
  assert.deepEqual(mergeSettlementOverrides([{ settlement: 'retained' }, { ledger_account_id: ACC }]), {});
});

test('an explicit override on the same id replaces the fund default', () => {
  const o = mergeSettlementOverrides([{ ledger_account_id: ACC, settlement: 'distributed' }], { [ACC]: 'retained' });
  assert.equal(o[ACC], 'retained');
});

test('an explicit override by account_code beats the fund default keyed by id', () => {
  const merged = mergeSettlementOverrides(
    [{ ledger_account_id: ACC, settlement: 'distributed' }],
    { 'CP-ABC123': 'retained' }
  );
  const account = { _id: ACC, account_code: 'CP-ABC123', account_type: 'equity' };
  assert.equal(resolveSettlement(account, merged), 'retained');
});

test('with no explicit override the fund setting drives year-end settlement', () => {
  const merged = mergeSettlementOverrides([{ ledger_account_id: ACC, settlement: 'distributed' }]);
  const account = { _id: ACC, account_code: 'CP-ABC123', account_type: 'equity' };
  assert.equal(resolveSettlement(account, merged), 'distributed');
});
