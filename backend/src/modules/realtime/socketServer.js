import { Server } from "socket.io";
import notificationService from "../../services/notification.service.js";
import ChamaMembership from "../../models/ChamaMembership.js";
import ContributionGroupMember from "../../models/ContributionGroupMember.js";
import Notification from "../../models/Notification.js";
import User from "../../models/User.js";
import { verifyAccessToken } from "../../utils/jwt.js";


let io;
const connectedUsers = new Map(); // userId -> socketId
const userRooms = new Map(); // userId -> Set of room IDs


export function initSocket(server) {

    io = new Server(server, {

        cors: {
            origin: "*",
            methods: [
                "GET",
                "POST"
            ]
        },
        pingTimeout: 60000,
        pingInterval: 25000

    });


    // Authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Authentication error: No token provided'));
            }

            // Same secret the login flow signs with (JWT_ACCESS_SECRET, falling
            // back to JWT_SECRET). The old code verified with JWT_SECRET and a
            // hard-coded 'your-secret-key' fallback, which rejects valid tokens
            // whenever the two env vars differ.
            const decoded = verifyAccessToken(token);

            const user = await User.findById(decoded.id);
            if (!user) {
                return next(new Error('Authentication error: User not found'));
            }

            socket.userId = user._id.toString();
            socket.user = user;

            next();

        } catch (error) {
            console.error('WebSocket authentication error:', error);
            next(new Error('Authentication error: Invalid token'));
        }
    });


    io.on("connection", (socket) => {

        console.log(
            "🟢 Socket connected:",
            socket.id,
            "User:",
            socket.userId
        );

        // Store connected user
        connectedUsers.set(socket.userId, socket.id);

        // Join user's personal room
        socket.join(`user:${socket.userId}`);

        // Join chama rooms for active memberships
        joinChamaRooms(socket);
        joinContributionGroupRooms(socket);


        // Workspace events (existing functionality)
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


        // Notification events
        socket.on('join:chama', (chamaId) => {
            handleJoinChama(socket, chamaId);
        });

        socket.on('leave:chama', (chamaId) => {
            handleLeaveChama(socket, chamaId);
        });

        socket.on('notification:read', (notificationId) => {
            handleNotificationRead(socket, notificationId);
        });

        socket.on('notification:action', async (data) => {
            await handleNotificationAction(socket, data);
        });


        socket.on(
            "disconnect",
            () => {

                console.log(
                    "🔴 Socket disconnected:",
                    socket.id,
                    "User:",
                    socket.userId
                );

                handleDisconnect(socket);

            }
        );

    });


    return io;

}


// ========================================
// NOTIFICATION-SPECIFIC FUNCTIONS
// ========================================

async function joinChamaRooms(socket) {
    try {
        const memberships = await ChamaMembership.find({
            user_id: socket.userId,
            status: 'active'
        });

        for (const membership of memberships) {
            socket.join(`chama:${membership.chama_id}`);
            socket.join(`chat-chama:${membership.chama_id}`);
            
            if (!userRooms.has(socket.userId)) {
                userRooms.set(socket.userId, new Set());
            }
            userRooms.get(socket.userId).add(`chama:${membership.chama_id}`);
        }

        console.log(`User ${socket.userId} joined ${memberships.length} chama rooms`);

    } catch (error) {
        console.error('Error joining chama rooms:', error);
    }
}

async function joinContributionGroupRooms(socket) {
    try {
        const memberships = await ContributionGroupMember.find({
            user_id: socket.userId,
            status: 'active'
        }).select('contribution_group_id').lean();

        for (const membership of memberships) {
            socket.join(`contribution-group:${membership.contribution_group_id}`);
        }
    } catch (error) {
        console.error('Error joining contribution group rooms:', error);
    }
}

function handleJoinChama(socket, chamaId) {
    socket.join(`chama:${chamaId}`);
    
    if (!userRooms.has(socket.userId)) {
        userRooms.set(socket.userId, new Set());
    }
    userRooms.get(socket.userId).add(`chama:${chamaId}`);

    console.log(`User ${socket.userId} joined chama room: ${chamaId}`);
}

function handleLeaveChama(socket, chamaId) {
    socket.leave(`chama:${chamaId}`);
    
    if (userRooms.has(socket.userId)) {
        userRooms.get(socket.userId).delete(`chama:${chamaId}`);
    }

    console.log(`User ${socket.userId} left chama room: ${chamaId}`);
}

async function handleNotificationRead(socket, notificationId) {
    try {
        // Only the recipient may mark their own notification read.
        const owned = await Notification.exists({
            _id: notificationId,
            recipient_user_id: socket.userId
        });
        if (!owned) {
            return socket.emit('error', { message: 'Notification not found' });
        }
        await notificationService.markAsRead(notificationId);
        await sendUnreadCount(socket);
    } catch (error) {
        console.error('Error marking notification as read:', error);
        socket.emit('error', { message: 'Failed to mark notification as read' });
    }
}

async function handleNotificationAction(socket, data) {
    try {
        const { notificationId, actionTaken, metadata } = data;

        const membership = await ChamaMembership.findOne({
            user_id: socket.userId,
            status: 'active'
        });

        if (!membership) {
            return socket.emit('error', { message: 'No active membership found' });
        }

        await notificationService.markActionCompleted(
            notificationId,
            actionTaken,
            membership._id,
            metadata
        );

        await sendUnreadCount(socket);

    } catch (error) {
        console.error('Error handling notification action:', error);
        socket.emit('error', { message: 'Failed to complete notification action' });
    }
}

function handleDisconnect(socket) {
    connectedUsers.delete(socket.userId);
    userRooms.delete(socket.userId);
}

async function sendUnreadCount(socket) {
    try {
        // Count across ALL of the user's memberships, matching the REST counts.
        const unreadCount = await Notification.countDocuments({
            recipient_user_id: socket.userId,
            state: 'unread',
            deleted_at: null
        });

        socket.emit('notification:count', { unread: unreadCount });

    } catch (error) {
        console.error('Error sending unread count:', error);
    }
}

// ========================================
// PUBLIC API FOR NOTIFICATION SERVICE
// ========================================

export function sendNotificationToUser(userId, notification) {
    const socketId = connectedUsers.get(userId);
    if (socketId) {
        io.to(`user:${userId}`).emit('notification:new', notification);
    }
}

export function sendNotificationToChama(chamaId, notification) {
    io.to(`chama:${chamaId}`).emit('notification:new', notification);
}

export function sendToastToUser(userId, toast) {
    const socketId = connectedUsers.get(userId);
    if (socketId) {
        io.to(`user:${userId}`).emit('toast:new', toast);
    }
}

// Deliver chat events only to authenticated personal rooms. Chat clients then
// refresh their own authorized conversation instead of joining arbitrary rooms.
export function sendChatMessageToUser(userId, message) {
    if (!io || !userId) return;
    io.to(`user:${userId}`).emit('chat:new', message);
}

// Workspace rooms are joined from active membership records at connection time.
// Broadcast the persisted message immediately; notification persistence runs separately.
export function sendChatMessageToWorkspace(workspaceId, workspaceType, message) {
    if (!io || !workspaceId || !message) return;
    const room = workspaceType === 'chama'
        ? `chat-chama:${workspaceId}`
        : `contribution-group:${workspaceId}`;
    const senderRoom = message.sender?.id ? `user:${message.sender.id}` : null;
    const delivery = io.to(room);
    if (senderRoom) delivery.except(senderRoom);
    delivery.emit('chat:new', message);
}

export async function sendRealTimeNotification(notification) {
    try {
        sendNotificationToUser(notification.recipient_user_id.toString(), notification);

        // Do NOT broadcast the notification itself to the whole chama room: it
        // names a specific member and can contain loan or contribution details.
        // Send a content-free ping so other members' screens can refresh if
        // they want to, without seeing anyone else's private message.
        if (notification.category === 'financial' || notification.category === 'governance') {
            io.to(`chama:${notification.chama_id.toString()}`).emit('chama:activity', {
                category: notification.category,
                notification_type: notification.notification_type,
                at: Date.now()
            });
        }

        const socketId = connectedUsers.get(notification.recipient_user_id.toString());
        if (socketId) {
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                await sendUnreadCount(socket);
            }
        }

    } catch (error) {
        console.error('Error sending real-time notification:', error);
    }
}

export function getConnectedUsersCount() {
    return connectedUsers.size;
}

export function isUserConnected(userId) {
    return connectedUsers.has(userId);
}


export function getIO(){

    if(!io){

        throw new Error(
            "Socket.IO not initialized"
        );

    }


    return io;

}
