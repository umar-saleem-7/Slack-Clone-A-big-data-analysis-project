import { uploadFile, getPresignedUrl, deleteFile } from '../config/s3.js';
import { query } from '../config/postgres.js';
import { v4 as uuidv4 } from 'uuid';

export const fileService = {
    // Upload file to MinIO and store metadata
    uploadFile: async (file, userId, channelId) => {
        const fileId = uuidv4();

        // Upload to MinIO
        const uploadResult = await uploadFile(
            file.buffer,
            file.originalname,
            file.mimetype,
            channelId,
            userId
        );

        // Store metadata in PostgreSQL
        const result = await query(
            `INSERT INTO files (file_id, channel_id, user_id, filename, file_size, mime_type, minio_key, minio_bucket)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING file_id, filename, file_size, mime_type, uploaded_at`,
            [
                fileId,
                channelId,
                userId,
                file.originalname,
                file.size,
                file.mimetype,
                uploadResult.key,
                uploadResult.bucket,
            ]
        );

        return {
            fileId: result.rows[0].file_id,
            filename: result.rows[0].filename,
            fileSize: result.rows[0].file_size,
            mimeType: result.rows[0].mime_type,
            uploadedAt: result.rows[0].uploaded_at,
        };
    },

    // Get file metadata and presigned URL
    getFile: async (fileId, userId) => {
        // Get file metadata
        const result = await query(
            `SELECT f.file_id, f.filename, f.file_size, f.mime_type, f.minio_key, f.minio_bucket, f.uploaded_at, f.channel_id
       FROM files f
       WHERE f.file_id = $1`,
            [fileId]
        );

        if (result.rows.length === 0) {
            throw new Error('File not found');
        }

        const file = result.rows[0];

        // Check if user has access to the channel
        const accessCheck = await query(
            'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
            [file.channel_id, userId]
        );

        if (accessCheck.rows.length === 0) {
            throw new Error('Access denied');
        }

        // Generate presigned URL
        const downloadUrl = await getPresignedUrl(file.minio_key);

        return {
            fileId: file.file_id,
            filename: file.filename,
            fileSize: file.file_size,
            mimeType: file.mime_type,
            uploadedAt: file.uploaded_at,
            downloadUrl,
        };
    },

    // Delete file
    deleteFile: async (fileId, userId) => {
        // Get file metadata
        const result = await query(
            'SELECT minio_key, user_id FROM files WHERE file_id = $1',
            [fileId]
        );

        if (result.rows.length === 0) {
            throw new Error('File not found');
        }

        const file = result.rows[0];

        // Check if user owns the file
        if (file.user_id !== userId) {
            throw new Error('Unauthorized');
        }

        // Delete from MinIO
        await deleteFile(file.minio_key);

        // Delete metadata from PostgreSQL
        await query('DELETE FROM files WHERE file_id = $1', [fileId]);

        return { success: true };
    },

    // Get files for a channel
    getChannelFiles: async (channelId, userId, limit = 20, offset = 0) => {
        // Check if user has access to the channel
        const accessCheck = await query(
            'SELECT user_id FROM channel_members WHERE channel_id = $1 AND user_id = $2',
            [channelId, userId]
        );

        if (accessCheck.rows.length === 0) {
            throw new Error('Access denied');
        }

        // Get files
        const result = await query(
            `SELECT f.file_id, f.filename, f.file_size, f.mime_type, f.uploaded_at, u.name as uploader_name
       FROM files f
       JOIN users u ON f.user_id = u.user_id
       WHERE f.channel_id = $1
       ORDER BY f.uploaded_at DESC
       LIMIT $2 OFFSET $3`,
            [channelId, limit, offset]
        );

        return result.rows.map(row => ({
            fileId: row.file_id,
            filename: row.filename,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            uploadedAt: row.uploaded_at,
            uploaderName: row.uploader_name,
        }));
    },
};
