import express from 'express';
import { body, validationResult } from 'express-validator';
import { query } from '../config/postgres.js';
import pool from '../config/postgres.js';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get all workspaces for current user
router.get('/', asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const result = await query(
        `SELECT w.workspace_id, w.name, w.description, w.created_at, wm.role
     FROM workspaces w
     JOIN workspace_members wm ON w.workspace_id = wm.workspace_id
     WHERE wm.user_id = $1
     ORDER BY w.created_at DESC`,
        [userId]
    );

    res.json({ workspaces: result.rows });
}));

// Get workspace by ID
router.get('/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user is member of workspace
    const memberCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
        'SELECT workspace_id, name, description, created_by, created_at FROM workspaces WHERE workspace_id = $1',
        [workspaceId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({ workspace: result.rows[0], role: memberCheck.rows[0].role });
}));

// Create new workspace
router.post(
    '/',
    [
        body('name').trim().isLength({ min: 2, max: 255 }),
        body('description').optional().trim(),
    ],
    asyncHandler(async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, description } = req.body;
        const userId = req.user.userId;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Ensure user exists in database (handle case where JWT is valid but user not in DB)
            const userCheck = await client.query(
                'SELECT user_id FROM users WHERE user_id = $1',
                [userId]
            );

            if (userCheck.rows.length === 0) {
                // Auto-create user from JWT payload
                const userName = req.user.name || req.user.email?.split('@')[0] || 'User';
                const userEmail = req.user.email || `${userId}@placeholder.local`;

                await client.query(
                    'INSERT INTO users (user_id, name, email, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING',
                    [userId, userName, userEmail, 'external_auth']
                );
                console.log(`Auto-created user ${userId} from JWT payload`);
            }

            // Create workspace
            const workspaceResult = await client.query(
                'INSERT INTO workspaces (name, description, created_by) VALUES ($1, $2, $3) RETURNING workspace_id, name, description, created_at',
                [name, description || null, userId]
            );

            const workspace = workspaceResult.rows[0];

            // Add creator as admin
            await client.query(
                'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
                [workspace.workspace_id, userId, 'admin']
            );

            // Create default general channel
            const channelResult = await client.query(
                'INSERT INTO channels (workspace_id, name, type, created_by) VALUES ($1, $2, $3, $4) RETURNING channel_id',
                [workspace.workspace_id, 'general', 'public', userId]
            );

            // Add creator to general channel
            await client.query(
                'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
                [channelResult.rows[0].channel_id, userId]
            );

            await client.query('COMMIT');

            res.status(201).json({
                message: 'Workspace created successfully',
                workspace,
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    })
);

// Join workspace (simplified - in production, you'd have invite links)
router.post('/:workspaceId/join', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    console.log(`User ${userId} attempting to join workspace: ${workspaceId}`);

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
        return res.status(400).json({ error: 'Invalid workspace ID format' });
    }

    // Check if workspace exists
    const workspaceCheck = await query(
        'SELECT workspace_id, name FROM workspaces WHERE workspace_id = $1',
        [workspaceId]
    );

    if (workspaceCheck.rows.length === 0) {
        console.log(`Workspace not found: ${workspaceId}`);
        return res.status(404).json({ error: 'Workspace not found. Please check the ID and try again.' });
    }

    // Check if already a member
    const memberCheck = await query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (memberCheck.rows.length > 0) {
        return res.status(409).json({ error: 'You are already a member of this workspace' });
    }

    // Get a database connection for transaction
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Add user to workspace
        await client.query(
            'INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3)',
            [workspaceId, userId, 'member']
        );

        // Auto-join all public channels
        const publicChannels = await client.query(
            'SELECT channel_id FROM channels WHERE workspace_id = $1 AND type = $2',
            [workspaceId, 'public']
        );

        for (const channel of publicChannels.rows) {
            // Check if not already a member
            const channelMemberCheck = await client.query(
                'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
                [channel.channel_id, userId]
            );

            if (channelMemberCheck.rows.length === 0) {
                await client.query(
                    'INSERT INTO channel_members (channel_id, user_id) VALUES ($1, $2)',
                    [channel.channel_id, userId]
                );
            }
        }

        await client.query('COMMIT');

        console.log(`User ${userId} successfully joined workspace ${workspaceCheck.rows[0].name}`);

        res.json({
            message: 'Joined workspace successfully',
            workspace: workspaceCheck.rows[0]
        });
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}));

// Get workspace members
router.get('/:workspaceId/members', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user is member
    const memberCheck = await query(
        'SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (memberCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
        `SELECT u.user_id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
     FROM users u
     JOIN workspace_members wm ON u.user_id = wm.user_id
     WHERE wm.workspace_id = $1
     ORDER BY wm.joined_at ASC`,
        [workspaceId]
    );

    res.json({ members: result.rows });
}));

// Update workspace (admin only)
router.put('/:workspaceId', [
    body('name').trim().isLength({ min: 3, max: 255 }),
    body('description').optional().trim()
], asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { workspaceId } = req.params;
    const { name, description } = req.body;
    const userId = req.user.userId;

    // Check if user is admin
    const roleCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (roleCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found' });
    }

    if (roleCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can update workspace' });
    }

    // Update workspace
    await query(
        'UPDATE workspaces SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP WHERE workspace_id = $3',
        [name, description || null, workspaceId]
    );

    res.json({ message: 'Workspace updated successfully' });
}));

// Delete workspace (admin only)
router.delete('/:workspaceId', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user is admin
    const roleCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (roleCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Workspace not found' });
    }

    if (roleCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can delete workspace' });
    }

    // Delete workspace (CASCADE will delete members, channels, messages, etc.)
    await query('DELETE FROM workspaces WHERE workspace_id = $1', [workspaceId]);

    res.json({ message: 'Workspace deleted successfully' });
}));

// Leave workspace
router.post('/:workspaceId/leave', asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user.userId;

    // Check if user is member
    const userRole = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (userRole.rows.length === 0) {
        return res.status(404).json({ error: 'You are not a member of this workspace' });
    }

    // Check if user is the last admin
    if (userRole.rows[0].role === 'admin') {
        const adminCount = await query(
            'SELECT COUNT(*) as count FROM workspace_members WHERE workspace_id = $1 AND role = $2',
            [workspaceId, 'admin']
        );

        if (parseInt(adminCount.rows[0].count) === 1) {
            return res.status(400).json({
                error: 'Cannot leave workspace. You are the last admin. Delete the workspace or promote another member first.'
            });
        }
    }

    // Remove user from workspace
    await query(
        'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    res.json({ message: 'Left workspace successfully' });
}));

// Remove member from workspace (admin only)
router.delete('/:workspaceId/members/:userId', asyncHandler(async (req, res) => {
    const { workspaceId, userId: targetUserId } = req.params;
    const userId = req.user.userId;

    // Can't remove yourself
    if (targetUserId === userId) {
        return res.status(400).json({ error: 'Use leave workspace instead' });
    }

    // Check if current user is admin
    const adminCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, userId]
    );

    if (adminCheck.rows.length === 0 || adminCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Only workspace admins can remove members' });
    }

    // Check if target is a member
    const targetCheck = await query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, targetUserId]
    );

    if (targetCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User is not a member of this workspace' });
    }

    // Can't remove another admin (they must leave themselves)
    if (targetCheck.rows[0].role === 'admin') {
        return res.status(400).json({ error: 'Cannot remove an admin. They must leave themselves.' });
    }

    // Remove from workspace
    await query(
        'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [workspaceId, targetUserId]
    );

    // Also remove from all channels in this workspace
    await query(
        `DELETE FROM channel_members 
         WHERE user_id = $1 AND channel_id IN (
             SELECT channel_id FROM channels WHERE workspace_id = $2
         )`,
        [targetUserId, workspaceId]
    );

    res.json({ message: 'Member removed successfully' });
}));

export default router;
