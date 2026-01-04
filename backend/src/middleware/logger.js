// Request logging middleware with performance monitoring

export const requestLogger = (req, res, next) => {
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // Log incoming request
    console.log(`\n→ ${timestamp} ${req.method} ${req.path}`);

    // Capture response
    res.on('finish', () => {
        const duration = Date.now() - start;

        // Color code based on duration
        let color = '\x1b[32m'; // Green for fast (<200ms)
        if (duration > 1000) color = '\x1b[31m'; // Red for slow (>1s)
        else if (duration > 500) color = '\x1b[33m'; // Yellow for medium (>500ms)

        // Status color
        let statusColor = '\x1b[32m'; // Green for 2xx
        if (res.statusCode >= 500) statusColor = '\x1b[31m'; // Red for 5xx
        else if (res.statusCode >= 400) statusColor = '\x1b[33m'; // Yellow for 4xx

        console.log(
            `${color}← ${req.method} ${req.path} ${statusColor}${res.statusCode}\x1b[0m ${color}${duration}ms\x1b[0m`
        );

        // Warn on slow requests
        if (duration > 1000) {
            console.warn(`⚠️  Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
        }
    });

    next();
};

// Error logger
export const errorLogger = (err, req, res, next) => {
    console.error('\n❌ Error occurred:');
    console.error('  Path:', req.method, req.path);
    console.error('  Message:', err.message);
    console.error('  Code:', err.code || 'UNKNOWN');

    if (process.env.NODE_ENV === 'development') {
        console.error('  Stack:', err.stack);
    }

    next(err);
};
