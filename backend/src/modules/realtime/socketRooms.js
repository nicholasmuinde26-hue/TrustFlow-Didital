import { ROOM_PREFIX } from "./socket.constants.js";

export function workspaceRoom(workspaceId){

    return `${ROOM_PREFIX}${workspaceId}`;

}

export function joinWorkspace(socket, workspaceId){

    socket.join(
        workspaceRoom(workspaceId)
    );

}

export function leaveWorkspace(socket, workspaceId){

    socket.leave(
        workspaceRoom(workspaceId)
    );

}