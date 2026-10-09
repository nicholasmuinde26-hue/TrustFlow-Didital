import { sweepDueProfitDistributions } from "../modules/chamaAssets/chamaAsset.service.js";

const INTERVAL_MS = 60 * 1000;

export const startChamaProfitDistributionJob = () => {
  const timer = setInterval(() => {
    sweepDueProfitDistributions().catch((error) => console.error("[chama-profit-distribution] sweep failed:", error.message));
  }, INTERVAL_MS);
  timer.unref?.();
  return timer;
};
