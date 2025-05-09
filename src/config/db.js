import mongoose from 'mongoose';
import logger from '../utils/logger.js';
import config from './index.js';

/**
 * Connects to the MongoDB database using the URI and options from the config.
 */
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(config.db.uri, config.db.options);

        logger.info(`MongoDB Connected: ${conn.connection.host} (Database: ${conn.connection.name})`);

        mongoose.connection.on('error', (err) => {
            logger.error(`MongoDB connection error: ${err.message}`);
            // Exiting the process
            process.exit(1);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected.');
        });

    } catch (error) {
        logger.error(`MongoDB Connection Failed: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;
