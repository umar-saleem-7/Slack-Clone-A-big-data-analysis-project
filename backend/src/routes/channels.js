import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/postgres.js';
import pool from '../config/postgres.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all channels in a workspace
// Public channels: visible to all workspace members
// Private channels: only visible to members
router.get('/workspace/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user is member of workspace
    const memberCheck = await query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Get public channels (all) + private channels (only if member)
    const result = await query(
        `SELECT DISTINCT c.channel_id, c.name, c.description, c.type, c.created_at, c.created_by,
            CASE WHEN cm.user_id IS NOT NULL THEN true ELSE false END as is_member
         FROM channels c
         LEFT JOIN channel_members cm ON c.channel_id = cm.channel_id AND cm.user_id = $2
         WHERE c.workspace_id = $1 AND (c.type = 'public' OR cm.user_id IS NOT NULL)
         ORDER BY c.type ASC, c.created_at ASC`,
        [workspaceId, userId]
    );

    res.json({ channels: result.rows });
}));

// Get channel by ID (requires membership for all channel types)
router.get('/:channelId', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Check if user is member of channel
    const memberCheck = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied - you must be a member of this channel' });
    }

    const result = await query(
        `SELECT c.channel_id, c.workspace_id, c.name, c.description, c.type, c.created_at, c.created_by
         FROM channels c
         WHERE c.channel_id = $1`,
        [channelId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    res.json({ channel: { ...result.rows[0], is_member: true } });
}));

// Create new channel
router.post(
    '/',
    [
        body('workspaceId').isUUID(),
        body('name').trim().isLength({ min: 2, max: 255 }),
        body('description').optional().trim(),
        body('type').isIn(['public', 'private']),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { workspaceId, name, description, type } = req.body;
        const userId = req.user.userId;

        // Check if user is admin of workspace
        const memberCheck = await query(
            'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [workspaceId, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Only admins can create channels
        if (memberCheck.rows[0].role !== 'admin') {
            return res.status(403).json({ error: 'Only workspace admins can create channels' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Create channel
            const channelResult = await client.query(
                'INSERT INTO channels (workspace_id, name, description, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING channel_id, name, description, type, created_at',
                [workspaceId, name, description || null, type, userId]
            );

            const channel = channelResult.rows[0];

            // Add creator to channel
            await client.query(
                'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
                [channel.channel_id, userId]
            );

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Channel created successfully',
                channel,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    })
);

// Join channel
router.post('/:channelId/join', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Get channel info
    const channelResult = await query(
        'SELECT channel_id, workspace_id, type FROM channels WHERE channel_id = $1',
        [channelId]
    );

    if (channelResult.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    // Check if user is member of workspace
    const workspaceMember = await query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [channel.workspace_id, userId]
    );

    if (workspaceMember.rows.length === 0) {
        return res.status(403).json({ error: 'Must be workspace member' });
    }

    // Check if already a member
    const memberCheck = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
    );

    if (memberCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Already a member' });
    }

    // Private channels require invitation (simplified here)
    if (channel.type === 'private') {
        return res.status(403).json({ error: 'Private channel - invitation required' });
    }

    // Add user to channel
    await query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
        [channelId, userId]
    );

    res.json({ message: 'Joined channel successfully' });
}));

// Get channel members
router.get('/:channelId/members', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Check if user is member
    const memberCheck = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
        `SELECT u.user_id, u.name, u.email, u.avatar_url, cm.joined_at
     FROM users u
     JOIN channel_members cm ON u.user_id = cm.user_id
     WHERE cm.channel_id = $1
     ORDER BY cm.joined_at ASC`,
        [channelId]
    );

    res.json({ members: result.rows });
}));

// Add member to channel (admin/creator only for private channels)
router.post('/:channelId/members', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const { userId: targetUserId } = req.body;
    const userId = req.user.userId;

    // Get channel info including creator
    const channelCheck = await query(
        'SELECT channel_id, workspace_id, type, created_by FROM channels WHERE channel_id = $1',
        [channelId]
    );

    if (channelCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelCheck.rows[0];

    // For private channels, only admin or channel creator can add members
    if (channel.type === 'private') {
        const adminCheck = await query(
            'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [channel.workspace_id, userId]
        );

        const isAdmin = adminCheck.rows[0]?.role === 'admin';
        const isCreator = channel.created_by === userId;

        if (!isAdmin && !isCreator) {
            return res.status(403).json({ error: 'Only admin or channel creator can add members to private channels' });
        }
    } else {
        // For public channels, check if current user is workspace member
        const memberCheck = await query(
            'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [channel.workspace_id, userId]
        );

        if (memberCheck.rows.length === 0) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }

    // Check if target user is workspace member
    const workspaceMemberCheck = await query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [channel.workspace_id, targetUserId]
    );

    if (workspaceMemberCheck.rows.length === 0) {
        return res.status(400).json({ error: 'User is not a member of this workspace' });
    }

    // Check if already a channel member
    const existingMember = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, targetUserId]
    );

    if (existingMember.rows.length > 0) {
        return res.status(409).json({ error: 'User is already a channel member' });
    }

    // Add member directly (for both public and private channels)
    await query(
        'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
        [channelId, targetUserId]
    );

    res.json({ message: 'Member added successfully' });
}));

// Remove member from channel (admin or channel creator only)
router.delete('/:channelId/members/:userId', asyncHandler(async (req, res) => {
    const { channelId, userId: targetUserId } = req.params;
    const userId = req.user.userId;

    // Get channel info including creator and workspace
    const channelCheck = await query(
        'SELECT channel_id, workspace_id, created_by, type FROM channels WHERE channel_id = $1',
        [channelId]
    );

    if (channelCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelCheck.rows[0];

    // Check if current user is admin or channel creator
    const adminCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [channel.workspace_id, userId]
    );

    const isAdmin = adminCheck.rows[0]?.role === 'admin';
    const isCreator = channel.created_by === userId;

    if (!isAdmin && !isCreator) {
        return res.status(403).json({ error: 'Only admin or channel creator can remove members' });
    }

    // Can't remove yourself using this route
    if (targetUserId === userId) {
        return res.status(400).json({ error: 'Use leave channel instead' });
    }

    // Can't remove the channel creator
    if (targetUserId === channel.created_by) {
        return res.status(400).json({ error: 'Cannot remove channel creator' });
    }

    // Check if target is actually a member
    const targetMemberCheck = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, targetUserId]
    );

    if (targetMemberCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User is not a member of this channel' });
    }

    // Remove member
    await query(
        'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, targetUserId]
    );

    res.json({ message: 'Member removed successfully' });
}));

// Leave channel (for members to leave themselves)
router.post('/:channelId/leave', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Get channel info
    const channelCheck = await query(
        'SELECT channel_id, created_by, name FROM channels WHERE channel_id = $1',
        [channelId]
    );

    if (channelCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelCheck.rows[0];

    // Check if user is member
    const memberCheck = await query(
        'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(400).json({ error: 'You are not a member of this channel' });
    }

    // Channel creator cannot leave (they must delete the channel instead)
    if (channel.created_by === userId) {
        return res.status(400).json({
            error: 'Channel creator cannot leave. Transfer ownership or delete the channel instead.'
        });
    }

    // Remove from channel
    await query(
        'DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2',
        [channelId, userId]
    );

    res.json({ message: `Left channel "${channel.name}" successfully` });
}));

// Delete channel (admin only)
router.delete('/:channelId', asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Get channel info
    const channelResult = await query(
        'SELECT channel_id, workspace_id, name FROM channels WHERE channel_id = $1',
        [channelId]
    );

    if (channelResult.rows.length === 0) {
        return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = channelResult.rows[0];

    // Check if user is admin of workspace
    const memberCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [channel.workspace_id, userId]
    );

    if (memberCheck.rows.length === 0 || memberCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only workspace admins can delete channels' });
    }

    // Delete channel (cascade will handle members and messages)
    await query('DELETE FROM channels WHERE channel_id = $1', [channelId]);

    res.json({ message: `Channel "${channel.name}" deleted successfully` });
}));

export default router;
