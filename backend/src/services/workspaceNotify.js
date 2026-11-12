import domainEventEmitter from './domainEvent.emitter.js';

// ========================================
// WORKSPACE NOTIFY
// ========================================
//
// One call for "tell the right people about this". Notifications are keyed by
// chama membership, so contribution-group workspaces (a different member model)
// are skipped rather than failing. Never throws: a notification problem must not
// break the request that caused it.
//
// notifyWorkspace('Chama', chamaId, 'POLL_PUBLISHED', {
//   title, message,                       // optional wording overrides
//   recipientMembershipIds / recipientUserIds / targetRoles,  // optional targeting
//   excludeInitiator: true, sentBy: membershipId,
// })
//
export const notifyWorkspace = (workspaceType, workspaceId, eventName, data = {}) => {
  try {
    if (workspaceType && workspaceType !== 'Chama') return false;
    if (!workspaceId) return false;
    domainEventEmitter.emitDomainEvent(eventName, { ...data, chamaId: workspaceId });
    return true;
  } catch (error) {
    console.error(`notifyWorkspace(${eventName}) failed:`, error.message);
    return false;
  }
};

export const formatEventDate = (value) => {
  try {
    return new Date(value).toLocaleString('en-KE', {
      timeZone: 'Africa/Nairobi',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  } catch {
    return String(value);
  }
};

export default { notifyWorkspace, formatEventDate };
