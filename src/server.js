import app from './app.js';
import { configureCloudinary } from './config/cloudinary.js';
import connectDB from './config/db.js';
import config from './config/index.js';
import logger from './utils/logger.js';

// --- Graceful Shutdown Handling ---
// Function to handle shutdown signals
const gracefulShutdown = (signal) => {
    logger.warn(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down.');
        process.exit(1);
    }, 10000);
};

let server;

// Connect to Database and Start Server
const startServer = async () => {
    try {
        // 1. Configure Cloudinary SDK
        configureCloudinary();

        // 2. Connect to MongoDB
        await connectDB();

        // 3. Start the Express server
        server = app.listen(config.port, () => {
            logger.info(`Server listening on port ${config.port} in ${config.nodeEnv} mode.`);
            logger.info(`API base URL: ${config.apiBaseUrl}`);
        });

        // --- Global Error Handling for Uncaught Exceptions/Rejections ---

        // Handle Unhandled Promise Rejections (e.g., database connection errors not caught initially)
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('UNHANDLED REJECTION! 💥 Shutting down...', { reason });
            // Gracefully shut down the server
            if (server) {
                server.close(() => {
                    process.exit(1); // Exit with failure code
                });
            } else {
                process.exit(1);
            }
        });

        // Handle Uncaught Exceptions (synchronous errors)
        process.on('uncaughtException', (err) => {
            logger.error('UNCAUGHT EXCEPTION! 💥 Shutting down...', { error: err });
            process.exit(1);
        });

        // Listen for termination signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    } catch (error) {
        // Catch any errors during the initial startup phase
        logger.error('Failed to start the server:', { error });
        process.exit(1);
    }
};

startServer();
