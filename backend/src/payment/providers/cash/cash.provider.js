/**
 * ============================================================================
 * CASH (MANUAL) PAYMENT PROVIDER
 * ============================================================================
 *
 * Handles payments recorded manually by a chama official (cash, bank
 * deposit slip, etc). There is no external gateway to call and no
 * callback will ever arrive, so the payment is considered settled the
 * moment it's recorded.
 *
 * `initiate()` returns `immediate: true` so PaymentService knows to mark
 * the intent/payment COMPLETED right away instead of leaving it in
 * PROCESSING and waiting for a callback that will never come.
 *
 * Named "cash" (not "manual") to match the value used everywhere else in
 * the codebase - DB enums (PaymentIntent, ContributionPayment), the
 * finance accounting rules (contributionPayment.rule.js keys its ledger
 * account off payment_method === 'cash'), and other models (ChamaLoan,
 * BusinessTransaction, Payout) all use 'cash'.
 * ============================================================================
 */

import { PAYMENT_PROVIDER } from '../../payment.constants.js';
import { assertCashInflowAllowed } from '../../../modules/finance/cashDeposit.service.js';

class CashProvider {
  name = PAYMENT_PROVIDER.CASH;

  async initiate(context) {
    // Policy enforcement: every cash payment in the app (contribution
    // payments, ad-hoc chip-ins, etc) funnels through here, since this is
    // the one provider that ever handles cash. If this workspace's
    // previously-recorded cash-in-hand has gone overdue for deposit
    // (see cashDepositEnforcement.job.js), block any NEW cash from being
    // accepted until the treasurer deposits what's already outstanding -
    // otherwise the deposit deadline could be dodged forever by just
    // keeping the money "in transit" as new cash receipts.
    await assertCashInflowAllowed(context.ownerType, context.ownerId);

    return {
      checkoutRequestId: context.reference,
      merchantRequestId: context.reference,
      customerMessage: 'Cash payment recorded',
      immediate: true,
      rawResponse: { recordedBy: context.actorId }
    };
  }

  processCallback() {
    // Cash payments never receive a callback - they're completed at initiate() time.
    throw new Error('CashProvider: processCallback() is not supported, cash payments complete synchronously');
  }

  async query() {
    // Cash payments are always resolved by the time initiate() returns.
    return { status: 'completed', reason: null, rawResponse: null };
  }

  async cancel() {
    throw new Error('CashProvider: cancel() is not supported for cash payments');
  }

  getMetadata() {
    return { name: this.name, displayName: 'Cash / Manual', version: '1.0.0' };
  }
}

export default new CashProvider();