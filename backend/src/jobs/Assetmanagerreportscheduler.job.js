import { sweepManagerReportSchedules } from "../modules/chamaAssets/assetManagerReport.service.js";

// Every 6h is plenty — reporting periods are monthly/quarterly, nothing
// here is time-critical to the minute, and it mirrors the existing
// savings share-out scheduler's cadence for the same reason.
const SWEEP_INTERVAL_MS = Number(process.env.ASSET_MANAGER_REPORT_SWEEP_INTERVAL_MS) || 6 * 60 * 60 * 1000;

export const startAssetManagerReportSchedulerJob = () => {
  const run = () => sweepManagerReportSchedules().catch((error) => console.error("[asset-manager-report-scheduler] sweep failed:", error.message));
  run(); // catch up on boot rather than waiting a full interval
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};