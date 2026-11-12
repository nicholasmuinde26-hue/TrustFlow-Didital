import { CalendarClock, Video } from 'lucide-react';

export const meetingsRegistration = Object.freeze({
  key: 'meetings',
  routes: Object.freeze([{ path: 'meetings' }]),
  workspacePaths: Object.freeze(['meetings']),
  navigation: Object.freeze({
    module: 'meetings',
    sectionByShell: Object.freeze({ chama: 'ops', burial: 'notices' }),
    title: 'Meeting Records',
    iconByShell: Object.freeze({ chama: CalendarClock, burial: Video }),
    to: 'meetings',
  }),
});
