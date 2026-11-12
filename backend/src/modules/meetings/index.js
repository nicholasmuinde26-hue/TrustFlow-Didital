export { default as meetingRoutes } from './meetings.routes.js';
export { listUpcomingMeetings, findNextMeeting } from './meeting.service.js';
import routes from './meetings.routes.js';

const registration = Object.freeze({
  key: 'meetings',
  routes: Object.freeze([{ mountPath: '/api/v1/workspaces', router: routes }]),
  jobs: Object.freeze([]),
});

export default registration;
