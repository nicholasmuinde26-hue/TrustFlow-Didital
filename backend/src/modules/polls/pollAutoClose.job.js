/**
 * Close polls that passed their deadline and notify their workspace.
 * This scheduler belongs to the polls module; the application bootstraps it
 * through the module's public registration.
 */

import { autoCloseExpiredPolls } from './poll.service.js';

const SWEEP_INTERVAL_MS = Number(process.env.POLL_AUTOCLOSE_INTERVAL_MS) || 60_000;
let sweepInProgress = false;

export const sweepExpiredPolls = async () => {
  if (sweepInProgress) return;
  sweepInProgress = true;

  try {
    const closed = await autoCloseExpiredPolls();
    if (closed.length > 0) {
      console.log(`[polls] Auto-closed ${closed.length} expired poll(s).`);
      try {
        const { getIO } = await import('../realtime/index.js');
        const io = getIO();
        for (const poll of closed) {
          io.to(`workspace:${poll.workspace_id}`).emit('poll:closed', {
            pollId: poll._id,
            outcome: poll.result?.outcome,
          });
        }
      } catch {
        // Realtime may not be initialized in scripts or tests.
      }
    }
  } catch (error) {
    console.error('[polls] Auto-close sweep failed:', error.message);
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
