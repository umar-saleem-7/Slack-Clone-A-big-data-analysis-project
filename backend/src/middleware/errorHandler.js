// Global error handling middleware
export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
    } else if (err.name === 'UnauthorizedError') {
        statusCode = 401;
        message = 'Unauthorized';
    } else if (err.code === '23505') { // PostgreSQL unique violation
        statusCode = 409;
        message = 'Resource already exists';
    } else if (err.code === '23503') { // PostgreSQL foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
    }

    res.status(statusCode).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
};

// 404 handler
export const notFoundHandler = (req, res) => {
    res.status(404).json({ error: 'Route not found' });
};

// Async handler wrapper to catch errors in async route handlers
export const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
