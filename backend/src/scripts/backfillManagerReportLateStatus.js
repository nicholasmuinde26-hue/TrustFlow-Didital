import mongoose from "mongoose";
import AssetManagerReport from "../models/AssetManagerReport.js";

/**
 * Backfill: filed-but-late manager reports
 * ========================================
 * Older builds stored a report that was filed after its due date as
 * status "late" (which is also the status of a report that is overdue and
 * still UNFILED). Filed reports now always have status "submitted" with
 * submission.was_late = true. This converts the old rows. Idempotent: it
 * only touches rows that are "late" AND have a submission timestamp.
 *
 * Run once: node src/scripts/backfillManagerReportLateStatus.js
 * (needs MONGODB_URI / the same env the app uses).
 */
export async function runBackfillManagerReportLateStatus() {
  const result = await AssetManagerReport.updateMany(
    { status: "late", "submission.submitted_at": { $ne: null } },
    { $set: { status: "submitted", "submission.was_late": true } }
  );
  return { modified: result.modifiedCount };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { connectDatabase } = await import("../config/database.js");
  await connectDatabase();
  console.log("Backfill result:", await runBackfillManagerReportLateStatus());
  await mongoose.disconnect();
}
