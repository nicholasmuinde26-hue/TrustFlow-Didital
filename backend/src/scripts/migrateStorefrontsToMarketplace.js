import mongoose from 'mongoose';
import Business from '../models/Business.js';
import MarketplaceEnrollment from '../models/MarketplaceEnrollment.js';

/**
 * Migration: standalone storefronts -> marketplace-only
 * =====================================================
 *
 * Standalone storefronts have been removed; a business now appears only in the
 * VeriCircle marketplace hub for its category. This copies what sellers had
 * already set up in the old `storefronts` collection so nothing is lost:
 *
 *   - slug            -> Business.marketplace_slug (keeps existing public links
 *                        such as /marketplace/businesses/<slug> working)
 *   - name / headline / subtitle / location_text / theme colour
 *                     -> the business's marketplace profile, ONLY where the
 *                        profile field is still empty (never overwrites)
 *   - status "paused" -> Business.marketplace_paused (already mirrored, kept
 *                        in sync here for safety)
 *
 * The old `storefronts` and `storefrontorders` collections are NOT dropped.
 *
 * Idempotent. Usage: node src/scripts/migrateStorefrontsToMarketplace.js [--dry-run]
 */
export async function runMigrateStorefrontsToMarketplace({ dryRun = false, silent = false } = {}) {
  const log = (...args) => { if (!silent) console.log(...args); };
  const storefronts = await mongoose.connection.collection('storefronts').find({}).toArray();
  log(`Found ${storefronts.length} legacy storefront(s)${dryRun ? ' (dry run)' : ''}`);

  const summary = { total: storefronts.length, slugs: 0, profiles: 0, skipped: 0, failed: 0 };

  for (const sf of storefronts) {
    try {
      const business = await Business.findById(sf.business_id);
      if (!business) { summary.skipped += 1; continue; }

      if (!business.marketplace_slug && sf.slug) {
        const taken = await Business.exists({ marketplace_slug: sf.slug, _id: { $ne: business._id } });
        if (!taken) {
          if (!dryRun) { business.marketplace_slug = sf.slug; }
          summary.slugs += 1;
        }
      }
      if (sf.status === 'paused' && !business.marketplace_paused) {
        if (!dryRun) business.marketplace_paused = true;
      }
      if (!dryRun) await business.save();

      const enrollments = await MarketplaceEnrollment.find({ business_id: business._id });
      for (const enrollment of enrollments) {
        const profile = enrollment.merchant_profile?.toObject
          ? enrollment.merchant_profile.toObject()
          : { ...(enrollment.merchant_profile || {}) };
        const next = { ...profile };
        if (!next.display_name && sf.name) next.display_name = sf.name;
        if (!next.tagline && sf.headline) next.tagline = sf.headline;
        if (!next.description && sf.subtitle) next.description = sf.subtitle;
        if (!next.physical_location && sf.location_text) next.physical_location = sf.location_text;
        if (sf.theme?.primary_color && (!next.primary_color || next.primary_color === '#064e3b')) {
          next.primary_color = sf.theme.primary_color;
        }
        if (JSON.stringify(next) !== JSON.stringify(profile)) {
          if (!dryRun) { enrollment.merchant_profile = next; await enrollment.save(); }
          summary.profiles += 1;
        }
      }
    } catch (error) {
      summary.failed += 1;
      console.error(`  failed storefront ${sf._id}: ${error.message}`);
    }
  }

  log(`Done: ${summary.slugs} slug(s), ${summary.profiles} profile(s) updated, ${summary.skipped} skipped, ${summary.failed} failed`);
  return summary;
}

const isDirectRun = process.argv[1] &&
  import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;

if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chamamanager';
  (async () => {
    try {
      await mongoose.connect(MONGODB_URI);
      console.log('Connected to MongoDB');
      await runMigrateStorefrontsToMarketplace({ dryRun });
    } catch (error) {
      console.error('Migration failed:', error.message);
      process.exitCode = 1;
    } finally {
      await mongoose.disconnect();
    }
  })();
}
