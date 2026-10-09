import mongoose from 'mongoose';
import Chama from '../models/Chama.js';
import {
  WORKSPACE_PRESETS,
  LEGACY_PRESET_BY_CHAMA_TYPE,
  buildWorkspaceConfig,
} from '../constants/workspaceModules.constants.js';

/**
 * Backfill: Workspace config (feature modules) for existing chamas
 * ================================================================
 *
 * Chamas created before configurable workspaces have no `workspace_config`.
 * The app already treats such a chama as "its legacy set" (see
 * getEnabledModules), so running this is OPTIONAL and changes nothing anyone
 * sees: it writes the exact legacy module set (`standard` or `burial`,
 * chosen from chama_type) onto each chama, so that from now on every chama has
 * an explicit, editable config.
 *
 * Idempotent: chamas that already have modules stored are skipped.
 *
 * Usage: node src/scripts/backfillWorkspaceConfig.js
 * Options:
 *   --chama-id <id> : only this chama
 *   --dry-run       : report what would change, write nothing
 */
export async function runBackfillWorkspaceConfig(options = {}) {
  const { chamaId = null, dryRun = false, silent = false } = options;
  const log = (...args) => { if (!silent) console.log(...args); };

  const query = {
    $or: [
      { 'workspace_config.modules': { $exists: false } },
      { 'workspace_config.modules': null },
    ],
  };
  if (chamaId) query._id = chamaId;

  const chamas = await Chama.find(query).select('name chama_type workspace_config');
  log(`Found ${chamas.length} chama(s) without a workspace config${dryRun ? ' (dry run)' : ''}`);

  const summary = { total: chamas.length, updated: 0, failed: 0 };

  for (const chama of chamas) {
    try {
      const presetKey = LEGACY_PRESET_BY_CHAMA_TYPE[chama.chama_type] || 'standard';
      if (!dryRun) {
        chama.workspace_config = buildWorkspaceConfig({
          preset: presetKey,
          enabled: WORKSPACE_PRESETS[presetKey].modules,
        });
        await chama.save();
      }
      summary.updated += 1;
      log(`  ${dryRun ? 'would set' : 'set'} ${chama.name} -> ${presetKey}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`  failed ${chama._id} (${chama.name}): ${error.message}`);
    }
  }

  log(`Done: ${summary.updated} updated, ${summary.failed} failed`);
  return summary;
}

const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isDirectRun) {
  const args = process.argv.slice(2);
  const cliOptions = { chamaId: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--chama-id') { cliOptions.chamaId = args[i + 1]; i++; }
    if (args[i] === '--dry-run') cliOptions.dryRun = true;
  }

  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager';

  (async () => {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      await runBackfillWorkspaceConfig(cliOptions);
    } catch (error) {
      console.error('Backfill failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
