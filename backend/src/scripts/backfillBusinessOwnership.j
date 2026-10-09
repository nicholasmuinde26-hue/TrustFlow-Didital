/**
 * One-off backfill for businesses created before ownership was enforced.
 *
 * Old rows from the admin-approval flow were saved with no owner_id, and the
 * ones approved from a chama's "Request business" form were saved as personal
 * businesses owned by the requesting treasurer/chairperson. This script:
 *
 *   1. personal rows with no owner_id  -> owner_id = created_by
 *   2. rows whose originating WorkspaceRequest named a chama -> reported only
 *
 * (2) is NOT auto-converted: legacy requests never stored the chama (the field
 * was silently dropped), so there is nothing reliable to convert from. Review
 * the printed list and re-register those through the new request flow, or fix
 * them by hand.
 *
 * Usage:  node src/scripts/backfillBusinessOwnership.js [--apply]
 * Without --apply it only prints what it would change.
 */
import mongoose from "mongoose";
import Business from "../models/Business.js";

const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

const orphans = await Business.find({
  owner_type: { $ne: "chama" },
  $or: [{ owner_id: null }, { owner_id: { $exists: false } }],
}).select("_id name created_by");

console.log(`${orphans.length} personal business(es) with no owner_id`);
for (const business of orphans) {
  console.log(` - ${business._id}  ${business.name}  -> owner ${business.created_by}`);
  if (apply) {
    await Business.updateOne({ _id: business._id }, { $set: { owner_id: business.created_by, owner_type: "user" } });
  }
}

console.log(apply ? "Applied." : "Dry run only. Re-run with --apply to write changes.");
await mongoose.disconnect();
