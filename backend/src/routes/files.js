import express from 'express';
import { param } from 'express-validator';
import { authenticateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import upload from '../middleware/upload.js';
import { fileService } from '../services/fileService.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Upload file
router.post(
    '/upload',
    (req, res, next) => {
        upload.single('file')(req, res, (err) => {
            if (err) {
                console.error('File validation error:', err.message);
                return res.status(400).json({
                    error: 'File validation failed',
                    message: err.message
                });
            }
            next();
        });
    },
    asyncHandler(async (req, res) => {
        const { channelId } = req.body;
        const userId = req.user.userId;

        if (!channelId) {
            return res.status(400).json({ error: 'channelId required' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('File upload request:', {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            channelId,
        });

        const fileMetadata = await fileService.uploadFile(req.file, userId, channelId);

        res.status(201).json({
            message: 'File uploaded successfully',
            file: fileMetadata,
        });
    })
);

// Get file (returns presigned URL)
router.get(
    '/:fileId',
    [param('fileId').isUUID()],
    asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const userId = req.user.userId;

        const file = await fileService.getFile(fileId, userId);

        res.json({ file });
    })
);

// Delete file
router.delete(
    '/:fileId',
    [param('fileId').isUUID()],
    asyncHandler(async (req, res) => {
        const { fileId } = req.params;
        const userId = req.user.userId;

        await fileService.deleteFile(fileId, userId);

        res.json({ message: 'File deleted successfully' });
    })
);

// Get files for a channel
router.get(
    '/channel/:channelId',
    [param('channelId').isUUID()],
    asyncHandler(async (req, res) => {
        const { channelId } = req.params;
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;

        const files = await fileService.getChannelFiles(channelId, userId, limit, offset);

        res.json({ files });
    })
);

export default router;
