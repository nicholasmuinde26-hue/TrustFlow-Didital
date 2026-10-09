import mongoose from 'mongoose';
import permissionService from '../services/permission.service.js';
import Chama from '../models/Chama.js';
import ChamaMembership from '../models/ChamaMembership.js';

/**
 * Backfill: Chairperson Wallet (Chart of Accounts) View Access
 * ============================================================
 *
 * `finance.accounts.view` was added to the chairperson's default
 * permission set so the chairperson can see the same chama wallet
 * data as the treasurer - every FinancialAccount balance, i.e. all
 * contribution and savings totals - without being able to edit any
 * of it (there is no finance.accounts.edit/update permission in the
 * system at all; balances only ever change through vetted, internal
 * ledger-posting code).
 *
 * That default only applies when a chama's permissions are first
 * initialized. Chamas created before this change already have their
 * RolePermission rows seeded and won't pick up the new key on their
 * own, so this backfill grants it directly, chama by chama. It is
 * idempotent - permissionService.grantPermission() updates the
 * existing row if one is already there - so it is safe to re-run.
 *
 * MOUNTED:
 * --------
 * `runBackfillChairpersonWalletView()` is exported so it can be
 * called from application startup (see server.js, right after
 * connectDatabase()/bootstrapSuperAdmin() - same self-healing pattern
 * as config/bootstrapAdmin.js), guaranteeing every chama has this
 * permission on every boot with no manual step required. It is also
 * still runnable standalone for one-off targeted/dry-run use:
 *
 * Usage: node src/scripts/backfillChairpersonWalletView.js
 *
 * Options:
 * --chama-id <id> : Backfill a specific chama only
 * --dry-run       : Show what would be done without making changes
 */

const PERMISSION_KEY = 'finance.accounts.view';

/**
 * Grants `finance.accounts.view` to the active chairperson of every
 * matching chama that doesn't already have it.
 *
 * @param {object} options
 * @param {string|null} options.chamaId - Backfill a specific chama only.
 * @param {boolean} options.dryRun - Report what would happen, make no changes.
 * @param {boolean} options.silent - Suppress console output (useful on startup).
 * @returns {Promise<{total:number, granted:number, skippedNoChairperson:number, failed:number}>}
 */
export async function runBackfillChairpersonWalletView(options = {}) {
  const { chamaId = null, dryRun = false, silent = false } = options;

  const log = (...args) => {
    if (!silent) console.log(...args);
  };

  log('🚀 Backfilling chairperson wallet view access');
  log('=====================================');
  if (dryRun) log('📋 DRY RUN MODE - No changes will be made');
  if (chamaId) log(`🎯 Targeting specific chama: ${chamaId}`);

  const query = { status: 'active' };
  if (chamaId) query._id = chamaId;

  const chamas = await Chama.find(query).sort({ name: 1 });
  log(`📊 Found ${chamas.length} chama(s) to process`);

  let granted = 0;
  let skippedNoChairperson = 0;
  let failed = 0;

  for (const chama of chamas) {
    // Only bother granting the permission where there's actually an
    // active chairperson membership to use it - mirrors the existing
    // seedPermissions.js pattern of using an admin membership as the
    // audit-trail "granted_by" actor.
    const chairMembership = await ChamaMembership.findOne({
      chama_id: chama._id,
      role: 'chairperson',
      status: 'active'
    });

    if (!chairMembership) {
      log(`⏭️  Skipping "${chama.name}" - no active chairperson`);
      skippedNoChairperson++;
      continue;
    }

    if (dryRun) {
      log(`📋 [DRY RUN] Would grant ${PERMISSION_KEY} to chairperson in "${chama.name}"`);
      continue;
    }

    try {
      await permissionService.grantPermission(chama._id, 'chairperson', PERMISSION_KEY, {
        scopeOverride: 'all',
        grantedBy: chairMembership._id,
        reason: 'Backfill: chairperson chama wallet view access'
      });
      log(`✅ Granted ${PERMISSION_KEY} to chairperson in "${chama.name}"`);
      granted++;
    } catch (error) {
      console.error(`❌ Failed for "${chama.name}":`, error.message);
      failed++;
    }
  }

  log('\n📈 Summary:');
  log(`   Total chamas: ${chamas.length}`);
  log(`   Granted: ${granted}`);
  log(`   Skipped (no active chairperson): ${skippedNoChairperson}`);
  log(`   Failed: ${failed}`);
  log('\n✅ Backfill script completed');

  return { total: chamas.length, granted, skippedNoChairperson, failed };
}

// ========================================
// CLI ENTRYPOINT
// ========================================
// Only connects/disconnects Mongo and parses argv when this file is
// executed directly (`node src/scripts/backfillChairpersonWalletView.js`).
// When imported (e.g. by server.js) this whole block is skipped and the
// caller's existing DB connection is reused via runBackfillChairpersonWalletView().
const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isDirectRun) {
  const args = process.argv.slice(2);
  const cliOptions = { chamaId: null, dryRun: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--chama-id':
        cliOptions.chamaId = args[i + 1];
        i++;
        break;
      case '--dry-run':
        cliOptions.dryRun = true;
        break;
    }
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager';

  (async () => {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('✅ Connected to MongoDB');
      await runBackfillChairpersonWalletView(cliOptions);
    } catch (error) {
      console.error('\n❌ Backfill script failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
      console.log('✅ Disconnected from MongoDB');
    }
  })();
}