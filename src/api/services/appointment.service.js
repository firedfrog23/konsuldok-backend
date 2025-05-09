// src/api/services/appointment.service.js
// Placeholder for appointment scheduling and management logic

import Appointment from '../../models/appointment.model.js'; // Adjust path
import DoctorProfile from '../../models/doctorProfile.model.js'; // Adjust path
import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { AppointmentStatus, UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Check doctor's availability for a given time slot using the simple approach.
 * @param {string} doctorId - DoctorProfile ID.
 * @param {Date} requestedStartTime - Start time of the requested appointment.
 * @param {number} durationMinutes - Duration of the requested appointment.
 * @param {string} [excludeAppointmentId=null] - Optional: ID of an appointment to exclude from conflict checks (used when rescheduling).
 * @returns {Promise<boolean>} True if available, false otherwise.
 */
const checkDoctorAvailabilitySimple = async (doctorId, requestedStartTime, durationMinutes, excludeAppointmentId = null) => {
    logger.debug(`Checking availability for doctor ${doctorId} at ${requestedStartTime} for ${durationMinutes} mins`);

    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile) throw new ApiError(404, 'Doctor profile not found.');

    const requestedEndTime = new Date(requestedStartTime.getTime() + durationMinutes * 60000);
    const dayOfWeek = requestedStartTime.getDay(); // 0 = Sunday, 6 = Saturday

    // 1. Check if the day is an available day
    if (!doctorProfile.availableDays.includes(dayOfWeek)) {
        logger.debug(`Doctor ${doctorId} not available on day ${dayOfWeek}`);
        return false;
    }

    // 2. Check if the time slot falls within the general available hours
    const formatTime = (date) => date.toTimeString().substring(0, 5); // HH:MM format
    const reqStartTimeStr = formatTime(requestedStartTime);
    const reqEndTimeStr = formatTime(requestedEndTime);

    if (reqStartTimeStr < doctorProfile.availableStartTime || reqEndTimeStr > doctorProfile.availableEndTime) {
        logger.debug(`Requested time ${reqStartTimeStr}-${reqEndTimeStr} outside general availability ${doctorProfile.availableStartTime}-${doctorProfile.availableEndTime}`);
        return false;
    }

    // 3. Check for conflicting appointments (Confirmed or potentially Requested status)
    const conflictQuery = {
        doctor: doctorId,
        status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] }, // Check against confirmed/requested
        isDeleted: { $ne: true },
        $or: [ // Check for overlap
            { appointmentTime: { $lt: requestedEndTime, $gte: requestedStartTime } }, // Starts within the slot
            { $expr: { $lt: [ "$appointmentTime", requestedStartTime ] }, // Ends within the slot (calculate end time)
              $expr: { $gt: [ { $add: [ "$appointmentTime", { $multiply: [ "$durationMinutes", 60000 ] } ] }, requestedStartTime ] } },
            { $expr: { $lte: [ "$appointmentTime", requestedStartTime ] }, // Engulfs the slot
              $expr: { $gte: [ { $add: [ "$appointmentTime", { $multiply: [ "$durationMinutes", 60000 ] } ] }, requestedEndTime ] } }
        ]
    };
    // If rescheduling, exclude the appointment being rescheduled from conflict check
    if (excludeAppointmentId) {
        conflictQuery._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointment = await Appointment.findOne(conflictQuery);

    if (conflictingAppointment) {
        logger.debug(`Conflict found with appointment ${conflictingAppointment._id} for doctor ${doctorId}`);
        return false;
    }

    logger.debug(`Doctor ${doctorId} is available at ${requestedStartTime}`);
    return true;
};


/**
 * Create a new appointment request.
 * @param {object} appointmentData - Appointment details (patientId, doctorId, time, reason).
 * @param {object} requestedByUser - The user making the request (Patient or Staff/Admin).
 * @returns {Promise<object>} The created appointment document.
 */
export const createAppointment = async (appointmentData, requestedByUser) => {
    const { patient: patientProfileId, doctor: doctorProfileId, appointmentTime, durationMinutes = 30, reasonForVisit } = appointmentData;
    logger.debug(`AppointmentService: Creating appointment request by user ${requestedByUser._id} for patient ${patientProfileId}`);

    // 1. Validate patient and doctor profile IDs exist
    const patientExists = await PatientProfile.countDocuments({ _id: patientProfileId, isDeleted: { $ne: true } });
    const doctorExists = await DoctorProfile.countDocuments({ _id: doctorProfileId, isDeleted: { $ne: true } });
    if (!patientExists) throw new ApiError(404, 'Patient profile not found.');
    if (!doctorExists) throw new ApiError(404, 'Doctor profile not found.');

    const requestedTime = new Date(appointmentTime);
    if (isNaN(requestedTime.getTime()) || requestedTime <= new Date()) {
        throw new ApiError(400, 'Invalid or past appointment time specified.');
    }

    // 2. Check Doctor Availability
    const isAvailable = await checkDoctorAvailabilitySimple(doctorProfileId, requestedTime, durationMinutes);
    if (!isAvailable) {
        throw new ApiError(400, 'Doctor is not available at the requested time or a conflict exists.');
    }

    // 3. Determine initial status and scheduler
    let initialStatus = AppointmentStatus.REQUESTED;
    let scheduledBy = null;
    if (requestedByUser.role === UserRoles.STAFF || requestedByUser.role === UserRoles.ADMIN) {
        initialStatus = AppointmentStatus.CONFIRMED; // Staff/Admin bookings are confirmed directly
        scheduledBy = requestedByUser._id;
    }

    // 4. Create new Appointment document
    const newAppointment = new Appointment({
        patient: patientProfileId,
        doctor: doctorProfileId,
        appointmentTime: requestedTime,
        durationMinutes,
        reasonForVisit,
        status: initialStatus,
        scheduledByStaff: scheduledBy, // Use the correct field name from model
        createdBy: requestedByUser._id,
    });

    await newAppointment.save();
    logger.info(`Appointment ${newAppointment._id} created successfully with status ${initialStatus}`);

    // 6. Optional: Send notification to doctor/staff/patient
    // await sendEmail(...)

    // Populate details before returning
    return getAppointmentById(newAppointment._id);
};

/**
 * Get appointments based on criteria.
 * @param {object} filterOptions - Criteria like patientId, doctorId, date range, status.
 * @param {object} paginationOptions - Limit, page/skip.
 * @returns {Promise<object>} List of appointments and pagination info.
 */
export const getAppointments = async (filterOptions = {}, paginationOptions = {}) => {
    const { patientId, doctorId, startDate, endDate, status, sortBy = 'appointmentTime', order = 'asc', limit = 10, page = 1 } = { ...filterOptions, ...paginationOptions };
    logger.debug('AppointmentService: Fetching appointments with filter:', filterOptions);

    const filter = { isDeleted: { $ne: true } };
    if (patientId) filter.patient = patientId;
    if (doctorId) filter.doctor = doctorId;
    if (status) filter.status = status;
    if (startDate || endDate) {
        filter.appointmentTime = {};
        if (startDate) filter.appointmentTime.$gte = new Date(startDate);
        if (endDate) filter.appointmentTime.$lte = new Date(endDate);
    }

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    try {
        const appointments = await Appointment.find(filter)
            .populate({ path: 'patient', select: 'userAccount', populate: { path: 'userAccount', select: 'firstName lastName' } }) // Populate patient's name
            .populate({ path: 'doctor', select: 'userAccount specialty', populate: { path: 'userAccount', select: 'firstName lastName' } }) // Populate doctor's name/specialty
            .sort(sort)
            .skip(skip)
            .limit(limitValue)
            .select('-__v');

        const totalCount = await Appointment.countDocuments(filter);

        return {
            appointments,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error('AppointmentService: Error fetching appointments:', error);
        throw new ApiError(500, 'Failed to retrieve appointments.');
    }
};

/**
 * Get a single appointment by ID, populating details.
 * @param {string} appointmentId - The ID of the appointment.
 * @returns {Promise<object>} The appointment document.
 */
export const getAppointmentById = async (appointmentId) => {
    logger.debug('AppointmentService: Fetching appointment by ID:', appointmentId);
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } })
        .populate({ path: 'patient', select: 'userAccount', populate: { path: 'userAccount', select: 'firstName lastName email phoneNumber' } })
        .populate({ path: 'doctor', select: 'userAccount specialty', populate: { path: 'userAccount', select: 'firstName lastName email phoneNumber' } })
        .populate({ path: 'scheduledByStaff', select: 'firstName lastName' }) // Populate staff who scheduled
        .select('-__v');

    if (!appointment) {
        throw new ApiError(404, 'Appointment not found.');
    }
    return appointment;
};

/**
 * Update an appointment's status or details (e.g., confirm, complete, reschedule).
 * @param {string} appointmentId - The ID of the appointment to update.
 * @param {object} updateData - Data to update (status, appointmentTime, durationMinutes, completionNotes).
 * @param {object} updatedByUser - The user performing the update.
 * @returns {Promise<object>} The updated appointment document.
 */
export const updateAppointment = async (appointmentId, updateData, updatedByUser) => {
    logger.debug(`AppointmentService: Updating appointment ${appointmentId} by user ${updatedByUser._id}`);
    const { status, appointmentTime, durationMinutes, completionNotes } = updateData;

    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } });
    if (!appointment) throw new ApiError(404, 'Appointment not found.');

    // --- Permission Checks & Logic ---
    // Example: Only Doctor/Staff/Admin can confirm/complete
    if ([AppointmentStatus.CONFIRMED, AppointmentStatus.COMPLETED].includes(status)) {
        if (![UserRoles.DOCTOR, UserRoles.STAFF, UserRoles.ADMIN].includes(updatedByUser.role)) {
             throw new ApiError(403, 'Forbidden: Only Doctor, Staff, or Admin can confirm/complete appointments.');
        }
    }
    // TODO: Add more detailed permission logic based on role and current status

    // --- Rescheduling Logic ---
    if (appointmentTime) {
        const newTime = new Date(appointmentTime);
        const newDuration = durationMinutes || appointment.durationMinutes;
        if (isNaN(newTime.getTime()) || newTime <= new Date()) {
            throw new ApiError(400, 'Invalid or past appointment time specified for reschedule.');
        }
        // Re-check availability, excluding the current appointment from conflict check
        const isAvailable = await checkDoctorAvailabilitySimple(appointment.doctor, newTime, newDuration, appointmentId);
        if (!isAvailable) {
            throw new ApiError(400, 'Doctor is not available at the requested reschedule time or a conflict exists.');
        }
        appointment.appointmentTime = newTime;
        if (durationMinutes) appointment.durationMinutes = newDuration;
    }

    // --- Update Status and Notes ---
    if (status) {
        // TODO: Validate status transitions (e.g., cannot complete if cancelled)
        appointment.status = status;
    }
    if (completionNotes && status === AppointmentStatus.COMPLETED) {
        appointment.completionNotes = completionNotes;
    }

    // Set audit field
    appointment.updatedBy = updatedByUser._id;

    await appointment.save();
    logger.info(`Appointment ${appointmentId} updated successfully by ${updatedByUser._id}`);

    // Optional: Send notifications on status change/reschedule

    return getAppointmentById(appointmentId); // Re-fetch with populated data
};

/**
 * Cancel an appointment.
 * @param {string} appointmentId - The ID of the appointment to cancel.
 * @param {string} reason - Reason for cancellation.
 * @param {object} cancelledByUser - The user performing the cancellation.
 * @returns {Promise<object>} The cancelled appointment document.
 */
export const cancelAppointment = async (appointmentId, reason, cancelledByUser) => {
    logger.warn(`AppointmentService: Cancelling appointment ${appointmentId} by user ${cancelledByUser._id}`);
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } });
    if (!appointment) throw new ApiError(404, 'Appointment not found.');

    // Check if already cancelled or completed
    if ([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED].includes(appointment.status)) {
        throw new ApiError(400, `Cannot cancel appointment with status: ${appointment.status}`);
    }

    // Permission Check
    const isPatientOwner = cancelledByUser.role === UserRoles.PATIENT && appointment.patient.equals(cancelledByUser.patientProfile);
    const isDoctorOwner = cancelledByUser.role === UserRoles.DOCTOR && appointment.doctor.equals(cancelledByUser.doctorProfile);
    const isStaffOrAdmin = [UserRoles.STAFF, UserRoles.ADMIN].includes(cancelledByUser.role);

    // Define who can cancel (e.g., Patient can cancel own REQUESTED/CONFIRMED, others can cancel most)
    let canCancel = false;
    if (isPatientOwner && [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED].includes(appointment.status)) {
        // Optional: Add time limit check (e.g., cannot cancel within 24 hours)
        canCancel = true;
    } else if (isDoctorOwner || isStaffOrAdmin) {
        canCancel = true; // Staff/Admin/Doctor can cancel (adjust as needed)
    }

    if (!canCancel) {
        throw new ApiError(403, 'Forbidden: You are not authorized to cancel this appointment.');
    }

    // Update status and reason
    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = reason;
    appointment.updatedBy = cancelledByUser._id;

    await appointment.save();
    logger.info(`Appointment ${appointmentId} cancelled successfully by ${cancelledByUser._id}`);

    // Optional: Send cancellation notifications

    return getAppointmentById(appointmentId); // Re-fetch with populated data
};

/**
 * Delete an appointment (soft delete) - Admin only.
 * @param {string} appointmentId - The ID of the appointment to delete.
 * @param {object} deletedByUser - The user performing the deletion (must be Admin).
 * @returns {Promise<void>}
 */
export const deleteAppointment = async (appointmentId, deletedByUser) => {
    logger.warn(`AppointmentService: Attempting delete for appointment ${appointmentId} by admin ${deletedByUser._id}`);
    if (deletedByUser.role !== UserRoles.ADMIN) {
         throw new ApiError(403, 'Forbidden: Only administrators can delete appointments.');
    }

    const appointmentToDelete = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } });
    if (!appointmentToDelete) {
        throw new ApiError(404, 'Appointment not found or already deleted.');
    }

    // Perform soft delete
    await appointmentToDelete.softDelete(deletedByUser._id);
    logger.info(`Appointment ${appointmentId} soft deleted successfully by admin ${deletedByUser._id}`);
};
