export function toChatDTO(message) {

  return {

    id: message._id,

    workspace_id: message.workspace_id,

    workspace_type:
      message.workspace_type,

    type: message.type,

    message: message.message,

    sender: {

      id: message.sender_id?._id,

      name: message.sender_id?.name,

      avatar:
        message.sender_id?.avatar,

    },

    attachments:
      message.attachments,

    edited:
      !!message.edited_at,

    created_at:
      message.createdAt,

  };

}