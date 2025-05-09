// src/config/index.js
// Loads environment variables from .env file and exports them as a configuration object.

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine the directory name for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file located in the project root
// Adjust the path if your .env file is located elsewhere
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validate essential environment variables
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'MONGO_URI',
    'DB_NAME',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'CORS_ORIGIN',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'EMAIL_HOST', // Assuming Mailtrap/Email is essential now
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_FROM'
];

requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
        // In development, log a warning. In production, throw an error.
        const message = `Missing required environment variable: ${varName}`;
        if (process.env.NODE_ENV === 'production') {
            console.error(`FATAL ERROR: ${message}`);
            process.exit(1); // Exit if critical variable is missing in production
        } else {
            console.warn(`WARNING: ${message}. Application might not function correctly.`);
        }
    }
});

// Export configuration object
const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '5005', 10),
    // Updated apiBaseUrl to remove /v1
    apiBaseUrl: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5005}/api`,

    db: {
        uri: process.env.MONGO_URI,
        name: process.env.DB_NAME || 'konsuldok',
        options: { // Optional: Add Mongoose connection options if needed
            // useNewUrlParser: true, // Deprecated but sometimes needed for older versions
            // useUnifiedTopology: true, // Deprecated
            // autoIndex: process.env.NODE_ENV === 'development', // Auto build indexes in dev
        },
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        refreshSecret: process.env.JWT_REFRESH_SECRET, // Optional: for refresh tokens
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d', // Optional
        cookieName: process.env.JWT_COOKIE_NAME || 'konsuldok_jwt',
        cookieExpiresInDays: parseInt(process.env.JWT_COOKIE_EXPIRES_IN_DAYS || '30', 10),
    },

    cors: {
        origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*', // Handle comma-separated origins or default
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true, // Allow cookies to be sent
    },

    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // Limit each IP to 100 requests per windowMs
    },

    cloudinary: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        apiSecret: process.env.CLOUDINARY_API_SECRET,
        uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'konsuldok_uploads',
    },

    email: {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '2525', 10),
        secure: process.env.EMAIL_SECURE === 'true', // Convert string 'true' to boolean
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
        from: process.env.EMAIL_FROM || '"KonsulDok" <no-reply@konsuldok.local>',
    },

    logLevel: process.env.LOG_LEVEL || 'info',

    // Optional: Initial Admin User config (use with caution)
    // initialAdmin: {
    //     email: process.env.ADMIN_EMAIL,
    //     password: process.env.ADMIN_PASSWORD,
    //     firstName: process.env.ADMIN_FIRSTNAME || 'Admin',
    //     lastName: process.env.ADMIN_LASTNAME || 'User',
    // }
};

export default config;
