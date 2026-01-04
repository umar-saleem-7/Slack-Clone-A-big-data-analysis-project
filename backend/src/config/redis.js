import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

// Create Redis client
const redisClient = createClient({
    socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        reconnectStrategy: (retries) => {
            if (retries > 10) {
                console.log('Redis: Max reconnection attempts reached, running without cache');
                return false; // Stop reconnecting
            }
            return Math.min(retries * 100, 3000); // Exponential backoff, max 3s
        },
    },
    password: process.env.REDIS_PASSWORD || undefined,
});

let isRedisConnected = false;

// Error handling
redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        if (isRedisConnected) {
            console.warn('⚠ Redis connection lost - cache disabled');
        }
    } else {
        console.error('Redis Client Error:', err.message);
    }
    isRedisConnected = false;
});

redisClient.on('connect', () => {
    console.log('✓ Connected to Redis');
});

redisClient.on('ready', () => {
    console.log('✓ Redis client ready');
    isRedisConnected = true;
});

redisClient.on('end', () => {
    isRedisConnected = false;
});

// Connect to Redis (non-blocking)
const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.warn('⚠ Redis not available - cache disabled. Server will continue without caching.');
        isRedisConnected = false;
    }
};

// Initialize connection
connectRedis();

// Helper functions for common operations (with graceful fallbacks)
export const cacheService = {
    // Check if Redis is connected
    isConnected: () => isRedisConnected,

    // Get cached data
    get: async (key) => {
        if (!isRedisConnected) return null;
        try {
            const data = await redisClient.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Redis GET error:', error.message);
            return null;
        }
    },

    // Set cached data with TTL
    set: async (key, value, ttl = parseInt(process.env.REDIS_CACHE_TTL) || 3600) => {
        if (!isRedisConnected) return false;
        try {
            await redisClient.setEx(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Redis SET error:', error.message);
            return false;
        }
    },

    // Delete cached data
    del: async (key) => {
        if (!isRedisConnected) return false;
        try {
            await redisClient.del(key);
            return true;
        } catch (error) {
            console.error('Redis DEL error:', error.message);
            return false;
        }
    },

    // Get list (for recent messages)
    lrange: async (key, start, stop) => {
        if (!isRedisConnected) return [];
        try {
            const data = await redisClient.lRange(key, start, stop);
            return data.map(item => JSON.parse(item));
        } catch (error) {
            console.error('Redis LRANGE error:', error.message);
            return [];
        }
    },

    // Push to list (for recent messages)
    lpush: async (key, value, maxLength = 50) => {
        if (!isRedisConnected) return false;
        try {
            await redisClient.lPush(key, JSON.stringify(value));
            await redisClient.lTrim(key, 0, maxLength - 1);
            return true;
        } catch (error) {
            console.error('Redis LPUSH error:', error.message);
            return false;
        }
    },

    // Set add (for online users)
    sadd: async (key, member) => {
        if (!isRedisConnected) return false;
        try {
            await redisClient.sAdd(key, member);
            return true;
        } catch (error) {
            console.error('Redis SADD error:', error.message);
            return false;
        }
    },

    // Set remove (for online users)
    srem: async (key, member) => {
        if (!isRedisConnected) return false;
        try {
            await redisClient.sRem(key, member);
            return true;
        } catch (error) {
            console.error('Redis SREM error:', error.message);
            return false;
        }
    },

    // Get set members (for online users)
    smembers: async (key) => {
        if (!isRedisConnected) return [];
        try {
            return await redisClient.sMembers(key);
        } catch (error) {
            console.error('Redis SMEMBERS error:', error.message);
            return [];
        }
    },
};

export default redisClient;

