import mongoose from 'mongoose';
import MedicalNote from '../../models/medicalNote.model.js'; // Adjust path
import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Create a new medical note.
 * @param {object} noteData - Note details (patientId, content, tags, consultationDate, appointmentId).
 * @param {object} authorUser - The Doctor/Staff user creating the note.
 * @returns {Promise<object>} The created medical note document.
 */
export const createMedicalNote = async (noteData, authorUser) => {
    const { patient: patientProfileId, noteContent, tags, consultationDate, appointment: appointmentId } = noteData;
    logger.debug(`MedicalNoteService: Creating note by user ${authorUser._id} for patient ${patientProfileId}`);

    // 1. Check author role
    if (![UserRoles.DOCTOR, UserRoles.STAFF].includes(authorUser.role)) {
        throw new ApiError(403, 'Forbidden: Only Doctors or Staff can create medical notes.');
    }
    // 2. Validate patientId exists
    const patientExists = await PatientProfile.countDocuments({ _id: patientProfileId, isDeleted: { $ne: true } });
    if (!patientExists) {
        throw new ApiError(404, `Patient profile not found with ID: ${patientProfileId}`);
    }
    // 3. Validate appointmentId if provided
    if (appointmentId) {
        const appointmentExists = await mongoose.model('Appointment').countDocuments({ _id: appointmentId, isDeleted: { $ne: true } });
        if (!appointmentExists) throw new ApiError(404, `Appointment not found with ID: ${appointmentId}`);
    }

    // 4. Create new MedicalNote document
    const newNote = new MedicalNote({
        patient: patientProfileId,
        authoredBy: authorUser._id, // User who wrote the note
        consultationDate: consultationDate || new Date(), // Default to now if not provided
        noteContent,
        tags,
        appointment: appointmentId,
        createdBy: authorUser._id, // User who created the record
    });

    await newNote.save();
    logger.info(`Medical note ${newNote._id} created successfully by ${authorUser._id}`);

    // Populate details before returning
    return getMedicalNoteById(newNote._id);
};

/**
 * Get medical notes for a specific patient.
 * @param {string} patientId - The ID of the PatientProfile.
 * @param {object} queryOptions - Filtering (date range), sorting, pagination (limit, page).
 * @returns {Promise<object>} List of notes and pagination info.
 */
export const getMedicalNotesByPatient = async (patientId, queryOptions = {}) => {
    logger.debug(`MedicalNoteService: Fetching notes for patient ${patientId} with options:`, queryOptions);
    const { startDate, endDate, sortBy = 'consultationDate', order = 'desc', limit = 10, page = 1 } = queryOptions;

    const filter = { patient: patientId, isDeleted: { $ne: true } };
    if (startDate || endDate) {
        filter.consultationDate = {};
        if (startDate) filter.consultationDate.$gte = new Date(startDate);
        if (endDate) filter.consultationDate.$lte = new Date(endDate);
    }

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    try {
        const notes = await MedicalNote.find(filter)
            .populate('authoredBy', 'firstName lastName role') // Populate author details
            .sort(sort)
            .skip(skip)
            .limit(limitValue)
            .select('-__v');

        const totalCount = await MedicalNote.countDocuments(filter);

        return {
            notes,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error(`MedicalNoteService: Error fetching notes for patient ${patientId}:`, error);
        throw new ApiError(500, 'Failed to retrieve medical notes.');
    }
};

/**
 * Get a single medical note by ID.
 * @param {string} noteId - The ID of the note.
 * @returns {Promise<object>} The medical note document populated with author/patient.
 */
export const getMedicalNoteById = async (noteId) => {
    logger.debug('MedicalNoteService: Fetching note by ID:', noteId);
    const note = await MedicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } })
        .populate('authoredBy', 'firstName lastName role')
        .populate({ path: 'patient', select: 'userAccount', populate: { path: 'userAccount', select: 'firstName lastName' } })
        .select('-__v');

    if (!note) {
        throw new ApiError(404, 'Medical note not found.');
    }
    return note;
};

/**
 * Update a medical note.
 * @param {string} noteId - The ID of the note to update.
 * @param {object} updateData - Data to update (content, tags, consultationDate, appointment).
 * @param {object} updatedByUser - The user performing the update.
 * @returns {Promise<object>} The updated medical note document.
 */
export const updateMedicalNote = async (noteId, updateData, updatedByUser) => {
    logger.debug(`MedicalNoteService: Updating note ${noteId} by user ${updatedByUser._id}`);
    const { noteContent, tags, consultationDate, appointment: appointmentId } = updateData;

    const noteToUpdate = await MedicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } });
    if (!noteToUpdate) throw new ApiError(404, 'Medical note not found.');

    // Permission Check: e.g., Only the original author can update? Or Admins?
    if (!noteToUpdate.authoredBy.equals(updatedByUser._id) && updatedByUser.role !== UserRoles.ADMIN) {
		throw new ApiError(403, 'Forbidden: You are not authorized to update this medical note.');
    }

    // Validate appointmentId if provided
    if (appointmentId !== undefined) { // Check if field exists, even if null
        if (appointmentId === null) {
            noteToUpdate.appointment = null;
        } else {
			const appointmentExists = await mongoose.model('Appointment').countDocuments({ _id: appointmentId, isDeleted: { $ne: true } });
			if (!appointmentExists) throw new ApiError(404, `Appointment not found with ID: ${appointmentId}`);
			noteToUpdate.appointment = appointmentId;
        }
    }

    // Update allowed fields
    if (noteContent !== undefined) noteToUpdate.noteContent = noteContent;
    if (tags !== undefined) noteToUpdate.tags = tags; // Assuming tags replace existing
    if (consultationDate !== undefined) noteToUpdate.consultationDate = consultationDate;

    // Set audit field
    noteToUpdate.updatedBy = updatedByUser._id;

    await noteToUpdate.save();
    logger.info(`Medical note ${noteId} updated successfully by ${updatedByUser._id}`);

    return getMedicalNoteById(noteId); // Re-fetch with populated data
};

/**
 * Delete a medical note (soft delete).
 * @param {string} noteId - The ID of the note to delete.
 * @param {object} deletedByUser - The user performing the deletion.
 * @returns {Promise<void>}
 */
export const deleteMedicalNote = async (noteId, deletedByUser) => {
    logger.warn(`MedicalNoteService: Attempting delete for note ${noteId} by user ${deletedByUser._id}`);
    const noteToDelete = await MedicalNote.findOne({ _id: noteId, isDeleted: { $ne: true } });
    if (!noteToDelete) throw new ApiError(404, 'Medical note not found.');

    // Permission Check: e.g., Only the original author or Admin?
    if (!noteToDelete.authoredBy.equals(deletedByUser._id) && deletedByUser.role !== UserRoles.ADMIN) {
		throw new ApiError(403, 'Forbidden: You are not authorized to delete this medical note.');
    }

    // Perform soft delete
    await noteToDelete.softDelete(deletedByUser._id);
    logger.info(`Medical note ${noteId} soft deleted successfully by ${deletedByUser._id}`);
};
