import mongoose from 'mongoose';
import permissionService from '../services/permission.service.js';
import Chama from '../models/Chama.js';
import ChamaMembership from '../models/ChamaMembership.js';
import RolePermission from '../models/RolePermission.js';

/**
 * Backfill Missing Role Permissions Script
 *
 * seedPermissions.js only initializes chamas that have ZERO
 * RolePermission rows at all. It intentionally skips any chama that
 * already has some rows, on the assumption those rows fully reflect
 * that chama's configuration.
 *
 * That assumption breaks whenever DEFAULT_ROLE_PERMISSIONS gains a
 * new key for a role after a chama's rows were already seeded (or a
 * chama only ever had a subset of roles/keys granted manually). The
 * chama is missing a key it should have by default, and
 * permissionService.hasPermission() has no way to tell "never seeded"
 * apart from "deliberately revoked" once ANY row exists for that role —
 * see the comment in permission.service.js#hasPermission. The runtime
 * fallback fix there handles this going forward, but existing chamas'
 * RolePermission tables are still missing rows, which:
 *   - is fixed automatically the first time each key is *checked* (the
 *     fallback grants it in-memory), but leaves the source-of-truth
 *     table incomplete for anything that inspects it directly (e.g. an
 *     admin permissions screen, getRolePermissions()).
 *   - adds one extra RolePermission.exists() query per check until
 *     backfilled.
 *
 * This script finds, for every active chama and every role, any
 * DEFAULT_ROLE_PERMISSIONS key that has NO RolePermission row at all
 * (active or otherwise) and grants it. It never touches a key that
 * already has a row — including one with status 'revoked' or
 * 'expired' — so a deliberate revocation is never undone.
 *
 * Usage: node src/scripts/backfillMissingRolePermissions.js
 *
 * Options:
 * --chama-id <id> : Backfill a specific chama only
 * --role <role>   : Backfill a specific role only (e.g. chairperson)
 * --dry-run       : Show what would be granted without making changes
 * --verbose       : Show detailed output
 */

// ========================================
// COMMAND LINE ARGUMENTS
// ========================================

const args = process.argv.slice(2);
const options = {
  chamaId: null,
  role: null,
  dryRun: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--chama-id':
      options.chamaId = args[i + 1];
      i++;
      break;
    case '--role':
      options.role = args[i + 1];
      i++;
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
  }
}

// ========================================
// DATABASE CONNECTION
// ========================================

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager';

async function connectToDatabase() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function disconnectFromDatabase() {
  try {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Failed to disconnect from MongoDB:', error.message);
  }
}

// ========================================
// BACKFILL
// ========================================

async function backfillChama(chama, defaultsByRole, options) {
  const roles = options.role ? [options.role] : Object.keys(defaultsByRole);
  const chamaResult = { chamaId: chama._id, chamaName: chama.name, granted: [], skipped: [] };

  // Only backfill roles that are actually assigned in this chama, so
  // we don't create dead RolePermission rows for roles nobody holds.
  const assignedRoles = new Set(
    (await ChamaMembership.find({ chama_id: chama._id, role: { $in: roles } }).distinct('role'))
  );

  for (const role of roles) {
    if (!assignedRoles.has(role)) continue;

    const defaultKeys = defaultsByRole[role] || [];

    for (const perm of defaultKeys) {
      const existing = await RolePermission.findOne({
        chama_id: chama._id,
        role,
        permission_key: perm.key
      });

      if (existing) {
        // A row already exists for this exact key — whatever its
        // status, that's a deliberate prior decision. Never touch it.
        continue;
      }

      if (options.dryRun) {
        chamaResult.granted.push({ role, key: perm.key, dryRun: true });
        continue;
      }

      const adminMembership = await ChamaMembership.findOne({
        chama_id: chama._id,
        role: { $in: ['treasurer', 'chairperson'] },
        status: 'active'
      });

      await permissionService.grantPermission(chama._id, role, perm.key, {
        scopeOverride: perm.scope,
        grantedBy: adminMembership?._id || null,
        reason: 'Backfill: key added to defaults after this chama was seeded'
      });

      chamaResult.granted.push({ role, key: perm.key });
    }
  }

  return chamaResult;
}

async function main() {
  console.log('🚀 Starting Missing Role Permissions Backfill');
  console.log('=====================================');

  if (options.dryRun) console.log('📋 DRY RUN MODE - No changes will be made');
  if (options.verbose) console.log('📝 VERBOSE MODE - Detailed output enabled');
  if (options.chamaId) console.log(`🎯 Targeting specific chama: ${options.chamaId}`);
  if (options.role) console.log(`🎯 Targeting specific role: ${options.role}`);

  try {
    await connectToDatabase();

    // Defaults live on the service module but aren't exported directly —
    // read them the same way hasPermission() would, via a tiny reflection
    // helper so this script can never drift from the real fallback list.
    const defaultsByRole = permissionService.getDefaultRolePermissions
      ? permissionService.getDefaultRolePermissions()
      : null;

    if (!defaultsByRole) {
      throw new Error(
        'permissionService.getDefaultRolePermissions() is not available — see the export added alongside this script.'
      );
    }

    const query = { status: 'active' };
    if (options.chamaId) query._id = options.chamaId;

    const chamas = await Chama.find(query).sort({ name: 1 });
    console.log(`📊 Found ${chamas.length} chama(s) to check`);

    const summary = { chamasTouched: 0, keysGranted: 0 };

    for (const chama of chamas) {
      const result = await backfillChama(chama, defaultsByRole, options);

      if (result.granted.length > 0) {
        summary.chamasTouched++;
        summary.keysGranted += result.granted.length;

        console.log(`\n🔧 ${chama.name} (${chama._id})`);
        result.granted.forEach(({ role, key, dryRun }) => {
          console.log(`   ${dryRun ? '📋 [DRY RUN] would grant' : '✅ granted'} ${role} → ${key}`);
        });
      } else if (options.verbose) {
        console.log(`⏭️  ${chama.name} - nothing missing`);
      }
    }

    console.log('\n📈 Summary:');
    console.log(`   Chamas checked: ${chamas.length}`);
    console.log(`   Chamas with missing keys${options.dryRun ? ' (dry run)' : ''}: ${summary.chamasTouched}`);
    console.log(`   Keys ${options.dryRun ? 'that would be granted' : 'granted'}: ${summary.keysGranted}`);

    console.log('\n✅ Backfill script completed successfully');
  } catch (error) {
    console.error('\n❌ Backfill script failed:', error.message);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});