import ChatPage from './pages/ChatPage';
import { chatRegistration } from './registration';

export { chatRegistration, ChatPage };
export { default as CollaborationLayout } from './layouts/CollaborationLayout.jsx';

const module = Object.freeze({
  ...chatRegistration,
  routes: Object.freeze(chatRegistration.routes.map((route) => ({ ...route, Component: ChatPage }))),
});

export default module;
