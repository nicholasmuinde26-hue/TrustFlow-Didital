import ChatService from "../modules/chat/chat.service.js";
import { validateMessage } from "../modules/chat/chat.validation.js";
import { toChatDTO } from "../modules/chat/chat.mapper.js";

export default function registerSocketEvents(
  io,
  socket
) {

  socket.on(
    "chat:send",
    async (
      payload,
      callback
    ) => {

      try {

        validateMessage(payload);

        const message =
          await ChatService.sendMessage({

            ...payload,

            sender_id:
              socket.user.id,

          });

        const dto =
          toChatDTO(message);

        io.to(
          payload.workspace_id
        ).emit(
          "chat:new",
          dto
        );

        callback?.({

          success: true,

          message: dto,

        });

      } catch (err) {

        callback?.({

          success: false,

          error: err.message,

        });

      }

    }
  );

}