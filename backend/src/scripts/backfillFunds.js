import mongoose from 'mongoose';
import ContributionPlan from '../models/ContributionPlan.js';
import FinancialAccount from '../models/FinancialAccount.js';
import Fund from '../models/Fund.js';
import { fundFromPlan } from '../constants/fund.constants.js';

/**
 * Backfill: one Fund per plan that already has its own ledger account
 * ===================================================================
 *
 * For every ContributionPlan with a ledger_account_id and no fund_id, this
 * creates a Fund that points at THAT SAME ledger account, then sets the plan's
 * fund_id. No FinancialAccount, LedgerEntry or balance is touched, so no history
 * is rewritten and trial balances and year-end snapshots come out identical
 * before and after.
 *
 * Plans with no ledger_account_id (the built-in Savings plan, merry-go-round
 * plans, anything still on the shared MEMBER_CONTRIBUTIONS account) are skipped:
 * they have no account of their own to point a fund at.
 *
 * Idempotent and crash-safe: a fund that already points at the plan's account is
 * reused, and plans that already have a fund_id are not selected. updateOne /
 * create of a new collection only, no validation hooks on the plan.
 *
 * NOT mounted on boot (unlike backfillContributionBehavior). Run it once:
 *
 * Usage: node src/scripts/backfillFunds.js [--chama-id <id>] [--dry-run]
 */

export async function runBackfillFunds(options = {}) {
  const { ownerId = null, dryRun = false, silent = false } = options;
  const log = (...a) => { if (!silent) console.log(...a); };

  const query = {
    ledger_account_id: { $ne: null },
    $or: [{ fund_id: null }, { fund_id: { $exists: false } }],
  };
  if (ownerId) query.owner_id = ownerId;

  const plans = await ContributionPlan.find(query).sort({ createdAt: 1 }).lean();
  log(`📊 ${plans.length} plan(s) with a ledger account and no fund${dryRun ? ' (DRY RUN)' : ''}`);

  const takenByOwner = new Map();
  const namesFor = async (plan) => {
    const key = `${plan.owner_type}:${plan.owner_id}`;
    if (!takenByOwner.has(key)) {
      const existing = await Fund.find({ owner_type: plan.owner_type, owner_id: plan.owner_id }).select('name').lean();
      takenByOwner.set(key, new Set(existing.map((f) => f.name.toLowerCase())));
    }
    return takenByOwner.get(key);
  };

  const result = { found: plans.length, fundsCreated: 0, fundsReused: 0, plansLinked: 0, skippedMissingAccount: 0 };

  for (const plan of plans) {
    const account = await FinancialAccount.findById(plan.ledger_account_id).select('account_code').lean();
    if (!account) {
      // Plan points at an account that no longer exists; don't invent a fund over it.
      result.skippedMissingAccount += 1;
      log(`  ⚠️  ${plan.name}: ledger account ${plan.ledger_account_id} not found, skipped`);
      continue;
    }

    let fund = await Fund.findOne({ ledger_account_id: plan.ledger_account_id });
    if (fund) {
      result.fundsReused += 1;
    } else {
      const taken = await namesFor(plan);
      const doc = fundFromPlan(plan, { taken, accountCode: account.account_code });
      log(`  ${dryRun ? '[dry] ' : ''}fund "${doc.name}" (${doc.kind}) for plan ${plan._id}`);
      if (dryRun) { result.fundsCreated += 1; taken.add(doc.name.toLowerCase()); continue; }
      fund = await Fund.create({ ...doc, created_by: plan.created_by || null });
      taken.add(doc.name.toLowerCase());
      result.fundsCreated += 1;
    }

    if (!dryRun) {
      await ContributionPlan.updateOne({ _id: plan._id, fund_id: null }, { $set: { fund_id: fund._id } });
      result.plansLinked += 1;
    }
  }

  log(`\n📊 Summary: ${JSON.stringify(result)}`);
  return result;
}

const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isDirectRun) {
  const args = process.argv.slice(2);
  const cli = { ownerId: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chama-id') cli.ownerId = args[++i];
    else if (args[i] === '--dry-run') cli.dryRun = true;
  }
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) { console.error('Set MONGO_URI (or MONGODB_URI)'); process.exit(1); }
  mongoose.connect(uri)
    .then(() => runBackfillFunds(cli))
    .then(() => mongoose.disconnect())
    .catch((err) => { console.error(err); process.exit(1); });
}
