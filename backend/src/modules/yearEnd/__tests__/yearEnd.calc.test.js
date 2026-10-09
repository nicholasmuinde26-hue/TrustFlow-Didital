import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toScaled, fromScaled, signedEffect, classifyBucket, resolveSettlement,
  buildRow, hashSnapshot, summarizeRows, findUndistributed,
} from '../yearEnd.calc.js';

test('money round-trips without float error', () => {
  assert.equal(fromScaled(toScaled('0.1') + toScaled('0.2')), '0.30');
  assert.equal(fromScaled(toScaled('1000')), '1000.00');
  assert.equal(fromScaled(toScaled('-12.5')), '-12.50');
  assert.equal(fromScaled(toScaled('12.345678')), '12.345678');
  assert.throws(() => toScaled('abc'));
  assert.throws(() => toScaled('1.1234567'));
});

test('signedEffect follows normal balance', () => {
  assert.equal(signedEffect('debit', 'debit', 5n), 5n);
  assert.equal(signedEffect('debit', 'credit', 5n), -5n);
  assert.equal(signedEffect('credit', 'credit', 5n), 5n);
  assert.equal(signedEffect('credit', 'debit', 5n), -5n);
});

test('bucket classification', () => {
  assert.equal(classifyBucket({ accountType: 'income', transactionType: 'contribution_payment' }), 'income');
  assert.equal(classifyBucket({ accountType: 'expense', transactionType: 'expense' }), 'expenses');
  assert.equal(classifyBucket({ accountType: 'asset', transactionType: 'contribution_payment' }), 'contributions');
  assert.equal(classifyBucket({ accountType: 'asset', transactionType: 'savings_shareout_settlement' }), 'payouts');
  assert.equal(classifyBucket({ accountType: 'asset', transactionType: 'loan_disbursement' }), 'other');
});

test('settlement defaults and overrides', () => {
  assert.equal(resolveSettlement({ _id: 1, account_type: 'asset', account_code: 'BANK' }), 'retained');
  assert.equal(resolveSettlement({ _id: 2, account_type: 'income', account_code: 'X' }), 'cleared');
  assert.equal(resolveSettlement({ _id: 3, account_type: 'equity', account_code: 'FUND' }, { FUND: 'distributed' }), 'distributed');
  assert.throws(() => resolveSettlement({ _id: 4, account_type: 'asset' }, { 4: 'bogus' }));
});

const acct = (o) => ({ _id: o.id, account_code: o.code, name: o.code, account_type: o.type, account_category: 'other' });

test('retained row carries closing; cleared and distributed carry nothing', () => {
  const ledger = { before: toScaled('1000'), movements: { contributions: toScaled('500'), payouts: toScaled('-200') } };
  const retained = buildRow({ account: acct({ id: 'a', code: 'BANK', type: 'asset' }), settlement: 'retained', ledger });
  assert.equal(fromScaled(retained.closing), '1300.00');
  assert.equal(fromScaled(retained.carry_forward), '1300.00');
  const cleared = buildRow({ account: acct({ id: 'b', code: 'INC', type: 'income' }), settlement: 'cleared', ledger });
  assert.equal(cleared.carry_forward, 0n);
  assert.equal(fromScaled(cleared.closing), '1300.00');
});

test('seeded opening replaces ledger opening but ledger_closing stays pure', () => {
  const ledger = { before: toScaled('900'), movements: { income: toScaled('100') } };
  const row = buildRow({ account: acct({ id: 'c', code: 'INC', type: 'income' }), settlement: 'cleared', ledger, seededOpening: 0n });
  assert.equal(fromScaled(row.opening), '0.00');
  assert.equal(fromScaled(row.closing), '100.00');
  assert.equal(fromScaled(row.ledger_closing), '1000.00');
});

test('identity: closing = opening + sum(buckets)', () => {
  const ledger = { before: 10n * 1000000n, movements: { contributions: 5n, income: 7n, expenses: -3n, payouts: -4n, other: 1n } };
  const r = buildRow({ account: acct({ id: 'd', code: 'Z', type: 'asset' }), settlement: 'retained', ledger });
  assert.equal(r.closing, r.opening + r.contributions + r.income + r.expenses + r.payouts + r.other);
});

test('hash is order-independent and sensitive to any amount', () => {
  const mk = (id, v) => buildRow({ account: acct({ id, code: id, type: 'asset' }), settlement: 'retained', ledger: { before: toScaled(v), movements: {} } });
  const p = { chamaId: 'c1', yearId: 'y1', startDate: '2026-01-01', endDate: '2026-12-31' };
  const h1 = hashSnapshot({ ...p, rows: [mk('a', '1'), mk('b', '2')] });
  const h2 = hashSnapshot({ ...p, rows: [mk('b', '2'), mk('a', '1')] });
  const h3 = hashSnapshot({ ...p, rows: [mk('a', '1'), mk('b', '2.01')] });
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.match(h1, /^[0-9a-f]{64}$/);
});

test('summary net result and undistributed guard', () => {
  const inc = buildRow({ account: acct({ id: 'i', code: 'I', type: 'income' }), settlement: 'cleared', ledger: { before: 0n, movements: { income: toScaled('300') } } });
  const exp = buildRow({ account: acct({ id: 'e', code: 'E', type: 'expense' }), settlement: 'cleared', ledger: { before: 0n, movements: { expenses: toScaled('120') } } });
  assert.equal(summarizeRows([inc, exp]).net_result, '180.00');
  const d = buildRow({ account: acct({ id: 'f', code: 'F', type: 'equity' }), settlement: 'distributed', ledger: { before: toScaled('5'), movements: {} } });
  assert.equal(findUndistributed([d]).length, 1);
});

test('exponent notation from Decimal128 is accepted', () => {
  assert.equal(fromScaled(toScaled('0E-2')), '0.00');
  assert.equal(fromScaled(toScaled('1.5E+3')), '1500.00');
  assert.equal(fromScaled(toScaled('-25E-1')), '-2.50');
  assert.equal(fromScaled(toScaled('12345E-2')), '123.45');
});
