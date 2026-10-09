import Chama from '../models/Chama.js';
import { runCalendarForChama } from '../modules/contributionPlan/contributioncalendar.service.js';

let running = false;

async function execute() {
  if (running) return;
  running = true;
  try {
    const chamas = await Chama.find({ status: 'active' }).select('_id');
    for (const chama of chamas) {
      try {
        await runCalendarForChama({ chamaId: chama._id });
      } catch (err) {
        console.error(`[ContributionCalendarJob] Failed for chama ${chama._id}:`, err);
      }
    }
  } catch (error) {
    console.error('[ContributionCalendarJob] Error fetching chamas:', error);
  } finally {
    running = false;
  }
}

export const startContributionCalendarJob = () => {
  // Run on startup
  execute();
  // Then every hour (3600000ms)
  setInterval(execute, 3600000);
};
