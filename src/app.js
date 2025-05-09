import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { globalErrorHandler } from './api/middleware/globalErrorHandler.js';
import { apiRateLimiter } from './api/middleware/rateLimiter.js';
import apiRoutes from './api/routes/index.js'; // Correct: Imports from ./api/routes/
import config from './config/index.js'; // Correct: Imports from ./config/
import { ApiError } from './utils/ApiError.js'; // Correct: Imports from ./utils/

// Initialize Express app
const app = express();

// --- Core Middleware Setup ---

// 1. Enable CORS - Cross-Origin Resource Sharing
app.use(cors({
    origin: config.cors.origin,
    methods: config.cors.methods,
    credentials: config.cors.credentials,
    allowedHeaders: config.cors.allowedHeaders
}));

// 2. Set various HTTP headers for security
app.use(helmet());

// 3. Parse incoming JSON requests
app.use(express.json({ limit: '16kb' }));

// 4. Parse incoming URL-encoded requests
app.use(express.urlencoded({ extended: true, limit: '16kb' }));

// 5. Parse cookies
app.use(cookieParser());

// 6. Log HTTP requests
if (config.nodeEnv === 'development') {
    app.use(morgan('dev'));
}

// 7. Apply basic API rate limiting
app.use('/api', apiRateLimiter);


// --- API Routes ---
// Mount the main API router under the /api path (no /v1)
app.use('/api', apiRoutes);


// --- Health Check Route ---
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
});


// --- Not Found Handler ---
app.all('*', (req, res, next) => {
    next(new ApiError(404, `Route not found: Can't find ${req.originalUrl} on this server!`));
});


// --- Global Error Handling Middleware ---
app.use(globalErrorHandler);


// Export the configured Express app
export default app;
