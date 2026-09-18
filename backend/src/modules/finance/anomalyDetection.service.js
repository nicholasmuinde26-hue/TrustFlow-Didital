/**
 * ============================================================================
 * TRANSACTION ANOMALY DETECTION (read-only)
 * ============================================================================
 *
 * Deliberately NOT wired into the payment/posting pipeline. It only reads
 * ContributionPayment history and scores a payment against a participant's
 * own prior behaviour. This keeps the already-working reconciliation and
 * accounting code untouched while giving the AI/insights layer a real
 * "this transaction is unusual" signal.
 *
 * Method: z-score against the participant's own payment history (not a
 * global average — a KES 5,000 payment is normal for one member and
 * anomalous for another). This is a statistical check, not a black-box
 * model, so it's easy to explain to judges and to a treasurer.
 * ============================================================================
 */

import ContributionPayment from "../../models/ContributionPayment.js";
import { toDecimal } from "../../shared/decimal.js";

const MIN_HISTORY_FOR_SCORING = 3;
const Z_SCORE_THRESHOLD = 2.5;

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values, avg) {
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Score a single amount against a participant's own payment history.
 * Pure function — easy to unit test and to explain.
 */
export function scoreAmount(amount, historyAmounts) {
  if (!historyAmounts || historyAmounts.length < MIN_HISTORY_FOR_SCORING) {
    return { isAnomalous: false, reason: "insufficient_history", zScore: null };
  }

  const avg = mean(historyAmounts);
  const sd = stdDev(historyAmounts, avg);

  if (sd === 0) {
    // Every prior payment was identical (very common for fixed contribution
    // plans) — flag only a clear break from that fixed pattern.
    const ratio = avg > 0 ? amount / avg : 1;
    const isAnomalous = ratio >= 3 || ratio <= 0.2;
    return {
      isAnomalous,
      reason: isAnomalous ? "breaks_fixed_pattern" : null,
      zScore: null,
      average: avg,
    };
  }

  const zScore = (amount - avg) / sd;
  const isAnomalous = Math.abs(zScore) >= Z_SCORE_THRESHOLD;

  return {
    isAnomalous,
    reason: isAnomalous ? (zScore > 0 ? "unusually_large" : "unusually_small") : null,
    zScore: Number(zScore.toFixed(2)),
    average: avg,
  };
}

/**
 * Find recent anomalous payments for a workspace (last `lookbackDays`),
 * scoring each payment against that same participant's payments before it.
 * Read-only — safe to call from the insights engine on every dashboard load.
 */
export async function findRecentAnomalies({ ownerType, ownerId, lookbackDays = 30, limit = 5 }) {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const recentPayments = await ContributionPayment.find({
    owner_type: ownerType,
    owner_id: ownerId,
    status: "completed",
    paid_at: { $gte: since },
  })
    .sort({ paid_at: -1 })
    .limit(200)
    .lean();

  if (!recentPayments.length) return [];

  // Group by participant so each payment is compared to that member's own
  // history, not the whole group's.
  const byParticipant = new Map();
  for (const p of recentPayments) {
    const key = String(p.participant_id);
    if (!byParticipant.has(key)) byParticipant.set(key, []);
    byParticipant.get(key).push(p);
  }

  const anomalies = [];
  for (const [, payments] of byParticipant) {
    // oldest -> newest so each payment is only scored against what came before it
    const chronological = [...payments].sort((a, b) => new Date(a.paid_at) - new Date(b.paid_at));
    const history = [];
    for (const payment of chronological) {
      const amount = Number(toDecimal(payment.amount).toString());
      const result = scoreAmount(amount, history);
      if (result.isAnomalous) {
        anomalies.push({
          paymentId: payment._id,
          participantId: payment.participant_id,
          amount,
          average: result.average,
          zScore: result.zScore,
          reason: result.reason,
          paidAt: payment.paid_at,
        });
      }
      history.push(amount);
    }
  }

  anomalies.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
  return anomalies.slice(0, limit);
}

export default { scoreAmount, findRecentAnomalies };