import test from 'node:test';
import assert from 'node:assert/strict';
import { expectedDonationTotal, idempotentIntentMatches, isAttemptInFlight, shouldProcessCallback } from '../modules/publicGiving/publicGiving.logic.js';
import paymentStateMachine from '../payment/payment.state-machine.js';
import { PAYMENT_STATUS } from '../payment/payment.constants.js';

test('idempotency reuses only the same giving request, donor token, and cause', () => {
  const intent = { reference: 'GIVE-123', owner_id: 'group-1', metadata: { publicDonation: true, publicPaymentTokenHash: 'hash-a' } };
  assert.equal(idempotentIntentMatches(intent, { tokenHash: 'hash-a', groupId: 'group-1' }), true);
  assert.equal(idempotentIntentMatches(intent, { tokenHash: 'hash-b', groupId: 'group-1' }), false);
  assert.equal(idempotentIntentMatches(intent, { tokenHash: 'hash-a', groupId: 'group-2' }), false);
  assert.equal(idempotentIntentMatches({ reference: 'PAY-123', owner_id: 'group-1' }, { tokenHash: 'hash-a', groupId: 'group-1' }), false);
});

test('an in-flight STK request blocks another prompt for the donor', () => {
  assert.equal(isAttemptInFlight('processing'), true);
  assert.equal(isAttemptInFlight('pending'), true);
  assert.equal(isAttemptInFlight('failed'), false);
});

test('pledge total includes settled money, live attempts, and the new attempt only', () => {
  assert.equal(expectedDonationTotal({ paid: 500, pending: 250, attempt: 100 }), 850);
  assert.equal(expectedDonationTotal({ paid: 500, pending: 0, attempt: 100 }), 600);
  // A previous failed KES 900 attempt is absent from the pending total.
  assert.equal(expectedDonationTotal({ paid: 250, pending: 0, attempt: 100 }), 350);
});

test('callback settlement is idempotent while allowing a late success', () => {
  assert.equal(shouldProcessCallback('completed', 'completed'), false);
  assert.equal(shouldProcessCallback('failed', 'failed'), false);
  assert.equal(shouldProcessCallback('cancelled', 'cancelled'), false);
  assert.equal(shouldProcessCallback('failed', 'completed'), true);
  assert.equal(shouldProcessCallback('processing', 'failed'), true);
  const latePayment = { status: PAYMENT_STATUS.FAILED };
  paymentStateMachine.transition(latePayment, PAYMENT_STATUS.COMPLETED);
  assert.equal(latePayment.status, PAYMENT_STATUS.COMPLETED);
});
