// src/api/services/user.service.js
import fs from 'fs/promises'; // Use promise-based fs for async cleanup
import path from 'path';
import { cloudinary } from '../../config/cloudinary.js'; // Your Cloudinary config
import config from '../../config/index.js'; // For Cloudinary folder
import User from '../../models/user.model.js';
import PatientProfile from '../../models/patientProfile.model.js'; // For profile deletion cascade
import DoctorProfile from '../../models/doctorProfile.model.js';   // For profile deletion cascade
import StaffProfile from '../../models/staffProfile.model.js';     // For profile deletion cascade
import { ApiError } from '../../utils/ApiError.js';
import { UserRoles } from '../../utils/constants.js';
import logger from '../../utils/logger.js';

// Helper function to upload to Cloudinary and cleanup local file
const uploadToCloudinary = async (localFilePath, userId) => {
    try {
        logger.info(`Uploading file ${localFilePath} to Cloudinary for user ${userId}...`);
        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: `${config.cloudinary.uploadFolder}/profile_pictures`, // Specific subfolder
            public_id: `user_${userId}_${Date.now()}`, // Unique public_id
            resource_type: "image", // Explicitly set resource type
            transformation: [ // Example transformations for profile pictures
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto:good" }
            ]
        });
        logger.info(`Cloudinary upload successful: ${result.public_id}`);
        return { url: result.secure_url, publicId: result.public_id };
    } catch (uploadError) {
        // Log the detailed error from Cloudinary
        logger.error(`Cloudinary upload failed for ${localFilePath}: ${uploadError.message}`, { error: uploadError });
        // Rethrow a more generic error or the original, depending on desired exposure
        throw new ApiError(500, `Cloudinary upload failed: ${uploadError.message}`);
    } finally {
        // Always attempt to delete the temporary local file
        try {
            await fs.unlink(localFilePath);
            logger.debug(`Successfully removed temp file: ${localFilePath}`);
        } catch (unlinkError) {
            logger.error(`Failed to remove temp file ${localFilePath} after Cloudinary operation: ${unlinkError.message}`);
            // Don't let this error block the main operation if upload was successful
            // But it's important to log it for cleanup monitoring.
        }
    }
};

// Helper function to delete from Cloudinary
const deleteFromCloudinary = async (publicId) => {
    if (!publicId) {
        logger.debug('No Cloudinary publicId provided for deletion.');
        return;
    }
    try {
        logger.info(`Deleting image ${publicId} from Cloudinary...`);
        await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
        logger.info(`Successfully deleted ${publicId} from Cloudinary.`);
    } catch (error) {
        logger.error(`Failed to delete ${publicId} from Cloudinary: ${error.message}`);
        // Log error but don't necessarily throw, as user record update might be more critical
        // Or, depending on policy, you might want to rethrow or handle differently.
    }
};

/**
 * Get a list of users (potentially with filtering/pagination).
 * @param {object} queryOptions - Options for filtering (role, isActive), sorting, pagination (limit, page).
 * @returns {Promise<object>} Object containing list of users and pagination info.
 */
export const getUsers = async (queryOptions = {}) => {
    logger.debug('UserService: Fetching users with options:', queryOptions);
    const { role, isActive, sortBy = 'createdAt', order = 'desc', limit = 10, page = 1, search } = queryOptions;

    const filter = { isDeleted: { $ne: true } };
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

    // Basic search: searches firstName, lastName, email
    if (search) {
        const searchRegex = new RegExp(search, 'i'); // Case-insensitive search
        filter.$or = [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex }
        ];
    }

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    try {
        const users = await User.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limitValue)
            .select('-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires -updatedBy -createdBy -deletedBy -deletedAt') // Exclude more audit fields from list view
            .populate('patientProfile', 'dateOfBirth gender')
            .populate('doctorProfile', 'specialty')
            .populate('staffProfile', 'jobTitle department');

        const totalCount = await User.countDocuments(filter);

        return {
            users,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error('UserService: Error fetching users:', { error: error.message, stack: error.stack });
        throw new ApiError(500, 'Failed to retrieve users.');
    }
};

/**
 * Get a single user by ID.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} The user document.
 */
export const getUserById = async (userId) => {
    logger.debug(`UserService: Fetching user by ID: ${userId}`);
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
        .select('-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires')
        // Populate more details if needed for a single user view
        .populate({
            path: 'patientProfile',
            select: '-createdBy -updatedBy -deletedBy -deletedAt -isDeleted -__v' // Exclude audit fields from populated profile
        })
        .populate({
            path: 'doctorProfile',
            select: '-createdBy -updatedBy -deletedBy -deletedAt -isDeleted -__v'
        })
        .populate({
            path: 'staffProfile',
            select: '-createdBy -updatedBy -deletedBy -deletedAt -isDeleted -__v'
        });

    if (!user) {
        throw new ApiError(404, 'User not found.');
    }
    return user;
};

/**
 * Update user details (callable by admin or user themselves).
 * @param {string} userId - The ID of the user to update.
 * @param {object} updateData - Data to update.
 * @param {object} requestingUser - The user performing the update (for permissions/audit).
 * @returns {Promise<object>} The updated user document.
 */
export const updateUser = async (userId, updateData, requestingUser) => {
    logger.debug(`UserService: Updating user ${userId} by user ${requestingUser?._id}`, { updateData });
    const userToUpdate = await User.findOne({ _id: userId, isDeleted: { $ne: true } });

    if (!userToUpdate) {
        throw new ApiError(404, 'User not found.');
    }

    const isAdmin = requestingUser.role === UserRoles.ADMIN;
    const isSelf = userToUpdate._id.equals(requestingUser._id);

    if (!isAdmin && !isSelf) {
        throw new ApiError(403, 'Forbidden: You are not authorized to update this user.');
    }

    const allowedUpdates = {};
    // Fields user can update for themselves (excluding profile picture here, handled separately)
    const selfAllowedFields = ['firstName', 'lastName', 'phoneNumber'];
    // Fields admin can update (excluding profile picture)
    const adminAllowedFields = [...selfAllowedFields, 'role', 'isActive'];

    const fieldsToUpdateByRole = isAdmin ? adminAllowedFields : selfAllowedFields;

    for (const key in updateData) {
        if (fieldsToUpdateByRole.includes(key)) {
            if (updateData[key] !== undefined && updateData[key] !== null) { // Ensure value is not undefined/null before assigning
                allowedUpdates[key] = updateData[key];
            }
        } else {
            logger.warn(`UserService: Attempted unauthorized or invalid update of field '${key}' on user ${userId} by user ${requestingUser._id}`);
        }
    }

    // Prevent direct update of sensitive or restricted fields
    delete allowedUpdates.email;
    delete allowedUpdates.password;
    delete allowedUpdates.passwordChangedAt;
    delete allowedUpdates.profilePictureUrl; // Handled by dedicated function
    delete allowedUpdates.profilePictureCloudinaryId; // Handled by dedicated function

    // Handle role change implications (e.g., clear other profile IDs if role changes)
    if (isAdmin && allowedUpdates.role && allowedUpdates.role !== userToUpdate.role) {
        logger.info(`Role changing for user ${userId} from ${userToUpdate.role} to ${allowedUpdates.role}. Clearing other profile IDs.`);
        if (allowedUpdates.role !== UserRoles.PATIENT) userToUpdate.patientProfile = null;
        if (allowedUpdates.role !== UserRoles.DOCTOR) userToUpdate.doctorProfile = null;
        if (allowedUpdates.role !== UserRoles.STAFF) userToUpdate.staffProfile = null;
        // Note: Creating new profiles upon role change should be a separate, explicit admin action.
    }


    if (Object.keys(allowedUpdates).length === 0) {
        logger.info(`UserService: No valid fields provided for update for user ${userId}. Returning current user data.`);
        return getUserById(userId); // Return current user if no valid updates
    }

    allowedUpdates.updatedBy = requestingUser._id;

    Object.assign(userToUpdate, allowedUpdates);
    await userToUpdate.save();

    const updatedUser = await getUserById(userId);
    logger.info(`User ${userId} updated successfully by ${requestingUser._id}`);
    return updatedUser;
};

/**
 * Delete a user (soft delete) - Admin only.
 * Also soft deletes associated profiles.
 * @param {string} userId - The ID of the user to delete.
 * @param {object} requestingUser - The user performing the deletion (must be Admin).
 * @returns {Promise<void>}
 */
export const deleteUser = async (userId, requestingUser) => {
    logger.warn(`UserService: Attempting delete for user ${userId} by admin ${requestingUser?._id}`);
    if (requestingUser.role !== UserRoles.ADMIN) {
        throw new ApiError(403, 'Forbidden: Only administrators can delete users.');
    }
    if (userId === requestingUser._id.toString()) {
        throw new ApiError(400, 'Administrators cannot delete their own account.');
    }

    const userToDelete = await User.findOne({ _id: userId, isDeleted: { $ne: true } });

    if (!userToDelete) {
        throw new ApiError(404, 'User not found or already deleted.');
    }

    // Soft delete the User document
    await userToDelete.softDelete(requestingUser._id);

    // Soft delete associated profiles
    try {
        if (userToDelete.patientProfile) {
            const patientProfile = await PatientProfile.findById(userToDelete.patientProfile);
            if (patientProfile) await patientProfile.softDelete(requestingUser._id);
        }
        if (userToDelete.doctorProfile) {
            const doctorProfile = await DoctorProfile.findById(userToDelete.doctorProfile);
            if (doctorProfile) await doctorProfile.softDelete(requestingUser._id);
        }
        if (userToDelete.staffProfile) {
            const staffProfile = await StaffProfile.findById(userToDelete.staffProfile);
            if (staffProfile) await staffProfile.softDelete(requestingUser._id);
        }
    } catch (profileError) {
        logger.error(`UserService: Error during profile soft-deletion for deleted user ${userId}`, { error: profileError.message, stack: profileError.stack });
        // Decide if this should cause the operation to fail or just log
    }

    // Note: Deleting Cloudinary profile picture for a soft-deleted user might be desired
    // but is not done here to keep the soft-delete reversible.
    // If permanent deletion with asset removal is needed, that's a different function.

    logger.info(`User ${userId} and associated profiles soft-deleted successfully by admin ${requestingUser._id}`);
};

/**
 * Updates the profile picture for a user.
 * @param {string} userId - The ID of the user to update.
 * @param {string} localFilePath - The path to the temporarily uploaded file on the server.
 * @returns {Promise<object>} The updated user document.
 */
export const updateUserProfilePicture = async (userId, localFilePath) => {
    logger.debug(`UserService: Updating profile picture for user ${userId}`);

    if (!localFilePath) {
        throw new ApiError(400, 'No file provided for profile picture update.');
    }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
        try { await fs.unlink(localFilePath); } catch (e) { logger.error('Temp file cleanup failed for non-existent user during profile picture update.');}
        throw new ApiError(404, 'User not found.');
    }

    // If user already has a profile picture, delete the old one from Cloudinary
    if (userToUpdate.profilePictureCloudinaryId) {
        await deleteFromCloudinary(userToUpdate.profilePictureCloudinaryId);
    }

    // Upload the new picture to Cloudinary
    const { url: newImageUrl, publicId: newImagePublicId } = await uploadToCloudinary(localFilePath, userId);

    // Update user document with new picture details
    userToUpdate.profilePictureUrl = newImageUrl;
    userToUpdate.profilePictureCloudinaryId = newImagePublicId;
    userToUpdate.updatedBy = userId; // User updates their own picture

    await userToUpdate.save();

    const updatedUser = await getUserById(userId);
    logger.info(`Profile picture updated successfully for user ${userId}`);
    return updatedUser;
};
