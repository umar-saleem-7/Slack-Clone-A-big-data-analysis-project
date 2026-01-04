import { Client } from 'minio';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Initialize MinIO client (S3-compatible)
const minioClient = new Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'slack-files';

// Debug: Log MinIO configuration (without showing full secret)
console.log('MinIO Configuration:', {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ? '***' : 'minioadmin',
    bucket: BUCKET_NAME,
});

// Ensure bucket exists
const ensureBucket = async () => {
    try {
        const exists = await minioClient.bucketExists(BUCKET_NAME);
        if (!exists) {
            // Don't specify region - let MinIO use default
            await minioClient.makeBucket(BUCKET_NAME);
            console.log(`✓ Created MinIO bucket: ${BUCKET_NAME}`);
        } else {
            console.log(`✓ MinIO bucket exists: ${BUCKET_NAME}`);
        }
    } catch (error) {
        console.error('MinIO bucket check failed:', error.message);
    }
};

// Initialize bucket on startup
ensureBucket();

/**
 * Upload file to MinIO
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - File MIME type
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} Upload result with key and metadata
 */
export const uploadFile = async (fileBuffer, fileName, mimeType, channelId, userId) => {
    try {
        const fileExtension = fileName.split('.').pop();
        const key = `channels/${channelId}/${userId}/${uuidv4()}.${fileExtension}`;

        // Simplified metadata - just Content-Type
        const metadata = {
            'Content-Type': mimeType,
        };

        console.log(`Uploading file: ${fileName} (${mimeType}) - ${fileBuffer.length} bytes`);

        await minioClient.putObject(
            BUCKET_NAME,
            key,
            fileBuffer,
            fileBuffer.length,
            metadata
        );

        console.log(`✓ File uploaded to MinIO: ${key}`);

        return {
            key,
            bucket: BUCKET_NAME,
            size: fileBuffer.length,
            mimeType,
        };
    } catch (error) {
        console.error('❌ MinIO upload error details:');
        console.error('  File:', fileName);
        console.error('  MIME type:', mimeType);
        console.error('  Size:', fileBuffer?.length || 'unknown');
        console.error('  Error message:', error.message);
        console.error('  Error code:', error.code);
        console.error('  Full error:', error);
        throw new Error(`File upload failed: ${error.message}`);
    }
};

/**
 * Get presigned URL for file download
 * @param {string} key - Object key in MinIO
 * @param {number} expirySeconds - URL expiry time in seconds (default: 1 hour)
 * @returns {Promise<string>} Presigned URL
 */
export const getPresignedUrl = async (key, expirySeconds = 3600) => {
    try {
        const url = await minioClient.presignedGetObject(
            BUCKET_NAME,
            key,
            expirySeconds
        );

        return url;
    } catch (error) {
        console.error('MinIO presigned URL error:', error);
        throw new Error('Failed to generate download URL');
    }
};

/**
 * Delete file from MinIO
 * @param {string} key - Object key in MinIO
 * @returns {Promise<void>}
 */
export const deleteFile = async (key) => {
    try {
        await minioClient.removeObject(BUCKET_NAME, key);
        console.log(`✓ File deleted from MinIO: ${key}`);
    } catch (error) {
        console.error('MinIO delete error:', error);
        throw new Error('File deletion failed');
    }
};

/**
 * Generate unique file key
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID
 * @param {string} fileName - Original file name
 * @returns {string} Unique file key
 */
export const generateKey = (channelId, userId, fileName) => {
    const fileExtension = fileName.split('.').pop();
    return `channels/${channelId}/${userId}/${uuidv4()}.${fileExtension}`;
};

/**
 * Get file metadata
 * @param {string} key - Object key in MinIO
 * @returns {Promise<Object>} File metadata
 */
export const getFileMetadata = async (key) => {
    try {
        const stat = await minioClient.statObject(BUCKET_NAME, key);
        return {
            size: stat.size,
            lastModified: stat.lastModified,
            etag: stat.etag,
            metadata: stat.metaData,
        };
    } catch (error) {
        console.error('MinIO metadata error:', error);
        throw new Error('Failed to get file metadata');
    }
};

export default minioClient;
