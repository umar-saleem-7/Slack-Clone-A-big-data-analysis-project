import express from 'express';
import bcrypt from 'bcrypt';
import { body, validationResult } from 'express-validator';
import { query } from '../config/postgres.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Register new user
router.post(
    '/register',
    [
        body('email').isEmail().normalizeEmail(),
        body('name').trim().isLength({ min: 2, max: 255 }),
        body('password').isLength({ min: 6 }),
    ],
    asyncHandler(async (req, res) => {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, name, password } = req.body;

        // Check if user already exists
        const existingUser = await query(
            'SELECT user_id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password (8 rounds = ~40ms, still secure)
        const passwordHash = await bcrypt.hash(password, 8);

        // Create user
        const result = await query(
            'INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3) RETURNING user_id, email, name, created_at',
            [email, name, passwordHash]
        );

        const user = result.rows[0];

        // Generate JWT token
        const token = generateToken(user);

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                userId: user.user_id,
                email: user.email,
                name: user.name,
                createdAt: user.created_at,
            },
            token,
        });
    })
);

// Login user
router.post(
    '/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty(),
    ],
    asyncHandler(async (req, res) => {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;

        // Find user
        const result = await query(
            'SELECT user_id, email, name, password_hash, created_at FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = generateToken(user);

        res.json({
            message: 'Login successful',
            user: {
                userId: user.user_id,
                email: user.email,
                name: user.name,
                createdAt: user.created_at,
            },
            token,
        });
    })
);

// Get current user info
router.get('/me', asyncHandler(async (req, res) => {
    const userId = req.user.userId;

    const result = await query(
        'SELECT user_id, email, name, avatar_url, created_at FROM users WHERE user_id = $1',
        [userId]
    );

    if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
}));

export default router;
