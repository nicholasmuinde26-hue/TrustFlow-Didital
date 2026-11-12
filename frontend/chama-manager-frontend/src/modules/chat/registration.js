import { MessageSquare } from 'lucide-react';

export const chatRegistration = Object.freeze({
  key: 'chat',
  routes: Object.freeze([{ path: 'chat' }]),
  workspacePaths: Object.freeze(['chat']),
  navigation: Object.freeze({
    module: 'chat',
    sectionByShell: Object.freeze({ chama: 'ops', burial: 'notices' }),
    title: 'Messages',
    icon: MessageSquare,
    to: 'chat',
  }),
});
