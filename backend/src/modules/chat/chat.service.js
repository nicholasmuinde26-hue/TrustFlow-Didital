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
        new: true,
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
        new: true,
      }

    );

  }

}

export default new ChatService();