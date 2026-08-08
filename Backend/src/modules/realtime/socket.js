import { Server } from "socket.io";

import socketAuth from "./socketAuth.js";

import registerSocketEvents from "./socketEvents.js";

export default function createSocket(server){

    const io = new Server(server,{

        cors:{

            origin:"*",

            credentials:true

        }

    });

    io.use(socketAuth);

    io.on("connection",socket=>{

        registerSocketEvents(

            io,

            socket

        );

    });

    return io;

}