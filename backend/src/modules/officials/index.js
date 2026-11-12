import routes from './Officialrating.routes.js';

export { listRatingsForOfficials } from './Officialrating.service.js';
export { routes };

const registration = Object.freeze({
  key: 'officials',
  routes: Object.freeze([{ mountPath: '/api/v1/chamas', router: routes }]),
  jobs: Object.freeze([]),
});

export default registration;
