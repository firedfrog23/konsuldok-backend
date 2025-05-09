import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';
import {
    getUserProfile,
    loginUser,
    registerUser,
    requestPasswordReset,
    resetPasswordWithToken
} from '../services/auth.service.js';

// --- Cookie Options ---
const cookieOptions = {
    httpOnly: true, secure: config.nodeEnv === 'production', sameSite: 'strict',
    maxAge: config.jwt.cookieExpiresInDays * 24 * 60 * 60 * 1000,
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = asyncHandler(async (req, res) => {
    logger.info('Controller: register called');
    const userData = req.body;
    const { user, accessToken } = await registerUser(userData);
    res.cookie(config.jwt.cookieName, accessToken, cookieOptions);
    res.status(201).json(new ApiResponse(201, { user, accessToken }, 'User registered successfully.'));
});

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = asyncHandler(async (req, res) => {
    logger.info('Controller: login called');
    const { email, password } = req.body;
    const { user, accessToken } = await loginUser(email, password);
    res.cookie(config.jwt.cookieName, accessToken, cookieOptions);
    res.status(200).json(new ApiResponse(200, { user, accessToken }, 'Login successful.'));
});

/**
 * @desc    Log user out
 * @route   POST /api/auth/logout
 * @access  Private (Requires authentication)
 */
export const logout = asyncHandler(async (req, res) => {
    logger.info(`Controller: logout called by user ${req.user?._id}`);
    res.cookie(config.jwt.cookieName, '', { ...cookieOptions, expires: new Date(0) });
    res.status(200).json(new ApiResponse(200, null, 'Logout successful.'));
});

/**
 * @desc    Get current logged-in user with populated profile
 * @route   GET /api/auth/me
 * @access  Private (Requires authentication)
 */
export const getMe = asyncHandler(async (req, res) => {
    logger.info(`Controller: getMe called by user ${req.user?._id}`);
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!userId || !userRole) {
        throw new ApiError(401, 'User information missing from request.');
    }

    const userWithProfile = await getUserProfile(userId, userRole);

    res.status(200).json(
        new ApiResponse(200, userWithProfile, 'Current user data fetched.')
    );
});

/**
 * @desc    Forgot password - request reset token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = asyncHandler(async (req, res) => {
    logger.info('Controller: forgotPassword called');
    await requestPasswordReset(req.body.email);
    res.status(200).json(new ApiResponse(200, null, 'If an account with that email exists, a password reset link has been sent.'));
});

/**
 * @desc    Reset password using token
 * @route   PATCH /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = asyncHandler(async (req, res) => {
    logger.info('Controller: resetPassword called');
    await resetPasswordWithToken(req.params.token, req.body.password);
    res.cookie(config.jwt.cookieName, '', { ...cookieOptions, expires: new Date(0) });
    res.status(200).json(new ApiResponse(200, null, 'Password has been reset successfully. Please log in.'));
});
