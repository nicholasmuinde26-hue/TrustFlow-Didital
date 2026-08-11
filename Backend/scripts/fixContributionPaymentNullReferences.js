import cron from 'node-cron';
import PaymentIntent from '../models/PaymentIntent.js';
import paymentService from '../payment/payment.service.js';
import mpesaService from '../payment/providers/mpesa/mpesa.service.js';

const RECONCILIATION_INTERVAL_MINUTES = 5; // was 1 min. Too aggressive
const BATCH_SIZE = 10; // only process 10 at a time
const MAX_AGE_HOURS = 24; // don't query intents older than 24h

let isRunning = false;

export const startPaymentIntentReconciliationJob = () => {
  cron.schedule(`*/${RECONCILIATION_INTERVAL_MINUTES} * * * *`, async () => {
    if (isRunning) return; // prevent overlap
    isRunning = true;
    
    try {
      const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000);
      
      // Only get PENDING intents that are < 24h old and have mpesa provider_request_id
      const staleIntents = await PaymentIntent.find({
        status: 'PENDING',
        provider: 'mpesa',
        provider_request_id: { $exists: true, $ne: null },
        created_at: { $gte: cutoff }
      }).limit(BATCH_SIZE).lean();

      if (staleIntents.length === 0) {
        isRunning = false;
        return;
      }

      console.log(`[reconciliation] Processing ${staleIntents.length} stale intent(s)`);

      let processed = 0;
      let timedOut = 0;

      for (const intent of staleIntents) {
        try {
          // 1. Query M-Pesa for current status
          const queryResult = await mpesaService.queryStkPush({ 
            checkoutRequestId: intent.provider_request_id 
          });

          // 2. If still pending, skip and let next sweep handle it
          if (queryResult.resultCode === null || queryResult.resultCode === 1037) {
            continue;
          }

          // 3. If we got a final result, process callback
          await paymentService.processCallback({
            provider: 'mpesa',
            paymentId: intent._id,
            success: queryResult.resultCode === 0,
            status: queryResult.resultCode === 0 ? 'COMPLETED' : 'FAILED',
            amount: intent.amount,
            currency: intent.currency,
            providerData: queryResult,
            metadata: intent.metadata
          });
          
          processed++;

          // 4. Backoff 500ms between queries to avoid 429
          await new Promise(r => setTimeout(r, 500));

        } catch (error) {
          if (error.statusCode === 429) {
            console.warn(`[reconciliation] STK query throttled for ${intent.provider_request_id}. Stopping this batch.`);
            break; // stop the batch early, retry next sweep
          }
          console.error(`[reconciliation] Failed to reconcile PaymentIntent ${intent._id}:`, error.message);
        }
      }

      // 5. Timeout anything older than 1 hour with no response
      const timeoutCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const timeoutResult = await PaymentIntent.updateMany({
        status: 'PENDING',
        provider: 'mpesa',
        created_at: { $lte: timeoutCutoff }
      }, {
        $set: { status: 'FAILED', failure_reason: 'STK Push timeout' }
      });
      timedOut = timeoutResult.modifiedCount;

      console.log(`[reconciliation] Sweep processed ${processed} intent(s), timed out ${timedOut}.`);

    } finally {
      isRunning = false;
    }
  });

  console.log(`[reconciliation] Job started. Runs every ${RECONCILIATION_INTERVAL_MINUTES} minutes`);
};