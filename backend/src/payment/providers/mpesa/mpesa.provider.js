import mpesaService from './mpesa.service.js';
import { PAYMENT_STATUS, PAYMENT_PROVIDER } from '../../payment.constants.js'; 

class MpesaProvider {
  name = PAYMENT_PROVIDER.MPESA;

  async initiate(context) {
    if (!context.phoneNumber) {
      throw new Error('Phone number is required for M-Pesa STK Push');
    }
    
    const result = await mpesaService.initiateStkPush({
      amount: context.amountNumber,
      phoneNumber: context.phoneNumber,
      accountReference: context.reference,
      displayReference: context.reference,
      transactionDescription: context.metadata?.description || `Chama Payment: ${context.reference}`
    });

    if (!result.success) {
      throw new Error(result.customerMessage || 'STK Push failed');
    }

    return {
      checkoutRequestId: result.checkoutRequestId,
      merchantRequestId: result.merchantRequestId,
      customerMessage: result.customerMessage,
      rawResponse: result.rawResponse
    };
  }

  processCallback(rawBody) {
    const parsed = mpesaService.parseStkCallback(rawBody);
    
    if (!parsed || !parsed.checkoutRequestId) {
      return { 
        provider: PAYMENT_PROVIDER.MPESA,
        success: false, 
        status: PAYMENT_STATUS.FAILED, 
        reason: 'Invalid callback body',
        raw: rawBody
      };
    }
    
    let status = PAYMENT_STATUS.PENDING;
    if (parsed.success) status = PAYMENT_STATUS.COMPLETED;
    else if (parsed.resultCode === 1032) status = PAYMENT_STATUS.CANCELLED;
    else status = PAYMENT_STATUS.FAILED;

    return {
      provider: PAYMENT_PROVIDER.MPESA,
      success: parsed.success,
      status,
      checkoutRequestId: parsed.checkoutRequestId,
      merchantRequestId: parsed.merchantRequestId,
      mpesaReceiptNumber: parsed.mpesaReceiptNumber,
      amount: parsed.amount,
      phoneNumber: parsed.phoneNumber,
      reason: parsed.resultDescription,
      raw: rawBody
    };
  }

  async query(payload) {
    const result = await mpesaService.queryStkPush({
      checkoutRequestId: payload.checkoutRequestId
    });

    let status = PAYMENT_STATUS.PENDING;
    if (result.resultCode === 0) status = PAYMENT_STATUS.COMPLETED;
    else if (result.resultCode === 1032) status = PAYMENT_STATUS.CANCELLED;
    else if (result.resultCode !== null) status = PAYMENT_STATUS.FAILED;

    return {
      status,
      reason: result.resultDescription,
      rawResponse: result.rawResponse
    };
  }

  getMetadata() {
    return { 
      name: PAYMENT_PROVIDER.MPESA, 
      displayName: 'M-Pesa',
      supports: ['STK_PUSH', 'STK_QUERY', 'B2C'],
      currencies: ['KES'],
      countries: ['KE']
    };
  }
}

export default new MpesaProvider();