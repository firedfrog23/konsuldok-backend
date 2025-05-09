import { validationResult } from 'express-validator';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Middleware that checks for validation errors collected by express-validator.
 * If errors exist, it throws an ApiError with a 400 status code and the errors.
 * Otherwise, it calls the next middleware.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const validate = (req, res, next) => {
    // Get validation errors from the request
    const errors = validationResult(req);

    // Check if there are any validation errors
    if (!errors.isEmpty()) {
        // Format errors for consistent response structure
        const extractedErrors = errors.array().map(err => ({
            field: err.param,
            message: err.msg,
        }));

        // Throw an ApiError with 400 status and the extracted errors
        // Use 422 Unprocessable Entity if preferred for validation errors
        throw new ApiError(400, 'Validation Failed', extractedErrors);
    }

    next();
};
