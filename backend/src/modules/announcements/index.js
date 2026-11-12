import routes from './announcement.routes.js';
export { listLatestApprovedForWorkspaces, listLatestApprovedForWorkspace } from './announcement.service.js';

export { routes };

const registration = Object.freeze({
  key: 'announcements',
  routes: Object.freeze([{ mountPath: '/api/v1/workspaces', router: routes }]),
  jobs: Object.freeze([]),
});

export default registration;
