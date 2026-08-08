export const SOCKET_EVENTS = {

    CONNECTION: "connection",
    DISCONNECT: "disconnect",

    AUTHENTICATE: "authenticate",

    JOIN_ROOM: "join_room",
    LEAVE_ROOM: "leave_room",

    SEND_MESSAGE: "send_message",
    MESSAGE_CREATED: "message_created",

    EDIT_MESSAGE: "edit_message",
    MESSAGE_UPDATED: "message_updated",

    DELETE_MESSAGE: "delete_message",
    MESSAGE_DELETED: "message_deleted",

    TYPING_START: "typing_start",
    TYPING_STOP: "typing_stop",

    USER_TYPING: "user_typing",

    MESSAGE_READ: "message_read",
    READ_RECEIPT: "read_receipt",

    ADD_REACTION: "add_reaction",
    REMOVE_REACTION: "remove_reaction",

    USER_ONLINE: "user_online",
    USER_OFFLINE: "user_offline"

};

export const ROOM_PREFIX = "workspace:";