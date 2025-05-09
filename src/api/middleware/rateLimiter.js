import rateLimit from 'express-rate-limit';
import config from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Creates a rate limiter middleware instance using configuration from .env.
 */
export const apiRateLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs, // Time window (e.g., 15 minutes)
    max: config.rateLimit.max, // Max requests per window per IP
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: (req, res) => {
        // Custom message or error handling when limit is exceeded
        // Throwing ApiError integrates with the global error handler
        throw new ApiError(
            429, // Too Many Requests status code
            'Too many requests from this IP, please try again after a short break.'
        );
    },
});

// Different limiters for different routes (e.g., stricter for login)
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit login attempts more strictly
    standardHeaders: true,
    legacyHeaders: false,
    message: (req, res) => {
        throw new ApiError(429, 'Too many login attempts. Please try again later.');
    },
    keyGenerator: (req, res) => req.ip, // Limit login attempts by IP
});
