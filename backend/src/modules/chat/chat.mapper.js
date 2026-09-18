export function toChatDTO(message) {

  return {

    id: message._id,

    conversation_type:
      message.conversation_type || "workspace",

    workspace_id: message.workspace_id,

    workspace_type:
      message.workspace_type,

    recipient: message.recipient_id
      ? {
          id: message.recipient_id?._id || message.recipient_id,
          name: message.recipient_id?.name,
          avatar: message.recipient_id?.avatar,
        }
      : null,

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