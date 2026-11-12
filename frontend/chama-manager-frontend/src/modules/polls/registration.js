import { Vote } from 'lucide-react';

export const pollsRegistration = Object.freeze({
  key: 'polls',
  routes: Object.freeze([{ path: 'polls' }]),
  workspacePaths: Object.freeze(['polls']),
  navigation: Object.freeze({
    module: 'polls',
    sectionByShell: Object.freeze({ chama: 'ops', burial: 'notices' }),
    title: 'Polls',
    icon: Vote,
    to: 'polls',
  }),
});
