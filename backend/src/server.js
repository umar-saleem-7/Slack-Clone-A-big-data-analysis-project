import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger, errorLogger } from './middleware/logger.js';
import { setupWebSocket } from './websocket/messageHandler.js';
import { opensearchService } from './config/opensearch.js';

// Import routes
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspaces.js';
import channelRoutes from './routes/channels.js';
import messageRoutes from './routes/messages.js';
import fileRoutes from './routes/files.js';
import searchRoutes from './routes/search.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/search', searchRoutes);

// 404 handler
app.use(notFoundHandler);

// Error logging
app.use(errorLogger);

// Error handler (must be last)
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Setup WebSocket
setupWebSocket(server);

// Initialize OpenSearch index
opensearchService.createIndex().catch(err => {
    console.error('Failed to create OpenSearch index:', err);
});

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 Slack Clone Server Running                      ║
║                                                       ║
║   📡 HTTP Server:    http://localhost:${PORT}        ║
║   🔌 WebSocket:      ws://localhost:${PORT}/ws       ║
║                                                       ║
║   Environment:       ${process.env.NODE_ENV || 'development'}                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
