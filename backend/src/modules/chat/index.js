export { default as chatRoutes } from './chat.routes.js';
export { canAccessWorkspace, canDirectMessage } from './chat.permissions.js';
import routes from './chat.routes.js';

const registration = Object.freeze({
  key: 'chat',
  routes: Object.freeze([{ mountPath: '/api/v1/chat', router: routes }]),
  jobs: Object.freeze([]),
});

export default registration;
