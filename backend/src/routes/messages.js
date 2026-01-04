import express from 'express';
import { param, query as expressQuery } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { messageService } from '../services/messageService.js';
import { query } from '../config/postgres.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get messages for a channel
router.get(
    '/:channelId',
    [
        param('channelId').isUUID(),
        expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
        expressQuery('before').optional().isISO8601(),
    ],
    asyncHandler(async (req, res) => {
        const { channelId } = req.params;
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;

        // Check if user is member of channel
        const memberCheck = await query(
            'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
            [channelId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const messages = await messageService.getMessages(channelId, limit, before);

        res.json({ messages });
    })
);

// Send a message (REST endpoint - WebSocket is preferred for real-time)
router.post(
    '/',
    asyncHandler(async (req, res) => {
        const { channelId, messageText, fileId } = req.body;
        const userId = req.user.userId;

        if (!channelId || !messageText) {
            return res.status(400).json({ error: 'channelId and messageText required' });
        }

        // Check if user is member of channel
        const memberCheck = await query(
            'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
            [channelId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const message = await messageService.sendMessage(
            channelId,
            userId,
            messageText,
            fileId || null
        );

        res.status(201).json({ message });
    })
);

// Edit a message
router.put(
    '/:messageId',
    asyncHandler(async (req, res) => {
        const { messageId } = req.params;
        const { channelId, messageText } = req.body;
        const userId = req.user.userId;

        if (!channelId || !messageText) {
            return res.status(400).json({ error: 'channelId and messageText required' });
        }

        await messageService.editMessage(messageId, channelId, userId, messageText);

        res.json({ message: 'Message updated successfully' });
    })
);

// Delete a message
router.delete(
    '/:messageId',
    asyncHandler(async (req, res) => {
        const { messageId } = req.params;
        const { channelId } = req.body;
        const userId = req.user.userId;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId required' });
        }

        await messageService.deleteMessage(messageId, channelId, userId);

        res.json({ message: 'Message deleted successfully' });
    })
);

export default router;
