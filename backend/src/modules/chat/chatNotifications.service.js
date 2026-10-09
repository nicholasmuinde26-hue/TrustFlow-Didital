import ChamaMembership from '../../models/ChamaMembership.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import notificationPreferenceService from '../../services/notificationPreference.service.js';
import notificationService from '../../services/notification.service.js';
import { sendChatMessageToUser, sendToastToUser } from '../realtime/socketServer.js';

const idOf = (value) => String(value?._id || value || '');
const previewOf = (message = '') => {
  const clean = String(message).trim();
  return clean.length > 140 ? `${clean.slice(0, 137)}…` : clean;
};

async function sendPreferenceAwareToast(userId, payload) {
  const channels = await notificationPreferenceService.getEnabledChannels(userId, 'system');
  if (channels.includes('toast')) sendToastToUser(idOf(userId), payload);
}

async function sendPersistentNotice({ membership, workspaceId, title, message, actionUrl, metadata }) {
  if (!membership) return null;
  return notificationService.createNotification({
    chamaId: workspaceId,
    recipientMembershipId: membership._id,
    notificationType: 'CHAT_MESSAGE_RECEIVED',
    title,
    message,
    metadata,
    relatedEntityType: 'ChatMessage',
    relatedEntityId: metadata.chatMessageId,
    actionUrl,
    actionText: 'Open chat'
  });
}

async function notifyWorkspaceMessage(message, workspaceName) {
  const senderId = idOf(message.sender_id);
  const workspaceId = idOf(message.workspace_id);
  const senderName = message.sender_id?.name || 'A member';
  const preview = previewOf(message.message) || 'Sent an attachment';
  const title = `New message in ${workspaceName || 'your group'}`;
  const actionUrl = `/workspace/${workspaceId}/chat`;
  const recipients = message.workspace_type === 'chama'
    ? await ChamaMembership.find({ chama_id: workspaceId, status: 'active', user_id: { $ne: senderId } })
        .select('_id user_id role').lean()
    : await ContributionGroupMember.find({ contribution_group_id: workspaceId, status: 'active', user_id: { $ne: senderId } })
        .select('user_id').lean();

  await Promise.all(recipients.map(async (recipient) => {
    const notice = {
      id: `chat:${idOf(message._id)}:${idOf(recipient.user_id)}`,
      notification_type: 'CHAT_MESSAGE_RECEIVED',
      category: 'system',
      icon: '💬',
      title,
      message: `${senderName}: ${preview}`,
      action_url: actionUrl,
      action_text: 'Open chat',
      recipient_user_id: idOf(recipient.user_id),
      state: 'unread',
      priority: 'normal',
      createdAt: message.createdAt || new Date()
    };

    try {
      if (message.workspace_type === 'chama') {
        await sendPersistentNotice({
          membership: recipient,
          workspaceId,
          title,
          message: `${senderName}: ${preview}`,
          actionUrl,
          metadata: { chatMessageId: idOf(message._id), senderId, workspaceType: 'chama' }
        });
      } else {
        await sendPreferenceAwareToast(recipient.user_id, { ...notice, notification: notice });
      }
    } catch (error) {
      console.error('Failed to deliver workspace chat notification:', error.message);
    }
  }));
}

async function sharedChamaMembership(senderId, recipientId) {
  const senderMemberships = await ChamaMembership.find({ user_id: senderId, status: 'active' })
    .select('chama_id').lean();
  if (!senderMemberships.length) return null;
  return ChamaMembership.findOne({
    user_id: recipientId,
    status: 'active',
    chama_id: { $in: senderMemberships.map((membership) => membership.chama_id) }
  }).select('_id user_id chama_id role').lean();
}

async function sharedContributionGroupId(senderId, recipientId) {
  const senderGroups = await ContributionGroupMember.find({ user_id: senderId, status: 'active' })
    .select('contribution_group_id').lean();
  if (!senderGroups.length) return null;
  const membership = await ContributionGroupMember.findOne({
    user_id: recipientId,
    status: 'active',
    contribution_group_id: { $in: senderGroups.map((item) => item.contribution_group_id) }
  }).select('contribution_group_id').lean();
  return membership?.contribution_group_id || null;
}

async function notifyDirectMessage(message, recipientId, recipientName) {
  const senderId = idOf(message.sender_id);
  const recipient = idOf(recipientId);
  const senderName = message.sender_id?.name || 'A member';
  const title = `New message from ${senderName}`;
  const preview = previewOf(message.message) || 'Sent an attachment';

  // Make the active chat update immediately even if notification storage is
  // temporarily unavailable. The conversation endpoint remains the source of
  // truth and the client invalidates its cached thread on this event.
  sendChatMessageToUser(recipient, {
    id: idOf(message._id),
    conversation_type: 'direct',
    sender: { id: senderId, name: senderName },
    recipient: { id: recipient, name: recipientName },
    message: preview,
    attachments: message.attachments || [],
    created_at: message.createdAt
  });

  const membership = await sharedChamaMembership(senderId, recipient);

  if (membership) {
    const actionUrl = `/workspace/${idOf(membership.chama_id)}/chat?direct=${senderId}`;
    try {
      await sendPersistentNotice({
        membership,
        workspaceId: membership.chama_id,
        title,
        message: preview,
        actionUrl,
        metadata: { chatMessageId: idOf(message._id), senderId, direct: true }
      });
    } catch (error) {
      console.error('Failed to deliver direct chat notification:', error.message);
    }
  } else {
    const groupId = await sharedContributionGroupId(senderId, recipient);
    const notice = {
      id: `chat:${idOf(message._id)}:${recipient}`,
      notification_type: 'CHAT_MESSAGE_RECEIVED',
      category: 'system',
      icon: '💬',
      title,
      message: preview,
      action_url: groupId ? `/workspace/${idOf(groupId)}/chat?direct=${senderId}` : null,
      action_text: 'Open chat',
      recipient_user_id: recipient,
      state: 'unread',
      priority: 'normal',
      createdAt: message.createdAt || new Date()
    };
    try {
      await sendPreferenceAwareToast(recipient, { ...notice, notification: notice });
    } catch (error) {
      console.error('Failed to deliver direct chat toast:', error.message);
    }
  }

}

export { notifyWorkspaceMessage, notifyDirectMessage };
