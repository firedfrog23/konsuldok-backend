// src/api/controllers/user.controller.js
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/logger.js';
import {
    getUsers as getUsersService,
    getUserById as getUserByIdService,
    updateUser as updateUserService,
    deleteUser as deleteUserService,
    updateUserProfilePicture as updateUserProfilePictureService
} from '../services/user.service.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private (Admin)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    logger.info(`Controller: getAllUsers called by admin ${req.user?._id}`, { query: req.query });
    const queryOptions = { ...req.query }; // For filtering, sorting, pagination
    const result = await getUsersService(queryOptions);
    res.status(200).json(new ApiResponse(200, result, 'Users retrieved successfully.'));
});

/**
 * @desc    Get a single user by ID (Admin only)
 * @route   GET /api/users/:userId
 * @access  Private (Admin)
 */
export const getUser = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    logger.info(`Controller: getUser called by admin ${req.user?._id} for user ${userId}`);
    const user = await getUserByIdService(userId);
    res.status(200).json(new ApiResponse(200, user, 'User retrieved successfully.'));
});

/**
 * @desc    Update own user profile (basic fields, not password or picture here)
 * @route   PATCH /api/users/profile/me
 * @access  Private (Authenticated users)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id; // Get ID from authenticated user (from authenticate middleware)
    logger.info(`Controller: updateMyProfile called by user ${userId}`, { body: req.body });
    const updateData = req.body;

    // Ensure sensitive fields that have dedicated routes are not updated here
    delete updateData.password;
    delete updateData.email; // Usually email is not updatable or has a separate verification flow
    delete updateData.role;  // Role changes are admin-only
    delete updateData.profilePicture; // Handled by separate endpoint

    const updatedUser = await updateUserService(userId.toString(), updateData, req.user);
    res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully.'));
});

/**
 * @desc    Update any user by Admin
 * @route   PATCH /api/users/:userId
 * @access  Private (Admin)
 */
export const updateUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    logger.info(`Controller: updateUserByAdmin called by admin ${req.user?._id} for user ${userId}`, { body: req.body });
    const updateData = req.body;

    // Admin can update more fields, but still good to be explicit or filter in service
    delete updateData.password; // Password changes should have their own secure flow
    delete updateData.email;    // If email change is allowed, it needs verification

    const updatedUser = await updateUserService(userId, updateData, req.user); // req.user is the admin
    res.status(200).json(new ApiResponse(200, updatedUser, 'User updated successfully by admin.'));
});

/**
 * @desc    Delete any user by Admin
 * @route   DELETE /api/users/:userId
 * @access  Private (Admin)
 */
export const deleteUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    logger.warn(`Controller: deleteUserByAdmin called by admin ${req.user?._id} for user ${userId}`);
    await deleteUserService(userId, req.user); // req.user is the admin
    res.status(200).json(new ApiResponse(200, null, 'User deleted successfully by admin.'));
    // Consider res.status(204).send(); for DELETE operations with no content
});

/**
 * @desc    Update authenticated user's profile picture
 * @route   PATCH /api/users/profile/picture
 * @access  Private (Authenticated users)
 */
export const updateProfilePicture = asyncHandler(async (req, res) => {
    const userId = req.user._id; // From authenticate middleware
    logger.info(`Controller: updateProfilePicture called by user ${userId}`);

    if (!req.file) {
        throw new ApiError(400, 'No profile picture file uploaded.');
    }
    // req.file.path is where Multer temporarily saved the file
    if (!req.file.path) {
        throw new ApiError(400, 'File path not available after upload. Check Multer configuration.');
    }

    const updatedUser = await updateUserProfilePictureService(userId.toString(), req.file.path);

    res.status(200).json(new ApiResponse(200, updatedUser, 'Profile picture updated successfully.'));
});
