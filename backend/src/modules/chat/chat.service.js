import ChatMessage from "../../models/ChatMessage.js";

class ChatService {

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  async sendMessage(data) {

    const message = await ChatMessage.create(data);

    return message.populate(
      "sender_id",
      "name phone avatar"
    );

  }

  // ==========================================================
  // SEND DIRECT MESSAGE
  // ==========================================================

  async sendDirectMessage(data) {

    const message = await ChatMessage.create({
      ...data,
      conversation_type: "direct",
    });

    return message.populate(
      "sender_id",
      "name phone avatar"
    );

  }

  // ==========================================================
  // GET DIRECT MESSAGES (thread between two users, paginated)
  // ==========================================================

  async getDirectMessages(
    userAId,
    userBId,
    {
      limit = 50,
      before,
    } = {}
  ) {

    const [a, b] = [String(userAId), String(userBId)].sort();
    const query = {
      conversation_type: "direct",
      thread_key: `${a}_${b}`,
      deleted_at: null,
    };

    if (before) {
      query.createdAt = {
        $lt: new Date(before),
      };
    }

    return ChatMessage.find(query)
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .populate(
        "sender_id",
        "name phone avatar"
      );

  }

  async getDirectConversations(userId) {
    return ChatMessage.aggregate([
      {
        $match: {
          conversation_type: "direct",
          deleted_at: null,
          thread_key: { $exists: true, $ne: null },
          $or: [{ sender_id: userId }, { recipient_id: userId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$thread_key",
          latest: { $first: "$$ROOT" },
        },
      },
      {
        $project: {
          latest: 1,
          partnerId: {
            $cond: [
              { $eq: ["$latest.sender_id", userId] },
              "$latest.recipient_id",
              "$latest.sender_id",
            ],
          },
        },
      },
      { $sort: { "latest.createdAt": -1 } },
      { $limit: 100 },
    ]);
  }

  async getUnreadConversationCounts(userId, workspaceId, workspaceType, activeMemberIds) {
    const [workspaceUnread, directUnread] = await Promise.all([
      ChatMessage.countDocuments({
        conversation_type: "workspace",
        workspace_id: workspaceId,
        workspace_type: workspaceType,
        sender_id: { $ne: userId },
        read_by: { $exists: true, $ne: userId },
        deleted_at: null,
      }),
      ChatMessage.aggregate([
        {
          $match: {
            conversation_type: "direct",
            recipient_id: userId,
            sender_id: { $in: activeMemberIds.filter((id) => String(id) !== String(userId)) },
            read_by: { $exists: true, $ne: userId },
            deleted_at: null,
          },
        },
        { $group: { _id: "$sender_id", count: { $sum: 1 } } },
      ]),
    ]);

    return {
      workspace: workspaceUnread,
      direct: directUnread.map((item) => ({ userId: String(item._id), count: item.count })),
    };
  }

  async markConversationRead({ userId, workspaceId, workspaceType, recipientUserId = null }) {
    const query = {
      deleted_at: null,
      sender_id: { $ne: userId },
      read_by: { $ne: userId },
    };

    if (recipientUserId) {
      const [sender, recipient] = [String(userId), String(recipientUserId)].sort();
      Object.assign(query, {
        conversation_type: "direct",
        thread_key: `${sender}_${recipient}`,
        recipient_id: userId,
      });
    } else {
      Object.assign(query, {
        conversation_type: "workspace",
        workspace_id: workspaceId,
        workspace_type: workspaceType,
      });
    }

    return ChatMessage.updateMany(query, { $addToSet: { read_by: userId } });
  }

  // ==========================================================
  // GET MESSAGES (Pagination)
  // ==========================================================

  async getMessages(
    workspaceId,
    {
      limit = 50,
      before,
    } = {}
  ) {

    const query = {
      workspace_id: workspaceId,
      deleted_at: null,
    };

    if (before) {
      query.createdAt = {
        $lt: new Date(before),
      };
    }

    return ChatMessage.find(query)
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .populate(
        "sender_id",
        "name phone avatar"
      );

  }

  // ==========================================================
  // SEARCH MESSAGES
  // ==========================================================

  async searchMessages(
    workspaceId,
    text
  ) {

    return ChatMessage.find({

      workspace_id: workspaceId,

      deleted_at: null,

      message: {
        $regex: text,
        $options: "i",
      },

    }).populate(
      "sender_id",
      "name phone avatar"
    );

  }

  // ==========================================================
  // EDIT MESSAGE
  // ==========================================================

  async editMessage(
    messageId,
    text
  ) {

    return ChatMessage.findByIdAndUpdate(

      messageId,

      {
        message: text,
        edited_at: new Date(),
      },

      {
        returnDocument: 'after',
      }

    ).populate(
      "sender_id",
      "name phone avatar"
    );

  }

  // ==========================================================
  // DELETE MESSAGE
  // ==========================================================

  async deleteMessage(messageId) {

    return ChatMessage.findByIdAndUpdate(

      messageId,

      {
        deleted_at: new Date(),
      },

      {
        returnDocument: 'after',
      }

    );

  }

}

export default new ChatService();
