/**
 * ============================================================================
 * USSD SESSION CLEANUP JOB
 * ============================================================================
 * Runs every 2 minutes. Marks USSD sessions with no activity in the last
 * 3 minutes as 'timeout', so the UssdSession audit trail (and any admin
 * dashboards built on it) don't show sessions as perpetually 'active'.
 * Purely housekeeping — never affects routing, since ussd.service.js
 * derives every screen from the AT `text` string, not session state.
 */

import UssdMenuService from "../modules/ussd/ussd.service.js";

const SWEEP_INTERVAL_MS = Number(process.env.USSD_CLEANUP_INTERVAL_MS) || 2 * 60 * 1000;

let sweepInProgress = false;

const sweepExpiredSessions = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const cleaned = await UssdMenuService.cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`[ussd-cleanup] Marked ${cleaned} session(s) as timed out.`);
    }
  } catch (error) {
    console.error("[ussd-cleanup] Sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startUssdSessionCleanupJob = () => {
  console.log(`[ussd-cleanup] USSD session cleanup job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(sweepExpiredSessions, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
