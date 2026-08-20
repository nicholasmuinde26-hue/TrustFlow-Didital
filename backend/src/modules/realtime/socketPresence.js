const onlineUsers = new Map();

export function addUser(userId, socketId){

    onlineUsers.set(
        userId.toString(),
        socketId
    );

}

export function removeUser(userId){

    onlineUsers.delete(
        userId.toString()
    );

}

export function getSocket(userId){

    return onlineUsers.get(
        userId.toString()
    );

}

export function isOnline(userId){

    return onlineUsers.has(
        userId.toString()
    );

}

export function getOnlineUsers(){

    return [...onlineUsers.keys()];

}