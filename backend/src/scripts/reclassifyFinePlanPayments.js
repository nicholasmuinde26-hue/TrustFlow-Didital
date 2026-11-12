import mongoose from 'mongoose';
import Chama from '../models/Chama.js';
import ContributionPayment from '../models/ContributionPayment.js';
import ContributionPlan from '../models/ContributionPlan.js';
import FinancialAccount from '../models/FinancialAccount.js';
import FinancialTransaction from '../models/FinancialTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { accountingService, financeTransactionService } from '../modules/finance/index.js';
import { ensurePlanLedgerAccount } from '../modules/contributionPlan/index.js';

/**
 * Reclassifies historical fine receipts that were credited to a non-fine
 * account before payment events carried their plan ID into the accounting
 * rule. It posts balanced corrections; existing ledger entries stay immutable.
 *
 * Safe by default: reports only. Pass --apply to post corrections.
 * Usage: node src/scripts/reclassifyFinePlanPayments.js [--apply] [--chama-id <id>] [--user-id <id>]
 */
export async function reclassifyFinePlanPayments({ chamaId = null, userId = null, apply = false, silent = false } = {}) {
  const log = (...args) => { if (!silent) console.log(...args); };
  const planQuery = { owner_type: 'Chama', $or: [{ behavior: 'fine' }, { system_key: 'late_penalties' }] };
  if (chamaId) planQuery.owner_id = new mongoose.Types.ObjectId(chamaId);
  const plans = await ContributionPlan.find(planQuery).lean();
  const result = { plans: plans.length, candidateEntries: 0, correctionsPosted: 0, skipped: [] };
  log(`Checking ${plans.length} fine plan(s)${apply ? '' : ' (DRY RUN, pass --apply to post corrections)'}`);

  for (const plan of plans) {
    const fineAccount = plan.ledger_account_id
      ? await FinancialAccount.findById(plan.ledger_account_id).lean()
      : null;
    if (!fineAccount && !apply) {
      log(`\n${plan.name}: no fine ledger account is assigned; skipped in dry run`);
      result.skipped.push({ plan_id: String(plan._id), reason: 'missing fine ledger account' });
      continue;
    }
    const targetAccount = fineAccount || await ensurePlanLedgerAccount(plan, { force: true });
    if (!targetAccount) {
      log(`\n${plan.name}: could not provision fine ledger account; skipped`);
      result.skipped.push({ plan_id: String(plan._id), reason: 'could not provision fine ledger account' });
      continue;
    }

    const chama = await Chama.findById(plan.owner_id).select('created_by').lean();
    const poster = userId || chama?.created_by;
    const payments = await ContributionPayment.find({
      owner_type: 'Chama', owner_id: plan.owner_id, plan_id: plan._id,
      status: 'completed', financial_transaction_id: { $ne: null },
    }).select('_id financial_transaction_id amount currency').lean();
    let planCandidates = 0;

    for (const payment of payments) {
      const creditEntries = await LedgerEntry.find({ transaction_id: payment.financial_transaction_id, entry_type: 'credit' }).lean();
      for (const entry of creditEntries) {
        if (String(entry.account_id) === String(targetAccount._id)) continue;
        const alreadyCorrected = await FinancialTransaction.exists({
          owner_type: 'Chama', owner_id: plan.owner_id,
          source_type: 'FinePaymentReclassification', source_id: entry._id,
        });
        if (alreadyCorrected) continue;

        planCandidates += 1;
        result.candidateEntries += 1;
        const amount = entry.amount?.toString?.() ?? String(entry.amount);
        const sourceAccount = await FinancialAccount.findById(entry.account_id).select('name account_code').lean();
        log(`  ${plan.name}: KES ${amount} from ${sourceAccount?.name || sourceAccount?.account_code || entry.account_id} -> ${targetAccount.name}`);
        if (!apply) continue;
        if (!poster) {
          result.skipped.push({ payment_id: String(payment._id), reason: 'no --user-id and Chama has no creator' });
          continue;
        }

        const correction = await accountingService.post({
          referenceType: 'LEDGER_ADJUSTMENT_POSTING', transactionType: 'fine_payment_reclassification',
          owner_type: 'Chama', owner_id: plan.owner_id,
          debitAccountId: entry.account_id, creditAccountId: targetAccount._id,
          amount, currency: payment.currency || 'KES',
          source_type: 'FinePaymentReclassification', source_id: entry._id,
          reference: `FINE-RECLASS-${entry._id}`,
          description: `Reclassify fine receipt ${payment._id} to ${plan.name} fine balance`,
          created_by: poster, posted_by: poster, chama: plan.owner_id,
        });
        await financeTransactionService.markCompleted(correction.transactionId);
        result.correctionsPosted += 1;
      }
    }
    log(`\n${plan.name}: ${planCandidates} misrouted credit entry/entries${apply ? ' checked' : ' would be corrected'}`);
  }

  log(`\nSummary: ${JSON.stringify(result)}`);
  return result;
}

const isDirectRun = process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const cli = { chamaId: null, userId: null, apply: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chama-id') cli.chamaId = args[++i];
    else if (args[i] === '--user-id') cli.userId = args[++i];
    else if (args[i] === '--apply') cli.apply = true;
  }
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) { console.error('Set MONGO_URI (or MONGODB_URI)'); process.exit(1); }
  mongoose.connect(uri)
    .then(() => reclassifyFinePlanPayments(cli))
    .then(() => mongoose.disconnect())
    .catch((error) => { console.error(error); process.exit(1); });
}
