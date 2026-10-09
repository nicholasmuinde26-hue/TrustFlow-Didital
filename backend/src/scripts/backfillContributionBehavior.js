import mongoose from 'mongoose';
import ContributionPlan from '../models/ContributionPlan.js';
import {
  behaviorBackfillPatch,
  behaviorFromLegacy,
  ownsLedgerAccount,
} from '../constants/contributionBehavior.constants.js';
import { ensurePlanLedgerAccount } from '../modules/contributionPlan/planLedgerAccount.service.js';

/**
 * Backfill: contribution `behavior`
 * =================================
 *
 * Contribution plans used to be classified by GUESSING from their name
 * ("saving", "welfare", ...). `behavior` makes that an explicit, stored fact
 * so a chama can call a contribution anything it likes.
 *
 * For every plan with no behavior yet this script:
 *   1. works out the behavior with the same rules the old guesser used (once),
 *   2. tags the built-in Savings plan with system_key 'savings',
 *   3. fills schedule.category when it was empty (or the default 'other'), so old
 *      readers keep working. The per-plan decision lives in
 *      behaviorBackfillPatch() (constants file) and is unit-tested.
 *
 * It uses updateOne (no validation hooks) so old, slightly odd plans cannot
 * block the run, and it is idempotent: plans that already have a behavior are
 * skipped, so it is safe to re-run.
 *
 * Optional: --create-ledgers also creates each plan's own ledger account.
 * Only do that once PLAN_LEDGER_ACCOUNTS is understood - see
 * planLedgerAccount.service.js for what has to be true first.
 *
 * MOUNTED: runBackfillContributionBehavior() is exported and called from
 * server.js on boot (silent, no ledgers), same self-healing pattern as
 * backfillChairpersonWalletView.js. Still runnable standalone:
 *
 * Usage: node src/scripts/backfillContributionBehavior.js
 *
 * Options:
 *   --chama-id <id>   Backfill one chama / contribution group only
 *   --dry-run         Report what would change, write nothing
 *   --create-ledgers  Also create per-plan ledger accounts
 */

export async function runBackfillContributionBehavior(options = {}) {
  const { ownerId = null, dryRun = false, createLedgers = false, silent = false } = options;
  const log = (...a) => { if (!silent) console.log(...a); };

  log('🚀 Backfilling contribution behavior');
  if (dryRun) log('📋 DRY RUN - no changes will be made');

  const query = { $or: [{ behavior: null }, { behavior: { $exists: false } }] };
  if (ownerId) query.owner_id = ownerId;

  const plans = await ContributionPlan.find(query).lean();
  log(`📊 ${plans.length} plan(s) without a behavior`);

  const counts = {};
  let updated = 0;
  let savingsTagged = 0;
  const savingsTakenFor = new Set(); // owners that already have (or just got) a system savings plan

  const alreadyTagged = await ContributionPlan.find({ system_key: 'savings' }).select('owner_type owner_id').lean();
  for (const p of alreadyTagged) savingsTakenFor.add(`${p.owner_type}:${p.owner_id}`);

  for (const plan of plans) {
    const ownerKey = `${plan.owner_type}:${plan.owner_id}`;
    const { behavior, $set, isBuiltInSavings } = behaviorBackfillPatch(plan, {
      savingsTaken: savingsTakenFor.has(ownerKey),
    });
    counts[behavior] = (counts[behavior] || 0) + 1;
    if (isBuiltInSavings) {
      savingsTakenFor.add(ownerKey);
      savingsTagged += 1;
    }

    log(`  ${dryRun ? '[dry] ' : ''}${plan.name} -> ${behavior}${isBuiltInSavings ? ' (built-in savings)' : ''}`);
    if (!dryRun) {
      await ContributionPlan.updateOne({ _id: plan._id }, { $set });
      updated += 1;
    }
  }

  let ledgersCreated = 0;
  if (createLedgers) {
    const need = await ContributionPlan.find({
      ledger_account_id: null,
      status: { $in: ['active', 'paused'] },
      ...(ownerId ? { owner_id: ownerId } : {}),
    });
    for (const plan of need) {
      if (!plan.behavior) plan.behavior = behaviorFromLegacy(plan.toObject());
      if (!ownsLedgerAccount(plan)) continue;
      log(`  ${dryRun ? '[dry] ' : ''}ledger account for ${plan.name}`);
      if (!dryRun) {
        await ensurePlanLedgerAccount(plan, { force: true });
        ledgersCreated += 1;
      }
    }
  }

  log('\n📊 Summary');
  log(`   By behavior: ${JSON.stringify(counts)}`);
  log(`   Plans updated: ${updated}`);
  log(`   Built-in savings tagged: ${savingsTagged}`);
  if (createLedgers) log(`   Ledger accounts created: ${ledgersCreated}`);
  log('\n✅ Backfill completed');
  return { found: plans.length, updated, counts, savingsTagged, ledgersCreated };
}

const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const cli = { ownerId: null, dryRun: false, createLedgers: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chama-id') { cli.ownerId = args[++i]; }
    else if (args[i] === '--dry-run') cli.dryRun = true;
    else if (args[i] === '--create-ledgers') cli.createLedgers = true;
  }
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager';
  (async () => {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB');
      await runBackfillContributionBehavior(cli);
    } catch (error) {
      console.error('\n❌ Backfill failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    }
  })();
}