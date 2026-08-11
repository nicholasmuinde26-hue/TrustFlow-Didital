import mpesaService from './mpesa.service.js';
import { PAYMENT_STATUS } from '../../payment.constants.js';

const MpesaProvider = {
  name: 'mpesa',

  /**
   * Called by payment.service.initiate
   */
  async initiate({ amount, provider, metadata, idempotencyKey }) {
    if (!provider.phoneNumber) {
      throw new Error('Phone number is required for M-Pesa STK Push');
    }
    
    const result = await mpesaService.initiateStkPush({
      amount,
      phoneNumber: provider.phoneNumber,
      accountReference: metadata.reference,
      displayReference: metadata.displayReference,
      transactionDescription: metadata.description || 'Payment'
    });

    return {
      providerRequestId: result.checkoutRequestId, // This goes to PaymentIntent.provider_request_id
      providerResponseId: result.merchantRequestId,
      providerResponse: result.rawResponse,
      customerMessage: result.customerMessage
    };
  },

  /**
   * Called by payment.service.processCallback
   * Must return normalized shape that payment.service expects
   */
  async processCallback({ providerData }) {
    const parsed = mpesaService.parseStkCallback(providerData);
    
    const status = parsed.success 
      ? PAYMENT_STATUS.COMPLETED 
      : parsed.resultCode === 1032 
        ? PAYMENT_STATUS.CANCELLED 
        : PAYMENT_STATUS.FAILED;

    return {
      provider: 'mpesa',
      paymentId: null, // payment.service will resolve this from checkoutRequestId
      checkoutRequestId: parsed.checkoutRequestId, // critical for lookup
      success: parsed.success,
      status,
      amount: parsed.amount,
      currency: 'KES',
      reason: parsed.resultDescription,
      participant: {
        phoneNumber: parsed.phoneNumber
      },
      providerData: parsed // full parsed object for audit
    };
  },

  getMetadata() {
    return { name: 'mpesa', supports: ['STK_PUSH', 'B2C'] };
  }
};

export default MpesaProvider;