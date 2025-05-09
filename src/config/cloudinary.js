import { v2 as cloudinary } from 'cloudinary';
import logger from '../utils/logger.js';
import config from './index.js';

/**
 * Configures the Cloudinary SDK with credentials from the environment variables.
 * This should be called once when the application starts.
 */
const configureCloudinary = () => {
    if (!config.cloudinary.cloudName || !config.cloudinary.apiKey || !config.cloudinary.apiSecret) {
        logger.warn('Cloudinary configuration is incomplete. File uploads will likely fail.');
        // Optionally throw an error in production if Cloudinary is essential
        // if (config.nodeEnv === 'production') {
        //     throw new Error('FATAL ERROR: Cloudinary configuration missing.');
        // }
        return; // Don't configure if keys are missing
    }

    try {
        cloudinary.config({
            cloud_name: config.cloudinary.cloudName,
            api_key: config.cloudinary.apiKey,
            api_secret: config.cloudinary.apiSecret,
            secure: true, // Recommended: Force HTTPS URLs
        });
        logger.info('Cloudinary SDK configured successfully.');
    } catch (error) {
        logger.error(`Cloudinary configuration failed: ${error.message}`);
        // Handle error
        process.exit(1);
    }
};

export { cloudinary, configureCloudinary };
