import { WebSocketServer } from 'ws';
import { authenticateWebSocket } from '../middleware/auth.js';
import { messageService } from '../services/messageService.js';
import { cacheService } from '../config/redis.js';
import { query } from '../config/postgres.js';

const clients = new Map(); // Map of userId -> WebSocket connection
const channelSubscriptions = new Map(); // Map of channelId -> Set of userIds

export const setupWebSocket = (server) => {
    const wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', async (ws, req) => {
        let userId = null;
        let userName = null;

        console.log('WebSocket connection attempt');

        // Handle messages from client
        ws.on('message', async (data) => {
            try {
                const message = JSON.parse(data.toString());

                // Authentication
                if (message.type === 'auth') {
                    const authResult = authenticateWebSocket(message.token);

                    if (!authResult.success) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
                        ws.close();
                        return;
                    }

                    userId = authResult.user.userId;
                    userName = authResult.user.name;
                    clients.set(userId, ws);

                    // Mark user as online
                    await cacheService.sadd('online_users', userId);

                    ws.send(JSON.stringify({ type: 'auth_success', userId }));

                    // Broadcast user online status
                    broadcast({ type: 'user_online', userId, userName });

                    console.log(`User ${userName} (${userId}) authenticated`);
                    return;
                }

                // All other messages require authentication
                if (!userId) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
                    return;
                }

                // Join channel
                if (message.type === 'join_channel') {
                    const { channelId } = message;

                    // Verify user is member of channel
                    const memberCheck = await query(
                        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
                        [channelId, userId]
                    );

                    if (memberCheck.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                        return;
                    }

                    // Add to subscriptions
                    if (!channelSubscriptions.has(channelId)) {
                        channelSubscriptions.set(channelId, new Set());
                    }
                    channelSubscriptions.get(channelId).add(userId);

                    ws.send(JSON.stringify({ type: 'joined_channel', channelId }));
                    console.log(`User ${userId} joined channel ${channelId}`);
                }

                // Leave channel
                if (message.type === 'leave_channel') {
                    const { channelId } = message;

                    if (channelSubscriptions.has(channelId)) {
                        channelSubscriptions.get(channelId).delete(userId);
                    }

                    ws.send(JSON.stringify({ type: 'left_channel', channelId }));
                    console.log(`User ${userId} left channel ${channelId}`);
                }

                // Send message
                if (message.type === 'send_message') {
                    const { channelId, messageText, fileId } = message;

                    // Verify user is member of channel
                    const memberCheck = await query(
                        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
                        [channelId, userId]
                    );

                    if (memberCheck.rows.length === 0) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Access denied' }));
                        return;
                    }

                    // Save message
                    const newMessage = await messageService.sendMessage(
                        channelId,
                        userId,
                        messageText,
                        fileId || null
                    );

                    // Broadcast to all users subscribed to this channel
                    broadcastToChannel(channelId, {
                        type: 'new_message',
                        message: newMessage,
                    });

                    console.log(`Message sent to channel ${channelId} by user ${userId}`);
                }

                // Typing indicator
                if (message.type === 'typing_start') {
                    const { channelId } = message;

                    broadcastToChannel(channelId, {
                        type: 'user_typing',
                        channelId,
                        userId,
                        userName,
                    }, userId); // Exclude sender
                }

                if (message.type === 'typing_stop') {
                    const { channelId } = message;

                    broadcastToChannel(channelId, {
                        type: 'user_stopped_typing',
                        channelId,
                        userId,
                    }, userId); // Exclude sender
                }

            } catch (error) {
                console.error('WebSocket message error:', error);
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
            }
        });

        // Handle disconnection
        ws.on('close', async () => {
            if (userId) {
                clients.delete(userId);

                // Remove from all channel subscriptions
                for (const [channelId, subscribers] of channelSubscriptions.entries()) {
                    subscribers.delete(userId);
                }

                // Mark user as offline
                await cacheService.srem('online_users', userId);

                // Broadcast user offline status
                broadcast({ type: 'user_offline', userId });

                console.log(`User ${userId} disconnected`);
            }
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    // Broadcast to all connected clients
    const broadcast = (message) => {
        const data = JSON.stringify(message);
        for (const client of clients.values()) {
            if (client.readyState === 1) { // OPEN
                client.send(data);
            }
        }
    };

    // Broadcast to users subscribed to a specific channel
    const broadcastToChannel = (channelId, message, excludeUserId = null) => {
        const subscribers = channelSubscriptions.get(channelId);
        if (!subscribers) return;

        const data = JSON.stringify(message);
        for (const subscriberId of subscribers) {
            if (subscriberId === excludeUserId) continue;

            const client = clients.get(subscriberId);
            if (client && client.readyState === 1) { // OPEN
                client.send(data);
            }
        }
    };

    console.log('✓ WebSocket server initialized');
};
