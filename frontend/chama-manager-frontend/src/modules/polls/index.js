import PollsPage from './pages/PollsPage';
import { pollsRegistration } from './registration';

export { pollsRegistration, PollsPage };
export { default as pollsApi } from './api/polls.api';
export { usePolls } from './hooks/usePolls';

const module = Object.freeze({
  ...pollsRegistration,
  routes: Object.freeze(pollsRegistration.routes.map((route) => ({ ...route, Component: PollsPage }))),
});

export default module;
