import routes from './poll.routes.js';
import { startPollAutoCloseJob } from './pollAutoClose.job.js';

export { routes, startPollAutoCloseJob };
export { autoCloseExpiredPolls } from './poll.service.js';

const registration = Object.freeze({
  key: 'polls',
  routes: Object.freeze([{ mountPath: '/api/v1/workspaces', router: routes }]),
  jobs: Object.freeze([startPollAutoCloseJob]),
});

export default registration;
