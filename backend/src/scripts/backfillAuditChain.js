import mongoose from 'mongoose';
import env from '../config/env.js';
import AuditLog from '../models/AuditLog.js';
import AuditChainState from '../models/Auditchainstate.js';
import {
  hashChainEntry,
  buildAuditHashPayload,
} from '../utils/hashChain.js';

/**
 * Backfill: Audit Log Hash Chain
 * ==============================
 *
 * `sequence` and `hash` are `required: true` on AuditLog, and two unique
 * partial indexes now pin (scope, sequence). Every audit row written
 * before hash-chaining existed has neither field, which breaks two
 * things at once on deploy:
 *
 *   1. INDEX BUILD FAILURE. Mongo treats a missing field as null for
 *      uniqueness. Every legacy CHAMA row therefore collides on
 *      (scopeType:'CHAMA', chamaId, sequence:null) the moment the unique
 *      index is built, and the build fails. Mongoose's autoIndex runs at
 *      model compile time and logs this rather than crashing, so the app
 *      comes up looking healthy with no uniqueness guarantee at all.
 *
 *   2. VERIFICATION FAILURE. verifyAuditChain() walks entries expecting
 *      sequence 1..N. Legacy rows have no sequence, so every chama with
 *      any history reports BROKEN - which is worse than reporting
 *      nothing, because "tamper detected" that actually means "we
 *      shipped a migration" destroys trust in the signal.
 *
 * This script closes both by walking each scope's existing entries in
 * creation order, assigning sequence 1..N, and chaining their hashes
 * exactly the way createAuditLog() would have.
 *
 * WHAT THIS CAN AND CANNOT PROVE
 * ------------------------------
 * Hashes computed now attest to what the rows contain NOW, not to what
 * they contained when written. The chain is only evidence from this
 * point forward. That is unavoidable for pre-existing data and worth
 * being upfront about rather than papering over - a backfilled entry
 * is marked with `metadata.chainBackfilledAt` so nobody later mistakes
 * a migration-era hash for a write-time one.
 *
 * WHY RAW COLLECTION WRITES
 * -------------------------
 * AuditLog deliberately blocks updateOne/updateMany/findOneAndUpdate at
 * the schema level - audit rows are immutable. That block is correct and
 * stays. This script goes around it through the raw driver
 * (`AuditLog.collection`) because it is a one-time migration adding
 * integrity metadata to rows that predate the feature, not a business
 * write path. It is the only place in the codebase that should do this.
 *
 * RUN ORDER (important)
 * ---------------------
 * Run this against the database BEFORE the new AuditLog indexes are
 * built - i.e. before the updated app boots against that database, or
 * with `--sync-indexes` which does the backfill first and then builds
 * the indexes explicitly.
 *
 * Usage: node src/scripts/backfillAuditChain.js [options]
 *
 * Options:
 * --dry-run        : Report what would change without writing anything
 * --chama-id <id>  : Backfill one chama's chain only
 * --group-id <id>  : Backfill one contribution group's chain only
 * --sync-indexes   : After backfilling, run AuditLog.syncIndexes()
 * --force          : Re-chain scopes that already have hashed entries
 *                    (destructive; only for a failed partial run)
 */


// ----------------------------------------------------------------------
// ARGUMENT PARSING
// ----------------------------------------------------------------------

const parseArgs = (argv) => {
  const args = {
    dryRun: argv.includes('--dry-run'),
    syncIndexes: argv.includes('--sync-indexes'),
    force: argv.includes('--force'),
    chamaId: null,
    groupId: null,
  };

  const chamaIndex = argv.indexOf('--chama-id');
  if (chamaIndex !== -1) {
    args.chamaId = argv[chamaIndex + 1] || null;
  }

  const groupIndex = argv.indexOf('--group-id');
  if (groupIndex !== -1) {
    args.groupId = argv[groupIndex + 1] || null;
  }

  return args;
};


// ----------------------------------------------------------------------
// DISCOVER SCOPES
// ----------------------------------------------------------------------
//
// Every distinct (scopeType, chamaId, contributionGroupId) that has at
// least one audit entry. Each one is an independent chain.
//
// ----------------------------------------------------------------------

const findScopes = async (args) => {
  const match = {};

  if (args.chamaId) {
    match.scopeType = 'CHAMA';
    match.chamaId = new mongoose.Types.ObjectId(args.chamaId);
  }

  if (args.groupId) {
    match.scopeType = 'CONTRIBUTION_GROUP';
    match.contributionGroupId = new mongoose.Types.ObjectId(args.groupId);
  }

  return AuditLog.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          scopeType: '$scopeType',
          chamaId: '$chamaId',
          contributionGroupId: '$contributionGroupId',
        },
        total: { $sum: 1 },
        alreadyChained: {
          $sum: { $cond: [{ $ifNull: ['$hash', false] }, 1, 0] },
        },
      },
    },
  ]);
};


// ----------------------------------------------------------------------
// BACKFILL ONE SCOPE
// ----------------------------------------------------------------------

const backfillScope = async (scope, args) => {
  const scopeFilter = {
    scopeType: scope._id.scopeType,
    chamaId: scope._id.chamaId || null,
    contributionGroupId: scope._id.contributionGroupId || null,
  };

  const label =
    scopeFilter.scopeType === 'CHAMA'
      ? `CHAMA ${scopeFilter.chamaId}`
      : `CONTRIBUTION_GROUP ${scopeFilter.contributionGroupId}`;

  if (scope.alreadyChained > 0 && !args.force) {
    console.log(
      `  SKIP  ${label} - ${scope.alreadyChained}/${scope.total} entries already chained (use --force to re-chain)`
    );
    return { skipped: true, updated: 0 };
  }

  // Ordering is the one judgement call here. Legacy rows have no
  // sequence, so creation order is the only ordering signal available.
  // _id is the tiebreaker because ObjectIds are monotonic within a
  // second and createdAt alone is not unique under bulk writes.
  const entries = await AuditLog.find(scopeFilter)
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const backfilledAt = new Date();
  const operations = [];

  let prevHash = null;
  let sequence = 0;

  for (const entry of entries) {
    sequence += 1;

    const metadata = {
      ...(entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : {}),
      chainBackfilledAt: backfilledAt,
    };

    // If the entry had non-object metadata (a string, a number), keep it
    // rather than silently discarding audit content.
    if (entry.metadata && typeof entry.metadata !== 'object') {
      metadata.originalMetadata = entry.metadata;
    }

    const hash = hashChainEntry(
      prevHash,
      buildAuditHashPayload({ ...entry, metadata, sequence })
    );

    operations.push({
      updateOne: {
        filter: { _id: entry._id },
        update: {
          $set: {
            sequence,
            prevHash,
            hash,
            metadata,
          },
        },
      },
    });

    prevHash = hash;
  }

  if (args.dryRun) {
    console.log(`  DRY   ${label} - would chain ${operations.length} entries, tip ${prevHash?.slice(0, 12)}...`);
    return { skipped: false, updated: 0 };
  }

  if (operations.length > 0) {
    // Raw driver on purpose - see "WHY RAW COLLECTION WRITES" above.
    await AuditLog.collection.bulkWrite(operations, { ordered: true });
  }

  await AuditChainState.findOneAndUpdate(
    scopeFilter,
    { $set: { sequence, lastHash: prevHash } },
    { upsert: true, new: true }
  );

  console.log(`  OK    ${label} - chained ${operations.length} entries, tip ${prevHash?.slice(0, 12)}...`);

  return { skipped: false, updated: operations.length };
};


// ----------------------------------------------------------------------
// MAIN
// ----------------------------------------------------------------------

export const runBackfillAuditChain = async (argv = []) => {
  const args = parseArgs(argv);

  console.log('Audit hash chain backfill');
  console.log(args.dryRun ? '  MODE: dry run (no writes)' : '  MODE: live');

  const scopes = await findScopes(args);

  console.log(`  Found ${scopes.length} audit scope(s) with existing entries`);

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const scope of scopes) {
    const outcome = await backfillScope(scope, args);
    totalUpdated += outcome.updated;
    if (outcome.skipped) {
      totalSkipped += 1;
    }
  }

  console.log(`  Done - ${totalUpdated} entries chained, ${totalSkipped} scope(s) skipped`);

  if (args.syncIndexes && !args.dryRun) {
    console.log('  Building AuditLog indexes...');
    await AuditLog.syncIndexes();
    await AuditChainState.syncIndexes();
    console.log('  Indexes in sync');
  }

  return { totalUpdated, totalSkipped, scopes: scopes.length };
};


// ----------------------------------------------------------------------
// STANDALONE ENTRY POINT
// ----------------------------------------------------------------------

const isDirectRun =
  process.argv[1] && process.argv[1].endsWith('backfillAuditChain.js');

if (isDirectRun) {
  (async () => {
    try {
      await mongoose.connect(env.mongoUri, {
        retryWrites: false,
        retryReads: false,
      });

      await runBackfillAuditChain(process.argv.slice(2));

      await mongoose.disconnect();
      process.exit(0);
    } catch (error) {
      console.error('Backfill failed:', error.message);
      process.exit(1);
    }
  })();
}

export default runBackfillAuditChain;