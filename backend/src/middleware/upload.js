import multer from 'multer';

// Allowed file types with their extensions
const ALLOWED_TYPES = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'application/msword': ['.doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.ms-excel': ['.xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'text/plain': ['.txt'],
    'text/csv': ['.csv'],
    // Audio types for voice messages
    'audio/webm': ['.webm'],
    'audio/mpeg': ['.mp3'],
    'audio/mp3': ['.mp3'],
    'audio/wav': ['.wav'],
    'audio/ogg': ['.ogg'],
    'audio/x-wav': ['.wav'],
};

// File filter function
const fileFilter = (req, file, cb) => {
    const mimeType = file.mimetype.toLowerCase();
    const fileName = file.originalname.toLowerCase();

    // Check if MIME type is allowed
    if (!ALLOWED_TYPES[mimeType]) {
        return cb(
            new Error(`File type '${file.mimetype}' is not allowed. Allowed types: images, PDFs, documents, text files.`),
            false
        );
    }

    // Check if file extension matches MIME type
    const allowedExtensions = ALLOWED_TYPES[mimeType];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
        return cb(
            new Error(`File extension doesn't match type. Expected: ${allowedExtensions.join(', ')}`),
            false
        );
    }

    cb(null, true);
};

// Configure multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    },
    fileFilter,
});

export default upload;
