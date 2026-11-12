// Public interface for application boot and feature modules that need
// realtime delivery. Consumers must not import socketServer internals.
export {
  initSocket,
  sendNotificationToUser,
  sendNotificationToChama,
  sendToastToUser,
  sendChatMessageToUser,
  sendChatMessageToWorkspace,
  sendRealTimeNotification,
  getConnectedUsersCount,
  isUserConnected,
  getIO,
} from './socketServer.js';
