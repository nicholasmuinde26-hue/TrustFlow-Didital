import mongoose from 'mongoose';
import permissionService from '../services/permission.service.js';
import Chama from '../models/Chama.js';
import ChamaMembership from '../models/ChamaMembership.js';

/**
 * Seed Default Permissions Script
 *
 * This script initializes default permissions for existing chamas
 * that were created before the permission system was implemented.
 *
 * Usage: node src/scripts/seedPermissions.js
 *
 * Options:
 * --chama-id <id> : Initialize permissions for specific chama only
 * --dry-run       : Show what would be done without making changes
 * --verbose       : Show detailed output
 */

// ========================================
// COMMAND LINE ARGUMENTS
// ========================================

const args = process.argv.slice(2);
const options = {
  chamaId: null,
  dryRun: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--chama-id':
      options.chamaId = args[i + 1];
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
// PERMISSION INITIALIZATION
// ========================================

async function initializeChamaPermissions(chama, options) {
  console.log(`\n🔧 Processing chama: ${chama.name} (${chama._id})`);

  try {
    // Find a treasurer or chairperson to use as the initializer
    const adminMembership = await ChamaMembership.findOne({
      chama_id: chama._id,
      role: { $in: ['treasurer', 'chairperson'] },
      status: 'active'
    });

    if (!adminMembership) {
      console.log(`⚠️  No active treasurer or chairperson found for chama ${chama.name}`);
      return { success: false, reason: 'No admin membership found' };
    }

    if (options.dryRun) {
      console.log(`📋 [DRY RUN] Would initialize permissions for chama ${chama.name}`);
      console.log(`   - Using admin: ${adminMembership.role} (${adminMembership._id})`);
      return { success: true, dryRun: true };
    }

    // Initialize permissions
    const permissions = await permissionService.initializeDefaultPermissions(
      chama._id,
      adminMembership._id
    );

    console.log(`✅ Successfully initialized ${permissions.length} permissions for chama ${chama.name}`);
    console.log(`   - Using admin: ${adminMembership.role} (${adminMembership._id})`);

    if (options.verbose) {
      console.log(`   - Permissions granted:`);
      const permissionsByRole = {};
      permissions.forEach(perm => {
        if (!permissionsByRole[perm.role]) {
          permissionsByRole[perm.role] = [];
        }
        permissionsByRole[perm.role].push(perm.permission_key);
      });

      for (const [role, perms] of Object.entries(permissionsByRole)) {
        console.log(`     * ${role}: ${perms.length} permissions`);
      }
    }

    return { success: true, permissionsCount: permissions.length };

  } catch (error) {
    console.error(`❌ Failed to initialize permissions for chama ${chama.name}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function checkExistingPermissions(chama) {
  try {
    const RolePermission = (await import('../models/RolePermission.js')).default;
    const count = await RolePermission.countDocuments({
      chama_id: chama._id,
      status: 'active'
    });
    return count;
  } catch (error) {
    console.error('Error checking existing permissions:', error.message);
    return 0;
  }
}

async function processAllChamas(options) {
  try {
    let query = { status: 'active' };

    if (options.chamaId) {
      query._id = options.chamaId;
    }

    const chamas = await Chama.find(query).sort({ name: 1 });

    if (chamas.length === 0) {
      console.log('⚠️  No active chamas found');
      return;
    }

    console.log(`📊 Found ${chamas.length} chama(s) to process`);

    const results = {
      total: chamas.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      details: []
    };

    for (const chama of chamas) {
      // Check if permissions already exist
      const existingPermissions = await checkExistingPermissions(chama);

      if (existingPermissions > 0) {
        console.log(`⏭️  Skipping chama ${chama.name} - already has ${existingPermissions} permissions`);
        results.skipped++;
        results.details.push({
          chamaId: chama._id,
          chamaName: chama.name,
          status: 'skipped',
          existingPermissions
        });
        continue;
      }

      const result = await initializeChamaPermissions(chama, options);

      if (result.success) {
        results.processed++;
        results.details.push({
          chamaId: chama._id,
          chamaName: chama.name,
          status: result.dryRun ? 'dry_run' : 'success',
          permissionsCount: result.permissionsCount
        });
      } else {
        results.failed++;
        results.details.push({
          chamaId: chama._id,
          chamaName: chama.name,
          status: 'failed',
          reason: result.reason || result.error
        });
      }
    }

    // Print summary
    console.log('\n📈 Summary:');
    console.log(`   Total chamas: ${results.total}`);
    console.log(`   Processed: ${results.processed}`);
    console.log(`   Skipped: ${results.skipped}`);
    console.log(`   Failed: ${results.failed}`);

    if (options.verbose && results.details.length > 0) {
      console.log('\n📋 Details:');
      results.details.forEach(detail => {
        console.log(`   - ${detail.chamaName}: ${detail.status}`);
        if (detail.existingPermissions) {
          console.log(`     Existing permissions: ${detail.existingPermissions}`);
        }
        if (detail.permissionsCount) {
          console.log(`     Permissions granted: ${detail.permissionsCount}`);
        }
        if (detail.reason) {
          console.log(`     Reason: ${detail.reason}`);
        }
      });
    }

    return results;

  } catch (error) {
    console.error('❌ Error processing chamas:', error.message);
    throw error;
  }
}

// ========================================
// MAIN EXECUTION
// ========================================

async function main() {
  console.log('🚀 Starting Permission Seed Script');
  console.log('=====================================');

  if (options.dryRun) {
    console.log('📋 DRY RUN MODE - No changes will be made');
  }

  if (options.verbose) {
    console.log('📝 VERBOSE MODE - Detailed output enabled');
  }

  if (options.chamaId) {
    console.log(`🎯 Targeting specific chama: ${options.chamaId}`);
  }

  try {
    await connectToDatabase();
    await processAllChamas(options);
    console.log('\n✅ Permission seed script completed successfully');
  } catch (error) {
    console.error('\n❌ Permission seed script failed:', error.message);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});