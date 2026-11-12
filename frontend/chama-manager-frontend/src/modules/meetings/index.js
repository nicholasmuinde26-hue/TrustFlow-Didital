import MeetingsPage from './pages/MeetingsPage';
import { meetingsRegistration } from './registration';

export { meetingsRegistration, MeetingsPage };

const module = Object.freeze({
  ...meetingsRegistration,
  routes: Object.freeze(meetingsRegistration.routes.map((route) => ({ ...route, Component: MeetingsPage }))),
});

export default module;
