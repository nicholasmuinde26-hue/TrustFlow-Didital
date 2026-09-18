/**
 * ============================================================================
 * FINANCIAL TRANSACTION — transaction_type ENUM REGRESSION TESTS
 * ============================================================================
 *
 * Context
 * -------
 * Every accounting rule builds a `transaction_type` string (via
 * financeEngine.service.js's TRANSACTION_TYPE_BY_RULE, or via
 * accounting.service.js's `context.referenceType`, lower-cased) and that
 * string is written straight onto FinancialTransaction.transaction_type,
 * which is a Mongoose `enum`. If a rule's type string isn't in the model's
 * enum, Mongoose throws a ValidationError at posting time — the ledger
 * entry never gets created, but the payment/obligation it belongs to has
 * already been marked complete elsewhere, so the failure is easy to miss
 * until someone notices a transaction is "stuck" with no ledger trail.
 *
 * Two of these were found missing from the enum:
 *
 *   - 'chama_contribution_payment'        (chamaContribution.rule.js,
 *      posted via financeEngine.service.js when a member pays into a
 *      chama-internal fund — emergency, wedding, fundraiser, etc.)
 *
 *   - 'chama_contrib_payout_settlement'   (chamaContributionPayout.rule.js,
 *      posted via accounting.service.js when a treasurer disburses an
 *      approved chama-internal fund)
 *
 * Both are asserted directly below (Tests 1–2), AND the drift-guard test
 * (Test 3) walks the actual rule-name → transaction_type mappings the app
 * uses at runtime and checks every single one against the enum, so this
 * suite fails immediately if a *future* rule introduces the same class of
 * bug — not just these two specific strings.
 *
 * These tests validate schema shape only (`validateSync`), so they run
 * fast and do NOT require a MongoDB connection.
 * ============================================================================
 */

import mongoose from 'mongoose';
import FinancialTransaction from '../models/FinancialTransaction.js';

// The same rule-name -> transaction_type mapping financeEngine.service.js
// posts with for payment-event-driven transactions (savings, contribution,
// MGR, chama-internal contribution funding).
import { TRANSACTION_TYPE_BY_RULE } from '../modules/finance/financeEngine.service.js';

// accounting.service.js's referenceType -> rule registry, used for the
// treasurer-initiated flows (payout obligation/settlement/cancellation,
// savings share-out, chama-internal contribution payout). The
// `referenceType` keys themselves (lower-cased) are what ends up as
// FinancialTransaction.transaction_type — see
// financeTransactionService.create(): `context.transactionType ||
// context.referenceType`.
import accountingService from '../modules/finance/accounting/accounting.service.js';

// Minimal, otherwise-valid document. Only transaction_type is varied.
function buildTransaction(transaction_type) {
  return new FinancialTransaction({
    owner_type: 'Chama',
    owner_id: new mongoose.Types.ObjectId(),
    transaction_type,
    amount: mongoose.Types.Decimal128.fromString('100.00'),
    currency: 'KES',
    source_type: 'Payment',
    source_id: new mongoose.Types.ObjectId(),
    created_by: new mongoose.Types.ObjectId(),
  });
}

describe('FinancialTransaction.transaction_type enum', () => {

  // --------------------------------------------------------------------
  // TEST 1 — chama-internal contribution FUNDING
  // --------------------------------------------------------------------
  test('accepts chama_contribution_payment (chamaContribution.rule.js funding leg)', () => {
    const txn = buildTransaction('chama_contribution_payment');
    const err = txn.validateSync();
    expect(err).toBeUndefined();
  });

  // --------------------------------------------------------------------
  // TEST 2 — chama-internal contribution PAYOUT
  // --------------------------------------------------------------------
  test('accepts chama_contrib_payout_settlement (chamaContributionPayout.rule.js disbursement leg)', () => {
    const txn = buildTransaction('chama_contrib_payout_settlement');
    const err = txn.validateSync();
    expect(err).toBeUndefined();
  });

  // --------------------------------------------------------------------
  // TEST 2b — a still-broken value should actually fail validation, so
  // this suite proves it would have caught the original bug (and isn't
  // silently passing for unrelated reasons, e.g. transaction_type not
  // actually being validated).
  // --------------------------------------------------------------------
  test('sanity check: an unregistered transaction_type is still rejected', () => {
    const txn = buildTransaction('this_type_does_not_exist');
    const err = txn.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.transaction_type).toBeDefined();
  });

  // --------------------------------------------------------------------
  // TEST 3 — DRIFT GUARD
  // --------------------------------------------------------------------
  // Every transaction_type the app can actually produce at runtime, from
  // BOTH posting paths (financeEngine's payment-event rules, and
  // accounting.service's treasurer-action rules), must be in the enum.
  // This is what protects against the *next* rule someone adds forgetting
  // to update the enum, not just these two known strings.
  // --------------------------------------------------------------------
  test('every rule-produced transaction_type is registered in the enum', () => {
    const allowedTypes = FinancialTransaction.schema.path('transaction_type').enumValues;

    // financeEngine.service.js path: rule name -> transaction_type is a
    // direct value (already the exact string written to the field).
    const fromFinanceEngine = Object.values(TRANSACTION_TYPE_BY_RULE);

    // accounting.service.js path: the referenceType KEY itself (lower-
    // cased) is what financeTransactionService.create() writes, since it
    // falls back to context.referenceType when transactionType isn't set.
    const fromAccountingService = Object.keys(accountingService.rules)
      .map((referenceType) => referenceType.toLowerCase());

    const producedTypes = [...fromFinanceEngine, ...fromAccountingService];

    expect(producedTypes.length).toBeGreaterThan(0);

    const unregistered = producedTypes.filter(
      (type) => !allowedTypes.includes(type)
    );

    expect(unregistered).toEqual([]);
  });

  // --------------------------------------------------------------------
  // TEST 4 — each produced type also builds a schema-valid document, not
  // just a technically-enum-listed string (catches typos that happen to
  // collide, and documents the full valid set for future readers).
  // --------------------------------------------------------------------
  test('every rule-produced transaction_type passes full document validation', () => {
    const fromFinanceEngine = Object.values(TRANSACTION_TYPE_BY_RULE);
    const fromAccountingService = Object.keys(accountingService.rules)
      .map((referenceType) => referenceType.toLowerCase());

    const producedTypes = [...new Set([...fromFinanceEngine, ...fromAccountingService])];

    for (const type of producedTypes) {
      const err = buildTransaction(type).validateSync();
      expect({ type, err: err && err.message }).toEqual({ type, err: undefined });
    }
  });

});
