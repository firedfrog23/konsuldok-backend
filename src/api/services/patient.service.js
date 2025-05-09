import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import User from '../../models/user.model.js'; // Adjust path (needed for linking)
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Create a patient profile (linked to an existing user).
 * @param {object} profileData - Patient profile data.
 * @param {string} userId - The ID of the associated User account.
 * @param {object} createdByUser - The user performing the creation (for audit).
 * @returns {Promise<object>} The created patient profile document.
 */
export const createPatientProfile = async (profileData, userId, createdByUser) => {
    logger.debug(`PatientService: Creating profile for user ${userId} by user ${createdByUser._id}`);

    // 1. Check if user exists and is a Patient
    const user = await User.findById(userId);
    if (!user || user.role !== UserRoles.PATIENT) {
        throw new ApiError(404, 'Patient user account not found or invalid role.');
    }
    // 2. Check if user already has a patient profile linked
    if (user.patientProfile) {
        throw new ApiError(400, 'User already has an associated patient profile.');
    }

    // 3. Create new PatientProfile document
    const newProfile = new PatientProfile({
        ...profileData,
        userAccount: userId, // Link to the User model
        createdBy: createdByUser._id, // Set audit field
    });
    await newProfile.save();

    // 4. Update the User document to link the new profile
    user.patientProfile = newProfile._id;
    user.updatedBy = createdByUser._id; // Also mark user as updated
    await user.save({ validateBeforeSave: false }); // Avoid re-running user validators if only linking

    logger.info(`Patient profile ${newProfile._id} created successfully for user ${userId}`);
    return newProfile;
};

/**
 * Get a list of patient profiles (for staff/admin/doctor view).
 * @param {object} queryOptions - Filtering (name?), sorting, pagination (limit, page).
 * @returns {Promise<object>} List of profiles and pagination info.
 */
export const getPatientProfiles = async (queryOptions = {}) => {
    logger.debug('PatientService: Fetching patient profiles with options:', queryOptions);
    const { sortBy = 'createdAt', order = 'desc', limit = 10, page = 1, search } = queryOptions;

    const filter = { isDeleted: { $ne: true } };
    // Note: Searching by name requires querying the linked User model, which is more complex.
    // Simple approach: Fetch profiles and filter later, or implement aggregation pipeline.
    // We'll skip search filter here for placeholder simplicity.

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    try {
        const profiles = await PatientProfile.find(filter)
            .populate({ // Populate linked user account details
                path: 'userAccount',
                select: 'firstName lastName email phoneNumber isActive' // Select desired fields
            })
            .sort(sort)
            .skip(skip)
            .limit(limitValue)
            .select('-__v'); // Exclude internal version key

        const totalCount = await PatientProfile.countDocuments(filter);

        return {
            profiles,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error('PatientService: Error fetching patient profiles:', error);
        throw new ApiError(500, 'Failed to retrieve patient profiles.');
    }
};

/**
 * Get a single patient profile by its ID.
 * @param {string} profileId - The ID of the profile.
 * @returns {Promise<object>} The patient profile document populated with user info.
 */
export const getPatientProfileById = async (profileId) => {
    logger.debug(`PatientService: Fetching patient profile by Profile ID: ${profileId}`);
    const profile = await PatientProfile.findOne({ _id: profileId, isDeleted: { $ne: true } })
        .populate({
            path: 'userAccount',
            select: 'firstName lastName email phoneNumber isActive role'
        })
        .select('-__v');

    if (!profile) {
        throw new ApiError(404, 'Patient profile not found.');
    }
    // Check if the linked user account is active/not deleted if necessary
    // if (!profile.userAccount || !profile.userAccount.isActive || profile.userAccount.isDeleted) {
    //     throw new ApiError(404, 'Associated user account is inactive or not found.');
    // }
    return profile;
};

/**
 * Update a patient profile.
 * @param {string} profileId - The ID of the profile to update.
 * @param {object} updateData - Data to update.
 * @param {object} updatedByUser - The user performing the update (Staff/Admin).
 * @returns {Promise<object>} The updated patient profile document.
 */
export const updatePatientProfile = async (profileId, updateData, updatedByUser) => {
    logger.debug(`PatientService: Updating profile ${profileId} by user ${updatedByUser._id}`);
    // Permission check (Staff/Admin) is handled by route middleware/controller

    const profileToUpdate = await PatientProfile.findOne({ _id: profileId, isDeleted: { $ne: true } });
    if (!profileToUpdate) {
        throw new ApiError(404, 'Patient profile not found.');
    }

    // Prevent updating the userAccount link
    delete updateData.userAccount;

    // Set audit field
    updateData.updatedBy = updatedByUser._id;

    // Update the profile
    Object.assign(profileToUpdate, updateData);
    await profileToUpdate.save();

    // Re-fetch to populate user account details
    const updatedProfile = await getPatientProfileById(profileId);
    logger.info(`Patient profile ${profileId} updated successfully by ${updatedByUser._id}`);
    return updatedProfile;
};

/**
 * Delete a patient profile (soft delete) - Admin only.
 * Also handles associated User account (deactivate or soft delete).
 * @param {string} profileId - The ID of the PatientProfile to delete.
 * @param {object} deletedByUser - The user performing the deletion (Admin).
 * @returns {Promise<void>}
 */
export const deletePatientProfile = async (profileId, deletedByUser) => {
    logger.warn(`PatientService: Attempting delete for patient profile ${profileId} by admin ${deletedByUser._id}`);
    if (deletedByUser.role !== UserRoles.ADMIN) {
		throw new ApiError(403, 'Forbidden: Only administrators can delete patient profiles.');
    }

    const profileToDelete = await PatientProfile.findOne({ _id: profileId, isDeleted: { $ne: true } });
    if (!profileToDelete) {
        throw new ApiError(404, 'Patient profile not found or already deleted.');
    }

    // Find and soft-delete the associated User account
    const userAccount = await User.findById(profileToDelete.userAccount);
    if (userAccount) {
        await userAccount.softDelete(deletedByUser._id);
        logger.info(`Associated user account ${userAccount._id} soft deleted.`);
    } else {
        logger.warn(`Associated user account not found for patient profile ${profileId}.`);
    }

    // Soft delete the PatientProfile
    await profileToDelete.softDelete(deletedByUser._id);

    // TODO: Consider cleanup logic for appointments, notes, documents?

    logger.info(`Patient profile ${profileId} soft deleted successfully by admin ${deletedByUser._id}`);
};
