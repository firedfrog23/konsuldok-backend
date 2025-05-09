import mongoose from 'mongoose';

import config from '../../config/index.js';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';

/**
 * Global error handling middleware.
 * It catches errors, formats them, logs them, and sends a standardized JSON response.
 *
 * @param {Error | ApiError} err - The error object.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function (unused here but required by Express).
 */
export const globalErrorHandler = (err, req, res, next) => {
    // Default error details
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || [];
    let stack = err.stack;

    // Log the error (using Winston logger)
    // Log full details in development, less in production
    logger.error(`${statusCode} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, {
        stack: config.nodeEnv === 'development' ? stack : undefined, // Only log stack in dev
        errors: errors, // Log validation errors if present
    });

    // Handle specific error types for better client responses

    // Mongoose Bad ObjectId Error
    if (err instanceof mongoose.Error.CastError && err.kind === 'ObjectId') {
        const castErrorMessage = `Invalid ${err.path}: ${err.value}. Resource not found with this ID.`;
        const apiError = new ApiError(400, castErrorMessage);
        statusCode = apiError.statusCode;
        message = apiError.message;
        errors = apiError.errors;
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        // Extract the field that caused the duplicate error
        const field = Object.keys(err.keyValue)[0];
        const value = err.keyValue[field];
        const duplicateKeyMessage = `Duplicate value entered for ${field}: '${value}'. Please use another value.`;
        const apiError = new ApiError(400, duplicateKeyMessage);
        statusCode = apiError.statusCode;
        message = apiError.message;
        errors = apiError.errors;
    }

    // Mongoose Validation Error
    if (err instanceof mongoose.Error.ValidationError) {
        const validationErrors = Object.values(err.errors).map(el => ({
            field: el.path,
            message: el.message,
        }));
        const validationMessage = 'Invalid input data. Please check the following fields.';
        const apiError = new ApiError(400, validationMessage, validationErrors);
        statusCode = apiError.statusCode;
        message = apiError.message;
        errors = apiError.errors;
    }

    // JWT Errors (already handled in authenticate, but catch here just in case)
    if (err.name === 'JsonWebTokenError') {
        const jwtErrorMessage = 'Invalid token. Please log in again.';
        const apiError = new ApiError(401, jwtErrorMessage);
        statusCode = apiError.statusCode;
        message = apiError.message;
        errors = apiError.errors;
    }
    if (err.name === 'TokenExpiredError') {
        const jwtExpiredMessage = 'Your session has expired. Please log in again.';
        const apiError = new ApiError(401, jwtExpiredMessage);
        statusCode = apiError.statusCode;
        message = apiError.message;
        errors = apiError.errors;
    }

    // If it's not an ApiError we explicitly threw, create one for consistent structure
    // But keep the original status code and message if available
    if (!(err instanceof ApiError)) {
        // Hide detailed error messages in production for non-operational errors
        if (config.nodeEnv === 'production' && !err.isOperational) {
            message = 'Something went very wrong on the server.';
            errors = []; // Don't leak internal error details
        }
    } else {
        // If it is an ApiError, use its properties
        statusCode = err.statusCode;
        message = err.message;
        errors = err.errors;
    }


    // Send the standardized JSON response
    res.status(statusCode).json({
        success: false,
        message: message,
        ...(errors && errors.length > 0 && { errors: errors }),
        ...(config.nodeEnv === 'development' && { stack: stack }),
    });
};
