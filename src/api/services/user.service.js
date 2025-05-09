import DoctorProfile from '../../models/doctorProfile.model.js'; // Adjust path
import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import StaffProfile from '../../models/staffProfile.model.js'; // Adjust path
import User from '../../models/user.model.js'; // Adjust path
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Get a list of users (potentially with filtering/pagination).
 * @param {object} queryOptions - Options for filtering (role, isActive), sorting, pagination (limit, page).
 * @returns {Promise<object>} Object containing list of users and pagination info.
 */
export const getUsers = async (queryOptions = {}) => {
    logger.debug('UserService: Fetching users with options:', queryOptions);
    const { role, isActive, sortBy = 'createdAt', order = 'desc', limit = 10, page = 1 } = queryOptions;

    const filter = { isDeleted: { $ne: true } }; // Exclude soft-deleted users
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true; // Handle string 'true'/'false'

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
            .select('-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires') // Exclude sensitive fields
            .populate('patientProfile', 'dateOfBirth gender') // Example population
            .populate('doctorProfile', 'specialty licenseNumber') // Example population
            .populate('staffProfile', 'jobTitle department'); // Example population

        const totalCount = await User.countDocuments(filter);

        return {
            users,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error('UserService: Error fetching users:', error);
        throw new ApiError(500, 'Failed to retrieve users.');
    }
};

/**
 * Get a single user by ID.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<object>} The user document.
 */
export const getUserById = async (userId) => {
    logger.debug('UserService: Fetching user by ID:', userId);
    const user = await User.findOne({ _id: userId, isDeleted: { $ne: true } })
        .select('-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires')
        .populate('patientProfile') // Populate all linked profiles
        .populate('doctorProfile')
        .populate('staffProfile');

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
    logger.debug(`UserService: Updating user ${userId} by user ${requestingUser?._id}`);
    const userToUpdate = await User.findOne({ _id: userId, isDeleted: { $ne: true } });

    if (!userToUpdate) {
        throw new ApiError(404, 'User not found.');
    }

    // Permission Check
    const isAdmin = requestingUser.role === UserRoles.ADMIN;
    const isSelf = userToUpdate._id.equals(requestingUser._id);

    if (!isAdmin && !isSelf) {
        throw new ApiError(403, 'Forbidden: You are not authorized to update this user.');
    }

    // Filter updateData based on permissions
    const allowedUpdates = {};
    const selfAllowedFields = ['firstName', 'lastName', 'phoneNumber']; // Fields user can update for themselves
    const adminAllowedFields = [...selfAllowedFields, 'role', 'isActive']; // Fields admin can update

    const fieldsToUpdate = isAdmin ? adminAllowedFields : selfAllowedFields;

    for (const key in updateData) {
        if (fieldsToUpdate.includes(key)) {
            allowedUpdates[key] = updateData[key];
        } else {
			logger.warn(`UserService: Attempted unauthorized update of field '${key}' on user ${userId} by user ${requestingUser._id}`);
        }
    }

    // Prevent updating sensitive fields directly
    delete allowedUpdates.email;
    delete allowedUpdates.password;
    delete allowedUpdates.passwordChangedAt;
    // Role change might require profile adjustments - handle with caution or disallow here

    if (Object.keys(allowedUpdates).length === 0) {
		throw new ApiError(400, 'No valid fields provided for update.');
    }

    // Set audit field
    allowedUpdates.updatedBy = requestingUser._id;

    // Update the user
    Object.assign(userToUpdate, allowedUpdates);
    await userToUpdate.save();

    // Re-fetch to apply default selects and populate profiles
    const updatedUser = await getUserById(userId);
    logger.info(`User ${userId} updated successfully by ${requestingUser._id}`);
    return updatedUser;
};

/**
 * Delete a user (soft delete) - Admin only.
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

    // Perform soft delete using the method from the plugin
    await userToDelete.softDelete(requestingUser._id);

    // Optionally deactivate related profiles or perform other cleanup
    // Example: Deactivate profiles (could also be soft-deleted if plugin applied)
    try {
        if (userToDelete.patientProfile) await PatientProfile.findByIdAndUpdate(userToDelete.patientProfile, { $set: { updatedBy: requestingUser._id } }); // Add isActive?
        if (userToDelete.doctorProfile) await DoctorProfile.findByIdAndUpdate(userToDelete.doctorProfile, { $set: { updatedBy: requestingUser._id } });
        if (userToDelete.staffProfile) await StaffProfile.findByIdAndUpdate(userToDelete.staffProfile, { $set: { updatedBy: requestingUser._id } });
    } catch (profileError) {
        logger.error(`UserService: Error during profile cleanup for deleted user ${userId}`, profileError);
        // Decide if this should cause the operation to fail
    }

    logger.info(`User ${userId} soft deleted successfully by admin ${requestingUser._id}`);
};
