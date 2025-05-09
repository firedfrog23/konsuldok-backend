// src/api/controllers/patient.controller.js
// Placeholder - Handles request/response for patient profile endpoints using named imports.

import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { ApiResponse } from '../../utils/ApiResponse.js'; // Adjust path
import { asyncHandler } from '../../utils/asyncHandler.js'; // Adjust path
// Import specific service functions
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path
import {
	createPatientProfile as createPatientProfileService, // Alias
	deletePatientProfile as deletePatientProfileService // Alias
	,
	getPatientProfileById, // Alias to avoid naming conflict
	getPatientProfiles,
	updatePatientProfile as updatePatientProfileService
} from '../services/patient.service.js'; // Adjust path

/**
 * @desc    Create a patient profile (Staff/Admin)
 * @route   POST /api/patients
 * @access  Private (Staff, Admin)
 */
export const createPatientProfile = asyncHandler(async (req, res) => {
    logger.info(`Controller: createPatientProfile called by user ${req.user?._id}`);
    const profileData = req.body;
    const userId = req.body.userId; // Assuming userId is passed to link to an existing User
    if (!userId) throw new ApiError(400, 'Associated User ID (userId) is required in the request body.');
    // Call service function directly (using alias)
    const createdProfile = await createPatientProfileService(profileData, userId, req.user);
    res.status(201).json(new ApiResponse(201, createdProfile, 'Patient profile created successfully.'));
});

/**
 * @desc    Get all patient profiles (Staff/Admin/Doctor)
 * @route   GET /api/patients
 * @access  Private (Staff, Admin, Doctor)
 */
export const getAllPatientProfiles = asyncHandler(async (req, res) => {
    logger.info(`Controller: getAllPatientProfiles called by user ${req.user?._id}`);
    const queryOptions = { ...req.query }; // For filtering/pagination
    // Call service function directly
    const result = await getPatientProfiles(queryOptions);
    res.status(200).json(new ApiResponse(200, result, 'Patient profiles retrieved successfully.'));
});

/**
 * @desc    Get a specific patient profile by ID
 * @route   GET /api/patients/:profileId
 * @access  Private (Staff, Admin, Doctor, Patient - Own)
 */
export const getPatientProfile = asyncHandler(async (req, res) => {
    const profileId = req.params.profileId;
    logger.info(`Controller: getPatientProfile called by user ${req.user?._id} for profile ${profileId}`);
    // Call service function directly
    const profile = await getPatientProfileById(profileId);
    // Permission check example
    if (req.user.role === UserRoles.PATIENT && req.user.patientProfile?.toString() !== profileId) {
        throw new ApiError(403, 'Forbidden: You can only access your own profile.');
    }
    res.status(200).json(new ApiResponse(200, profile, 'Patient profile retrieved successfully.'));
});

/**
 * @desc    Get own patient profile
 * @route   GET /api/patients/profile/me
 * @access  Private (Patient)
 */
export const getMyPatientProfile = asyncHandler(async (req, res) => {
    logger.info(`Controller: getMyPatientProfile called by user ${req.user?._id}`);
    if (!req.user.patientProfile) {
        throw new ApiError(404, 'Patient profile not found for this user.');
    }
    // Call service function directly
    const profile = await getPatientProfileById(req.user.patientProfile);
    res.status(200).json(new ApiResponse(200, profile, 'Patient profile retrieved successfully.'));
});

/**
 * @desc    Update a patient profile (Staff/Admin)
 * @route   PATCH /api/patients/:profileId
 * @access  Private (Staff, Admin)
 */
export const updatePatientProfile = asyncHandler(async (req, res) => {
    const profileId = req.params.profileId;
    logger.info(`Controller: updatePatientProfile called by user ${req.user?._id} for profile ${profileId}`);
    const updateData = req.body;
    // Permission check (Staff/Admin) is handled by the route middleware
    // Call service function directly (using alias)
    const updatedProfile = await updatePatientProfileService(profileId, updateData, req.user);
    res.status(200).json(new ApiResponse(200, updatedProfile, 'Patient profile updated successfully.'));
});

/**
 * @desc    Delete a patient profile (Admin only)
 * @route   DELETE /api/patients/:profileId
 * @access  Private (Admin)
 */
export const deletePatientProfile = asyncHandler(async (req, res) => {
    const profileId = req.params.profileId;
    logger.warn(`Controller: deletePatientProfile called by admin ${req.user?._id} for profile ${profileId}`);
    // Permission check (Admin) is handled by the route middleware
    // Call service function directly (using alias)
    await deletePatientProfileService(profileId, req.user);
    res.status(200).json(new ApiResponse(200, null, 'Patient profile deleted successfully.'));
    // Or res.status(204).send();
});
