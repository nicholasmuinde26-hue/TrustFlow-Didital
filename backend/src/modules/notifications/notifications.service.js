import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import ChamaMembership from '../../models/ChamaMembership.js';
import ChamaInvitation from '../../models/ChamaInvitation.js';
import ContributionGroupInvitation from '../../models/ContributionGroupInvitation.js';
import ContributionGroupMember from '../../models/ContributionGroupMember.js';
import Announcement from '../../models/Announcement.js';
import ChamaLoan from '../../models/ChamaLoan.js';
import Payout from '../../models/Payout.js';
import ChamaMemberKyc from '../../models/ChamaMemberKyc.js';
import FinancialTransaction from '../../models/FinancialTransaction.js';
import ContributionPayment from '../../models/ContributionPayment.js';
import AppError from '../../utils/AppError.js';

const MANAGER_ROLES = ['admin', 'treasurer', 'secretary', 'chairperson'];

/**
 * Syncs/aggregates live notifications from real system events for the given user
 */
export const syncLiveUserNotifications = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  // 1. Pending Chama Invitations
  if (user.phone) {
    const chamaInvites = await ChamaInvitation.find({
      invitee_phone: user.phone,
      status: 'pending',
    }).populate('chama_id', 'name');

    for (const invite of chamaInvites) {
      const chamaName = invite.chama_id?.name || 'a Chama';
      const existing = await Notification.findOne({
        user_id: userId,
        'metadata.type': 'chama_invitation',
        'metadata.invitation_id': invite._id,
      });

      if (!existing) {
        await Notification.create({
          user_id: userId,
          title: 'Chama Invitation',
          message: `You have been invited to join ${chamaName} as ${invite.role || 'a member'}.`,
          category: 'invitation',
          link: '/invitations',
          metadata: {
            type: 'chama_invitation',
            invitation_id: invite._id,
          },
        });
      }
    }

    // 2. Pending Contribution Group Invitations
    const groupInvites = await ContributionGroupInvitation.find({
      invitee_phone: user.phone,
      status: 'pending',
    }).populate('group_id', 'name');

    for (const invite of groupInvites) {
      const groupName = invite.group_id?.name || 'a Savings Group';
      const existing = await Notification.findOne({
        user_id: userId,
        'metadata.type': 'group_invitation',
        'metadata.invitation_id': invite._id,
      });

      if (!existing) {
        await Notification.create({
          user_id: userId,
          title: 'Contribution Group Invitation',
          message: `You have been invited to join ${groupName}.`,
          category: 'invitation',
          link: '/invitations',
          metadata: {
            type: 'group_invitation',
            invitation_id: invite._id,
          },
        });
      }
    }
  }

  // Find user's active chama memberships
  const memberships = await ChamaMembership.find({ user_id: userId, status: 'active' });
  const chamaIds = memberships.map((m) => m.chama_id);

  if (chamaIds.length > 0) {
    // 3. Pending Approvals for Managers (loans, payouts, member KYC)
    const isManagerOrAdmin = memberships.some((m) => MANAGER_ROLES.includes(m.role));
    if (isManagerOrAdmin) {
      const pendingLoans = await ChamaLoan.find({
        chama_id: { $in: chamaIds },
        status: 'pending',
      }).limit(5);

      for (const loan of pendingLoans) {
        const existing = await Notification.findOne({
          user_id: userId,
          'metadata.type': 'loan_approval',
          'metadata.loan_id': loan._id,
        });

        if (!existing) {
          await Notification.create({
            user_id: userId,
            title: 'Loan Approval Required',
            message: `A loan request of KES ${Number(loan.principal_amount || loan.amount || 0).toLocaleString()} requires review.`,
            category: 'approval',
            link: `/workspace/${loan.chama_id}/loans`,
            metadata: {
              type: 'loan_approval',
              loan_id: loan._id,
            },
          });
        }
      }

      const pendingPayouts = await Payout.find({
        chama_id: { $in: chamaIds },
        status: 'pending',
      }).limit(5);

      for (const payout of pendingPayouts) {
        const existing = await Notification.findOne({
          user_id: userId,
          'metadata.type': 'payout_approval',
          'metadata.payout_id': payout._id,
        });

        if (!existing) {
          await Notification.create({
            user_id: userId,
            title: 'Payout Approval Required',
            message: `A payout of KES ${Number(payout.amount || 0).toLocaleString()} is awaiting your approval.`,
            category: 'approval',
            link: `/workspace/${payout.chama_id}/finance/payouts`,
            metadata: {
              type: 'payout_approval',
              payout_id: payout._id,
            },
          });
        }
      }

      const pendingKyc = await ChamaMemberKyc.find({
        chama_id: { $in: chamaIds },
        status: 'pending',
      }).limit(5);

      for (const kyc of pendingKyc) {
        const existing = await Notification.findOne({
          user_id: userId,
          'metadata.type': 'kyc_approval',
          'metadata.kyc_id': kyc._id,
        });

        if (!existing) {
          await Notification.create({
            user_id: userId,
            title: 'Member KYC Review Required',
            message: 'A member has submitted KYC documents that need review.',
            category: 'approval',
            link: `/workspace/${kyc.chama_id}/members`,
            metadata: {
              type: 'kyc_approval',
              kyc_id: kyc._id,
            },
          });
        }
      }
    }

    // 4. Latest Workspace Announcements
    const announcements = await Announcement.find({
      chamaId: { $in: chamaIds },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    for (const ann of announcements) {
      const existing = await Notification.findOne({
        user_id: userId,
        'metadata.type': 'announcement',
        'metadata.announcement_id': ann._id,
      });

      if (!existing) {
        await Notification.create({
          user_id: userId,
          title: ann.title || 'Workspace Announcement',
          message: ann.content || ann.message || 'New announcement posted.',
          category: 'announcement',
          link: `/workspace/${ann.chamaId}`,
          metadata: {
            type: 'announcement',
            announcement_id: ann._id,
          },
        });
      }
    }

    // 5. Recent Financial Transactions
    const recentTxns = await FinancialTransaction.find({
      chama_id: { $in: chamaIds },
    })
      .sort({ createdAt: -1 })
      .limit(5);

    for (const txn of recentTxns) {
      const existing = await Notification.findOne({
        user_id: userId,
        'metadata.type': 'transaction',
        'metadata.transaction_id': txn._id,
      });

      if (!existing) {
        await Notification.create({
          user_id: userId,
          title: `Transaction: ${txn.type || 'Payment'}`,
          message: `${txn.description || 'Financial transaction recorded'}: KES ${Number(txn.amount || 0).toLocaleString()}`,
          category: 'transaction',
          link: `/workspace/${txn.chama_id}`,
          metadata: {
            type: 'transaction',
            transaction_id: txn._id,
          },
        });
      }
    }
  }
};

/**
 * Create "new message" notifications for every other active member of a
 * chat's workspace when a chat message is sent.
 */
export const notifyNewChatMessage = async (chatMessage, workspaceName) => {
  const { workspace_id: workspaceId, workspace_type: workspaceType, sender_id: sender } = chatMessage;

  let recipientUserIds = [];

  if (workspaceType === 'chama') {
    const members = await ChamaMembership.find({
      chama_id: workspaceId,
      status: 'active',
      user_id: { $ne: sender?._id || sender },
    }).select('user_id');
    recipientUserIds = members.map((m) => m.user_id);
  } else if (workspaceType === 'contribution-group') {
    const members = await ContributionGroupMember.find({
      contribution_group_id: workspaceId,
      status: 'active',
      user_id: { $ne: sender?._id || sender },
    }).select('user_id');
    recipientUserIds = members.map((m) => m.user_id);
  }

  if (recipientUserIds.length === 0) return;

  const senderName = sender?.name || 'Someone';
  const preview =
    chatMessage.message?.length > 120 ? `${chatMessage.message.slice(0, 117)}...` : chatMessage.message || 'Sent an attachment';
  const link = `/workspace/${workspaceId}/chat`;

  await Notification.insertMany(
    recipientUserIds.map((userId) => ({
      user_id: userId,
      title: `New message${workspaceName ? ` in ${workspaceName}` : ''}`,
      message: `${senderName}: ${preview}`,
      category: 'message',
      link,
      metadata: {
        type: 'chat_message',
        message_id: chatMessage._id,
        workspace_id: workspaceId,
      },
    }))
  );
};

/**
 * Get user notifications feed
 */
export const getUserNotifications = async (userId, { category, unreadOnly, page = 1, limit = 20 } = {}) => {
  // Sync latest system events into notifications
  await syncLiveUserNotifications(userId);

  const query = { user_id: userId };

  if (category && category !== 'all') {
    query.category = category;
  }

  if (unreadOnly === 'true' || unreadOnly === true) {
    query.isRead = false;
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const unreadCount = await Notification.countDocuments({ user_id: userId, isRead: false });
  const totalCount = await Notification.countDocuments(query);

  return {
    notifications,
    unreadCount,
    totalCount,
    page: Number(page),
    limit: Number(limit),
  };
};

/**
 * Mark a single notification as read
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOne({ _id: notificationId, user_id: userId });

  if (!notification) {
    throw new AppError('Notification not found', 404);
  }

  notification.isRead = true;
  notification.readAt = new Date();
  await notification.save();

  const unreadCount = await Notification.countDocuments({ user_id: userId, isRead: false });

  return { notification, unreadCount };
};

/**
 * Mark all notifications as read for a user
 */
export const markAllNotificationsAsRead = async (userId) => {
  await Notification.updateMany(
    { user_id: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return { success: true, unreadCount: 0 };
};

export default {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  syncLiveUserNotifications,
  notifyNewChatMessage,
};