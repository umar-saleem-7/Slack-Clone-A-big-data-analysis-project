import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware to verify JWT token
export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }

        req.user = user; // Attach user info to request
        next();
    });
};

// Middleware to verify WebSocket token
export const authenticateWebSocket = (token) => {
    try {
        const user = jwt.verify(token, JWT_SECRET);
        return { success: true, user };
    } catch (error) {
        return { success: false, error: 'Invalid token' };
    }
};

// Generate JWT token
export const generateToken = (user) => {
    const payload = {
        userId: user.user_id,
        email: user.email,
        name: user.name,
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
};
