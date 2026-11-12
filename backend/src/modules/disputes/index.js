import routes from './Dispute.routes.js';

export { countUnresolvedDisputes, listDisputeStatusesSince } from './dispute.service.js';
export { routes };

const registration = Object.freeze({
  key: 'disputes',
  routes: Object.freeze([{ mountPath: '/api/v1/chamas', router: routes }]),
  jobs: Object.freeze([]),
});

export default registration;
