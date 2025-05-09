import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import User from '../../models/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Middleware to protect routes by verifying JWT token.
 * Expects the token to be sent in the 'Authorization' header as 'Bearer <token>'
 * or in a cookie named according to config.jwt.cookieName.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Check for token in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }
    // 2. If not in header, check for token in cookies
    else if (req.cookies && req.cookies[config.jwt.cookieName]) {
        token = req.cookies[config.jwt.cookieName];
    }

    // 3. If no token found, deny access
    if (!token) {
        throw new ApiError(401, 'Authentication required. No token provided.');
    }

    try {
        // 4. Verify the token using the JWT secret
        // The decoded payload typically contains user ID (id) and issued at timestamp (iat)
        const decoded = jwt.verify(token, config.jwt.secret);

        // 5. Find the user associated with the token's ID
        // Ensure the user is active and not soft-deleted
        // IMPORTANT: Select '+passwordChangedAt' to include the field for comparison
        const currentUser = await User.findOne({
            _id: decoded.id, // Assuming the JWT payload has 'id' field
            isActive: true,
            isDeleted: { $ne: true } // Ensure user is not soft-deleted
        }).select('+passwordChangedAt -passwordResetToken -passwordResetExpires'); // Select needed field, exclude others

        // 6. If user not found or not active, token is invalid
        if (!currentUser) {
            throw new ApiError(401, 'User belonging to this token no longer exists or is inactive.');
        }

        // 7. Check if password was changed after the token was issued (more secure)
        // This uses the passwordChangedAfter method added to the User model
        if (currentUser.passwordChangedAfter(decoded.iat)) {
            throw new ApiError(401, 'User recently changed password. Please log in again.');
        }

        // 8. Attach the user object (excluding sensitive fields not needed downstream) to the request object
        // Manually create a user object to attach if needed, to avoid attaching the Mongoose document directly
        // or ensure sensitive fields like passwordChangedAt are not inadvertently exposed later.
        // For simplicity here, we attach the fetched user, assuming downstream code is careful.
        // Consider creating a plain object: req.user = { id: currentUser.id, role: currentUser.role, ... };
        req.user = currentUser;

        next(); // Proceed to the next middleware or route handler

    } catch (error) {
        // Handle specific JWT errors
        if (error.name === 'JsonWebTokenError') {
            throw new ApiError(401, 'Invalid token. Please log in again.');
        }
        if (error.name === 'TokenExpiredError') {
            throw new ApiError(401, 'Your session has expired. Please log in again.');
        }
        // Rethrow other errors or wrap them if they are not already ApiErrors
        if (!(error instanceof ApiError)) {
			throw new ApiError(401, error.message || 'Not authorized to access this route.');
        } else {
            // Re-throw the original ApiError (e.g., from passwordChangedAfter check)
            throw error;
        }
    }
});
