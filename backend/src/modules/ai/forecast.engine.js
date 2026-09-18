/**
 * ============================================================
 * CONTRIBUTION FORECAST ENGINE
 * ============================================================
 *
 * Deterministic, explainable forecasting — no external model, no
 * training data, nothing that needs to be validated before a demo.
 *
 * Method:
 *   1. Compute the collection rate (paid / expected) for each of the
 *      last few periods.
 *   2. Fit a simple linear trend to that rate over time (least squares).
 *   3. Project next period's rate = trend extrapolated one step forward,
 *      clamped to [0, 1] so it can't predict >100% or negative collection.
 *   4. Multiply by the most recent period's expected amount to get a
 *      projected shortfall.
 *
 * This is intentionally a transparent statistical projection rather than
 * an ML model — it's honest about what it is, and every number in the
 * output can be explained in one sentence to a judge or a treasurer.
 * ============================================================
 */

const MIN_PERIODS_FOR_TREND = 3;

function linearRegressionSlope(yValues) {
  const n = yValues.length;
  const xValues = yValues.map((_, i) => i);
  const xMean = xValues.reduce((a, b) => a + b, 0) / n;
  const yMean = yValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xValues[i] - xMean) * (yValues[i] - yMean);
    denominator += (xValues[i] - xMean) ** 2;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

/**
 * @param {Array<{periodStart, periodEnd, expected, paid}>} periods oldest -> newest
 * @returns {object|null} forecast, or null if there isn't enough history
 */
export function forecastNextPeriod(periods) {
  const usablePeriods = (periods || []).filter((p) => p.expected > 0);

  if (usablePeriods.length < MIN_PERIODS_FOR_TREND) {
    return {
      available: false,
      reason: "Not enough completed contribution periods yet to forecast (need at least 3).",
      periodsAvailable: usablePeriods.length,
    };
  }

  const rates = usablePeriods.map((p) => p.paid / p.expected);
  const { slope, intercept } = linearRegressionSlope(rates);

  const nextIndex = rates.length;
  let projectedRate = intercept + slope * nextIndex;
  projectedRate = Math.max(0, Math.min(1, projectedRate));

  const lastPeriod = usablePeriods[usablePeriods.length - 1];
  // Assume next period's obligation is similar in size to the most recent one —
  // the honest default when we don't know next period's exact member count/plan.
  const projectedExpected = lastPeriod.expected;
  const projectedPaid = projectedExpected * projectedRate;
  const projectedShortfall = Math.max(0, projectedExpected - projectedPaid);

  const recentRates = rates.slice(-3);
  const avgRecentRate = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
  const variance =
    recentRates.reduce((sum, r) => sum + (r - avgRecentRate) ** 2, 0) / recentRates.length;
  // More periods and lower variance in recent collection rate = more confidence.
  const confidence =
    usablePeriods.length >= 6 && variance < 0.02
      ? "high"
      : usablePeriods.length >= 4 && variance < 0.05
      ? "medium"
      : "low";

  return {
    available: true,
    projectedCollectionRatePercent: Math.round(projectedRate * 100),
    projectedExpected: Math.round(projectedExpected),
    projectedShortfall: Math.round(projectedShortfall),
    trendDirection: slope > 0.01 ? "improving" : slope < -0.01 ? "worsening" : "flat",
    confidence,
    periodsUsed: usablePeriods.length,
  };
}

export default { forecastNextPeriod };