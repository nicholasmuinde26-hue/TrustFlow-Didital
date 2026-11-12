import mongoose from 'mongoose';
import Chama from '../models/Chama.js';
import {
  WORKSPACE_PRESETS,
  LEGACY_PRESET_BY_CHAMA_TYPE,
  LEGACY_MODULES_BY_PRESET,
  buildWorkspaceConfig,
} from '../constants/workspaceModules.constants.js';
import { ORGANIZATION_TYPES, ORGANIZATION_FAMILIES, getDefaultTerminology } from '../constants/organizationTypes.constants.js';

const FAMILY_BY_LEGACY_TYPE = Object.freeze({
  ...Object.fromEntries(ORGANIZATION_TYPES.sacco.map(({ key }) => [key, 'sacco'])),
  ...Object.fromEntries(ORGANIZATION_TYPES.cooperative.map(({ key }) => [key, 'cooperative'])),
  property_sacco: 'chama', // historical chama subtype, not a regulated SACCO classification
  investment: 'chama',
});

export function inferOrganizationType(chama) {
  const raw = String(chama.chama_type || '').toLowerCase();
  const family = FAMILY_BY_LEGACY_TYPE[raw] || 'chama';
  const normalized = raw === 'investment' ? 'investment_group' : raw === 'burial' ? 'welfare' : raw === 'property_sacco' ? 'housing' : raw;
  const match = ORGANIZATION_TYPES[family].find(({ key }) => key === normalized);
  return { family, type: match?.key || 'custom' };
}

/**
 * Backfill: Workspace config and organization classification for existing chamas
 * ================================================================
 *
 * Classifies legacy records from their existing chama_type and stores the
 * frozen legacy module list where no explicit selection exists. It never
 * overwrites organization fields or module selections already stored.
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

  const query = { $or: [
    { 'workspace_config.modules': { $exists: false } },
    { 'workspace_config.modules': null },
    { organization_family: { $exists: false } },
    { organization_family: null },
    { organization_family: { $nin: ORGANIZATION_FAMILIES.map(({ key }) => key) } },
    { organization_type: { $exists: false } },
    { organization_type: null },
    { organization_type: { $nin: Object.values(ORGANIZATION_TYPES).flat().map(({ key }) => key) } },
  ] };
  if (chamaId) query._id = chamaId;

  const chamas = await Chama.find(query).select('name chama_type organization_family organization_type workspace_config').lean();
  log(`Found ${chamas.length} organization record(s) needing backfill${dryRun ? ' (dry run)' : ''}`);

  const summary = { total: chamas.length, updated: 0, failed: 0, modulesBackfilled: 0, organizationsClassified: 0 };

  for (const chama of chamas) {
    try {
      const needsClassification = !chama.organization_family || !chama.organization_type;
      const inferred = inferOrganizationType(chama);
      const family = ORGANIZATION_FAMILIES.some((item) => item.key === chama.organization_family)
        ? chama.organization_family : inferred.family;
      const type = ORGANIZATION_TYPES[family].some((item) => item.key === chama.organization_type)
        ? chama.organization_type : (family === inferred.family ? inferred.type : 'custom');
      const needsModules = !chama.workspace_config?.modules || Object.keys(chama.workspace_config.modules.toObject?.() || chama.workspace_config.modules || {}).length === 0;
      const presetKey = needsModules
        ? (LEGACY_PRESET_BY_CHAMA_TYPE[chama.chama_type] || 'standard')
        : null;
      if (!dryRun) {
        const updates = { organization_family: family, organization_type: type };
        if (needsModules) updates.workspace_config = buildWorkspaceConfig({
          preset: presetKey,
          enabled: LEGACY_MODULES_BY_PRESET[presetKey] || WORKSPACE_PRESETS[presetKey].modules,
          terminology: chama.workspace_config?.terminology || getDefaultTerminology(family),
          assetTypes: chama.workspace_config?.asset_types || null,
        });
        await Chama.updateOne({ _id: chama._id }, { $set: updates });
      }
      summary.updated += 1;
      if (needsModules) summary.modulesBackfilled += 1;
      if (needsClassification) summary.organizationsClassified += 1;
      log(`  ${dryRun ? 'would classify' : 'classified'} ${chama.name} -> ${family} / ${type}${presetKey ? `; modules ${presetKey}` : ''}`);
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
