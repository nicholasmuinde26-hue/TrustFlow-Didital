import { Server } from "socket.io";


let io;


export function initSocket(server) {

    io = new Server(server, {

        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST"
            ]
        }

    });


    io.on("connection", (socket) => {

        console.log(
            "🟢 Socket connected:",
            socket.id
        );


        socket.on(
            "join_workspace",
            (workspaceId) => {

                socket.join(
                    `workspace:${workspaceId}`
                );

                console.log(
                    `Joined workspace ${workspaceId}`
                );

            }
        );


        socket.on(
            "send_message",
            (message) => {

                io.to(
                    `workspace:${message.workspace_id}`
                )
                .emit(
                    "new_message",
                    message
                );

            }
        );


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔴 Socket disconnected:",
                    socket.id
                );

            }
        );

    });


    return io;

}



export function getIO(){

    if(!io){

        throw new Error(
            "Socket.IO not initialized"
        );

    }


    return io;

}