import { Megaphone, MessageSquare } from 'lucide-react';

export const announcementsRegistration = Object.freeze({
  key: 'announcements',
  routes: Object.freeze([{ path: 'announcements' }]),
  workspacePaths: Object.freeze(['announcements']),
  navigation: Object.freeze({
    module: 'announcements',
    sectionByShell: Object.freeze({ chama: 'ops', burial: 'notices' }),
    title: 'Announcements',
    iconByShell: Object.freeze({ chama: Megaphone, burial: MessageSquare }),
    to: 'announcements',
  }),
});
