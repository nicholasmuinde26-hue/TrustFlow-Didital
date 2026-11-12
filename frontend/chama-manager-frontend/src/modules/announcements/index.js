import AnnouncementsPage from './pages/AnnouncementsPage';
import { announcementsRegistration } from './registration';

export { announcementsRegistration, AnnouncementsPage };
export { default as announcementsApi } from './api/announcements.api';
export { useAnnouncements } from './hooks/useAnnouncements';

const module = Object.freeze({
  ...announcementsRegistration,
  routes: Object.freeze(announcementsRegistration.routes.map((route) => ({ ...route, Component: AnnouncementsPage }))),
});

export default module;
