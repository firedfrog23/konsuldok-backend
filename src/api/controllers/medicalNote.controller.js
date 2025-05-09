// src/api/controllers/medicalNote.controller.js
// Placeholder - Handles request/response for medical note endpoints using named imports.

import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { ApiResponse } from '../../utils/ApiResponse.js'; // Adjust path
import { asyncHandler } from '../../utils/asyncHandler.js'; // Adjust path
// Import specific service functions using aliases where names conflict
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path
import {
	createMedicalNote as createMedicalNoteService, // Alias
	deleteMedicalNote as deleteMedicalNoteService // Alias
	,
	getMedicalNoteById as getMedicalNoteByIdService, // Alias
	getMedicalNotesByPatient, // Alias the imported service function
	updateMedicalNote as updateMedicalNoteService
} from '../services/medicalNote.service.js'; // Adjust path

/**
 * @desc    Create a medical note
 * @route   POST /api/notes
 * @access  Private (Doctor, Staff)
 */
export const createMedicalNote = asyncHandler(async (req, res) => {
    logger.info(`Controller: createMedicalNote called by user ${req.user?._id}`);
    const noteData = req.body;
    // Author is set in the service based on req.user
    // Call the aliased service function
    const createdNote = await createMedicalNoteService(noteData, req.user);
    res.status(201).json(new ApiResponse(201, createdNote, 'Medical note created successfully.'));
});

/**
 * @desc    Get medical notes for a patient
 * @route   GET /api/notes?patientId=...
 * @access  Private (Patient-Own, Doctor, Staff, Admin)
 */
export const getMedicalNotes = asyncHandler(async (req, res) => {
    const patientId = req.query.patientId;
    logger.info(`Controller: getMedicalNotes called by user ${req.user?._id} for patient ${patientId}`);
    if (!patientId) throw new ApiError(400, 'Patient ID query parameter is required.');

    // Permission check example
    if (req.user.role === UserRoles.PATIENT && req.user.patientProfile?.toString() !== patientId) {
		throw new ApiError(403, 'Forbidden: You can only view your own medical notes.');
    }
    // Add checks for Doctor/Staff roles if needed

    const queryOptions = { ...req.query }; // Pass other query params for filtering/pagination
    // Call service function directly
    const result = await getMedicalNotesByPatient(patientId, queryOptions);
    res.status(200).json(new ApiResponse(200, result, 'Medical notes retrieved successfully.'));
});

/**
 * @desc    Get a single medical note by ID
 * @route   GET /api/notes/:noteId
 * @access  Private (Patient-Own, Doctor, Staff, Admin)
 */
// This is the controller function declaration
export const getMedicalNoteById = asyncHandler(async (req, res) => {
    const noteId = req.params.noteId;
    logger.info(`Controller: getMedicalNoteById called by user ${req.user?._id} for note ${noteId}`);
    // Call the aliased service function
    const note = await getMedicalNoteByIdService(noteId); // Use the alias here
    // Permission check example
    if (req.user.role === UserRoles.PATIENT && note.patient?.toString() !== req.user.patientProfile?.toString()) {
		throw new ApiError(403, 'Forbidden: You cannot view this medical note.');
    }
    // Add checks for Doctor/Staff roles if needed
    res.status(200).json(new ApiResponse(200, note, 'Medical note retrieved successfully.'));
});

/**
 * @desc    Update a medical note
 * @route   PATCH /api/notes/:noteId
 * @access  Private (Doctor, Staff - Author only?)
 */
export const updateMedicalNote = asyncHandler(async (req, res) => {
    const noteId = req.params.noteId;
    logger.info(`Controller: updateMedicalNote called by user ${req.user?._id} for note ${noteId}`);
    const updateData = req.body;
    // Permission check (e.g., only author) should happen in the service
    // Call the aliased service function
    const updatedNote = await updateMedicalNoteService(noteId, updateData, req.user);
    res.status(200).json(new ApiResponse(200, updatedNote, 'Medical note updated successfully.'));
});

/**
 * @desc    Delete a medical note
 * @route   DELETE /api/notes/:noteId
 * @access  Private (Doctor, Staff, Admin - Author or Admin?)
 */
export const deleteMedicalNote = asyncHandler(async (req, res) => {
    const noteId = req.params.noteId;
    logger.warn(`Controller: deleteMedicalNote called by user ${req.user?._id} for note ${noteId}`);
    // Permission check should happen in the service
    // Call the aliased service function
    await deleteMedicalNoteService(noteId, req.user);
    res.status(200).json(new ApiResponse(200, null, 'Medical note deleted successfully.'));
    // Or res.status(204).send();
});
