import { ApiError } from '../../utils/ApiError.js';

/**
 * Creates a middleware function that checks if the authenticated user's role
 * is included in the list of allowed roles.
 *
 * @param {...string} allowedRoles - A list of role strings (e.g., 'Admin', 'Doctor').
 * @returns {Function} Express middleware function.
 */
export const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        // Check if req.user exists (should be added by authenticate middleware)
        if (!req.user || !req.user.role) {
            // This should technically not happen if authenticate runs first
            return next(new ApiError(401, 'Authentication required before authorization.'));
        }

        // Check if the user's role is included in the allowed roles for this route
        if (!allowedRoles.includes(req.user.role)) {
            return next(new ApiError(
                403, // Forbidden
                `Forbidden. Your role (${req.user.role}) is not authorized to access this resource.`
            ));
        }

        // User has the required role, proceed to the next middleware/handler
        next();
    };
};
