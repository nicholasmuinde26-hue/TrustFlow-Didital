import jwt from "../utils/jwt.js";

import User from "../models/User.js";

export default async function socketAuth(socket,next){

    try{

        const token =
            socket.handshake.auth?.token;

        if(!token){

            return next(
                new Error("Authentication required")
            );

        }

        const payload =
            jwt.verifyToken(token);

        const user =
            await User.findById(
                payload.id
            );

        if(!user){

            return next(
                new Error("Invalid user")
            );

        }

        socket.user = user;

        next();

    }

    catch(err){

        next(err);

    }

}