import express from 'express';
import { query as expressQuery } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { opensearchService } from '../config/opensearch.js';
import { query } from '../config/postgres.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Search messages
router.get(
    '/',
    [
        expressQuery('q').optional().trim(),
        expressQuery('channelId').optional().isUUID(),
        expressQuery('workspaceId').optional().isUUID(),
        expressQuery('userId').optional().isUUID(),
        expressQuery('limit').optional().isInt({ min: 1, max: 100 }),
        expressQuery('offset').optional().isInt({ min: 0 }),
    ],
    asyncHandler(async (req, res) => {
        const userId = req.user.userId;
        const { q, channelId, workspaceId, userId: searchUserId, limit, offset } = req.query;

        // If channelId is provided, verify user has access
        if (channelId) {
            const memberCheck = await query(
                'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
                [channelId, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied to this channel' });
            }
        }

        // If workspaceId is provided, verify user is member
        if (workspaceId) {
            const memberCheck = await query(
                'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
                [workspaceId, userId]
            );

            if (memberCheck.rows.length === 0) {
                return res.status(403).json({ error: 'Access denied to this workspace' });
            }
        }

        // Build filters
        const filters = {
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
        };

        if (channelId) filters.channel_id = channelId;
        if (workspaceId) filters.workspace_id = workspaceId;
        if (searchUserId) filters.user_id = searchUserId;

        // Search messages
        const results = await opensearchService.searchMessages(q, filters);

        res.json({
            total: results.total,
            results: results.results,
            limit: filters.limit,
            offset: filters.offset,
        });
    })
);

export default router;
