// src/api/controllers/user.controller.js
// Placeholder - Handles request/response for user management endpoints using named imports.

import { ApiResponse } from '../../utils/ApiResponse.js'; // Adjust path
import { asyncHandler } from '../../utils/asyncHandler.js'; // Adjust path
// Import specific service functions
import logger from '../../utils/logger.js'; // Adjust path
import {
	deleteUser,
	getUserById,
	getUsers,
	updateUser
} from '../services/user.service.js'; // Adjust path

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/users
 * @access  Private (Admin)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
    logger.info(`Controller: getAllUsers called by admin ${req.user?._id}`);
    const queryOptions = { ...req.query }; // For filtering/pagination
    // Call service function directly
    const result = await getUsers(queryOptions);
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
    // Call service function directly
    const user = await getUserById(userId);
    res.status(200).json(new ApiResponse(200, user, 'User retrieved successfully.'));
});

/**
 * @desc    Update own user profile
 * @route   PATCH /api/users/profile/me
 * @access  Private (Authenticated users)
 */
export const updateMyProfile = asyncHandler(async (req, res) => {
    const userId = req.user._id; // Get ID from authenticated user
    logger.info(`Controller: updateMyProfile called by user ${userId}`);
    const updateData = req.body;
    // Call service function directly
    const updatedUser = await updateUser(userId, updateData, req.user); // Pass req.user for permission check in service
    res.status(200).json(new ApiResponse(200, updatedUser, 'Profile updated successfully.'));
});

/**
 * @desc    Update any user by Admin
 * @route   PATCH /api/users/:userId
 * @access  Private (Admin)
 */
export const updateUserByAdmin = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    logger.info(`Controller: updateUserByAdmin called by admin ${req.user?._id} for user ${userId}`);
    const updateData = req.body;
    // Call service function directly
    const updatedUser = await updateUser(userId, updateData, req.user); // req.user is the admin
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
    // Call service function directly
    await deleteUser(userId, req.user); // req.user is the admin
    res.status(200).json(new ApiResponse(200, null, 'User deleted successfully by admin.'));
    // Or res.status(204).send();
});
