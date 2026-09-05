/**
 * ============================================================================
 * M-PESA C2B (PAYBILL) PAYMENT PROVIDER
 * ============================================================================
 *
 * Handles payments that arrived unprompted via Paybill (C2B), already
 * confirmed by Safaricom's ConfirmationURL callback before this provider
 * is ever invoked. There is nothing left to push to the member's phone
 * and no further callback will arrive, so - exactly like CashProvider -
 * the payment is considered settled the moment it's recorded.
 *
 * Kept as a distinct provider name (not reusing "mpesa") so the ledger
 * and payment records can tell STK-initiated payments apart from Paybill
 * payments during reconciliation, even though both ultimately post to the
 * same MPESA_CLEARING account (see savingsPayment.rule.js's fallback for
 * unrecognized payment_method values).
 * ============================================================================
 */

import { PAYMENT_PROVIDER } from '../../payment.constants.js';

class MpesaC2bProvider {
  name = PAYMENT_PROVIDER.MPESA_C2B;

  async initiate(context) {
    return {
      checkoutRequestId: context.reference,
      merchantRequestId: context.reference,
      customerMessage: 'M-Pesa Paybill payment reconciled',
      immediate: true,
      rawResponse: { source: 'c2b', reconciledBy: context.actorId },
    };
  }

  processCallback() {
    throw new Error('MpesaC2bProvider: processCallback() is not supported, C2B payments complete synchronously at confirmation time');
  }

  async query() {
    return { status: 'completed', reason: null, rawResponse: null };
  }

  async cancel() {
    throw new Error('MpesaC2bProvider: cancel() is not supported for already-settled C2B payments');
  }

  getMetadata() {
    return { name: this.name, displayName: 'M-Pesa Paybill (C2B)', version: '1.0.0' };
  }
}

export default new MpesaC2bProvider();
