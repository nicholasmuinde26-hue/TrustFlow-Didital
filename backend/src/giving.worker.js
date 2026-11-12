import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { initializePaymentProviders } from './payment/providers/provider.bootstrap.js';
import { startPaymentIntentReconciliationJob } from './jobs/paymentIntentReconciliation.job.js';
import { startContributionGroupLifecycleJob } from './jobs/contributionGroupLifecycle.job.js';

async function start() {
  await connectDatabase();
  initializePaymentProviders();
  const reconciliationTimer = startPaymentIntentReconciliationJob({ publicGivingOnly: true });
  const groupLifecycleTimer = startContributionGroupLifecycleJob();
  console.log(JSON.stringify({ level: 'info', event: 'giving_worker_started', jobs: ['public_donation_reconciliation', 'contribution_group_lifecycle'] }));

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(JSON.stringify({ level: 'info', event: 'giving_worker_shutdown', signal }));
    clearInterval(reconciliationTimer);
    clearInterval(groupLifecycleTimer);
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((error) => {
  console.error(JSON.stringify({ level: 'error', event: 'giving_worker_start_failed', message: error.message }));
  process.exit(1);
});
