import mgrService from '../modules/mgr/mgr.service.js';

let timer = null;

export async function runMgrRoundLifecycle() {
  return mgrService.advanceDueRounds();
}

export function startMgrRoundLifecycleJob() {
  if (timer) return timer;
  runMgrRoundLifecycle().catch((error) => console.error('[mgr-round-lifecycle] initial run failed', error));
  timer = setInterval(() => {
    runMgrRoundLifecycle().catch((error) => console.error('[mgr-round-lifecycle] run failed', error));
  }, 60 * 1000);
  return timer;
}
