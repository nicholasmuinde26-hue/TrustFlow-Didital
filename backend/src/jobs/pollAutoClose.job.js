/**
 * ============================================================================
 * POLL AUTO-CLOSE JOB
 * ============================================================================
 * Runs on an interval. Any open poll whose closes_at deadline has passed
 * gets tallied and closed automatically — so a vote's outcome (e.g. "loan
 * approved", "member expelled") is decided even if no official happens to
 * revisit the poll after the deadline.
 * ============================================================================
 */

import { autoCloseExpiredPolls } from "../modules/polls/poll.service.js";

const SWEEP_INTERVAL_MS = Number(process.env.POLL_AUTOCLOSE_INTERVAL_MS) || 60_000;

let sweepInProgress = false;

export const sweepExpiredPolls = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const closed = await autoCloseExpiredPolls();

    if (closed.length > 0) {
      console.log(`[polls] Auto-closed ${closed.length} expired poll(s).`);

      // Best-effort realtime notification — never let a missing socket
      // server break the sweep itself.
      try {
        const { getIO } = await import("../modules/realtime/socketServer.js");
        const io = getIO();
        for (const poll of closed) {
          io.to(`workspace:${poll.workspace_id}`).emit("poll:closed", {
            pollId: poll._id,
            outcome: poll.result?.outcome,
          });
        }
      } catch {
        // Socket.IO not initialized (e.g. in a script/test run) — ignore.
      }
    }
  } catch (error) {
    console.error("[polls] Auto-close sweep failed:", error.message);
  } finally {
    sweepInProgress = false;
  }
};

export const startPollAutoCloseJob = () => {
  console.log(`[polls] Poll auto-close job started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
  const timer = setInterval(sweepExpiredPolls, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
