import cassandraClient, { isCassandraConnected } from '../config/cassandra.js';
import { cacheService } from '../config/redis.js';
import { opensearchService } from '../config/opensearch.js';
import { query } from '../config/postgres.js';
import { v4 as uuidv4 } from 'uuid';

const CACHE_PREFIX = 'channel:messages:';
const CACHE_LIMIT = 50; // Number of recent messages to cache

export const messageService = {
    // Send a new message
    sendMessage: async (channelId, userId, messageText, fileId = null) => {
        // Check if Cassandra is available
        if (!isCassandraConnected()) {
            throw new Error('Message storage is temporarily unavailable. Please try again later.');
        }

        const messageId = uuidv4();
        const timestamp = new Date();

        // Get user info
        const userResult = await query(
            'SELECT name FROM users WHERE user_id = $1',
            [userId]
        );
        const userName = userResult.rows[0]?.name || 'Unknown User';

        // Get workspace ID for search indexing
        const channelResult = await query(
            'SELECT workspace_id FROM channels WHERE channel_id = $1',
            [channelId]
        );
        const workspaceId = channelResult.rows[0]?.workspace_id;

        // 1. Store in Cassandra
        await cassandraClient.execute(
            `INSERT INTO messages (channel_id, message_timestamp, message_id, user_id, user_name, message_text, file_id, edited)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [channelId, timestamp, messageId, userId, userName, messageText, fileId, false],
            { prepare: true }
        );

        // 2. Cache in Redis (recent messages)
        const message = {
            message_id: messageId,
            channel_id: channelId,
            user_id: userId,
            user_name: userName,
            message_text: messageText,
            file_id: fileId,
            timestamp: timestamp.toISOString(),
            edited: false,
        };

        await cacheService.lpush(`${CACHE_PREFIX}${channelId}`, message, CACHE_LIMIT);

        // 3. Index in OpenSearch
        await opensearchService.indexMessage({
            message_id: messageId,
            channel_id: channelId,
            workspace_id: workspaceId,
            user_id: userId,
            user_name: userName,
            message_text: messageText,
            file_id: fileId,
            timestamp: timestamp.toISOString(),
            edited: false,
        });

        return message;
    },

    // Get messages for a channel
    getMessages: async (channelId, limit = 50, beforeTimestamp = null) => {
        // Check if Cassandra is available
        if (!isCassandraConnected()) {
            console.warn('Cassandra unavailable - returning empty messages');
            return [];
        }

        // Try cache first for recent messages
        if (!beforeTimestamp) {
            const cachedMessages = await cacheService.lrange(
                `${CACHE_PREFIX}${channelId}`,
                0,
                limit - 1
            );

            if (cachedMessages.length > 0) {
                console.log(`Cache hit for channel ${channelId}`);
                return cachedMessages;
            }
        }

        // Fetch from Cassandra
        let query = 'SELECT * FROM messages WHERE channel_id = ?';
        const params = [channelId];

        if (beforeTimestamp) {
            query += ' AND message_timestamp < ?';
            params.push(new Date(beforeTimestamp));
        }

        query += ' LIMIT ?';
        params.push(limit);

        const result = await cassandraClient.execute(query, params, { prepare: true });

        const messages = result.rows.map(row => ({
            message_id: row.message_id.toString(),
            channel_id: row.channel_id.toString(),
            user_id: row.user_id.toString(),
            user_name: row.user_name,
            message_text: row.message_text,
            file_id: row.file_id ? row.file_id.toString() : null,
            timestamp: row.message_timestamp.toISOString(),
            edited: row.edited,
            edited_at: row.edited_at ? row.edited_at.toISOString() : null,
        }));

        // Cache recent messages if this was the first page
        if (!beforeTimestamp && messages.length > 0) {
            for (const message of messages.reverse()) {
                await cacheService.lpush(`${CACHE_PREFIX}${channelId}`, message, CACHE_LIMIT);
            }
        }

        return messages;
    },

    // Edit a message
    editMessage: async (messageId, channelId, userId, newText) => {
        const timestamp = new Date();

        // Update in Cassandra (need to fetch first to get the original timestamp)
        const fetchResult = await cassandraClient.execute(
            'SELECT message_timestamp, user_id FROM messages WHERE channel_id = ? AND message_id = ? ALLOW FILTERING',
            [channelId, messageId],
            { prepare: true }
        );

        if (fetchResult.rows.length === 0) {
            throw new Error('Message not found');
        }

        const originalTimestamp = fetchResult.rows[0].message_timestamp;
        const messageUserId = fetchResult.rows[0].user_id.toString();

        // Check if user owns the message
        if (messageUserId !== userId) {
            throw new Error('Unauthorized');
        }

        // Update message
        await cassandraClient.execute(
            `UPDATE messages SET message_text = ?, edited = ?, edited_at = ?
       WHERE channel_id = ? AND message_timestamp = ? AND message_id = ?`,
            [newText, true, timestamp, channelId, originalTimestamp, messageId],
            { prepare: true }
        );

        // Invalidate cache
        await cacheService.del(`${CACHE_PREFIX}${channelId}`);

        // Update in OpenSearch
        await opensearchService.updateMessage(messageId, {
            message_text: newText,
            edited: true,
        });

        return { success: true };
    },

    // Delete a message
    deleteMessage: async (messageId, channelId, userId) => {
        // Fetch message to verify ownership
        const fetchResult = await cassandraClient.execute(
            'SELECT message_timestamp, user_id FROM messages WHERE channel_id = ? AND message_id = ? ALLOW FILTERING',
            [channelId, messageId],
            { prepare: true }
        );

        if (fetchResult.rows.length === 0) {
            throw new Error('Message not found');
        }

        const originalTimestamp = fetchResult.rows[0].message_timestamp;
        const messageUserId = fetchResult.rows[0].user_id.toString();

        // Check if user owns the message
        if (messageUserId !== userId) {
            throw new Error('Unauthorized');
        }

        // Delete from Cassandra
        await cassandraClient.execute(
            'DELETE FROM messages WHERE channel_id = ? AND message_timestamp = ? AND message_id = ?',
            [channelId, originalTimestamp, messageId],
            { prepare: true }
        );

        // Invalidate cache
        await cacheService.del(`${CACHE_PREFIX}${channelId}`);

        // Delete from OpenSearch
        await opensearchService.deleteMessage(messageId);

        return { success: true };
    },
};
