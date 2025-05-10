// src/api/services/appointment.service.js
import Appointment from '../../models/appointment.model.js';
import DoctorProfile from '../../models/doctorProfile.model.js';
import PatientProfile from '../../models/patientProfile.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { AppointmentStatus, UserRoles } from '../../utils/constants.js';
import logger from '../../utils/logger.js';

/**
 * Check doctor's availability for a given time slot based on weeklySchedule.
 * @param {string} doctorId - DoctorProfile ID.
 * @param {Date} requestedStartTimeDate - Start Date object of the requested appointment.
 * @param {number} durationMinutes - Duration of the requested appointment.
 * @param {string} [excludeAppointmentId=null] - Optional: ID of an appointment to exclude from conflict checks.
 * @returns {Promise<boolean>} True if available, false otherwise.
 */
const checkDoctorAvailability = async (doctorId, requestedStartTimeDate, durationMinutes, excludeAppointmentId = null) => {
    logger.debug(`Checking availability for doctor ${doctorId} at ${requestedStartTimeDate} for ${durationMinutes} mins`);

    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile) {
        throw new ApiError(404, 'Doctor profile not found for availability check.');
    }

    const requestedEndTimeDate = new Date(requestedStartTimeDate.getTime() + durationMinutes * 60000);
    const requestedDayOfWeek = requestedStartTimeDate.getDay(); // 0 (Sunday) - 6 (Saturday)

    // 1. Check if the doctor works on the requestedDayOfWeek and if the time falls within any scheduled block
    const workingBlocksForDay = doctorProfile.weeklySchedule.filter(slot => slot.dayOfWeek === requestedDayOfWeek);

    // --- FIX: Corrected variable name from workingSlotsForDay to workingBlocksForDay ---
    if (workingBlocksForDay.length === 0) {
        logger.debug(`Doctor ${doctorId} has no working blocks scheduled for dayOfWeek ${requestedDayOfWeek}`);
        return false;
    }

    // Convert requestedStartTimeDate and requestedEndTimeDate to "HH:MM" strings for comparison
    const formatToHHMM = (date) => {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    };
    const requestedStartTimeHHMM = formatToHHMM(requestedStartTimeDate);
    const requestedEndTimeHHMM = formatToHHMM(requestedEndTimeDate);

    let isWithinScheduledBlock = false;
    // --- FIX: Corrected variable name from workingSlotsForDay to workingBlocksForDay ---
    for (const block of workingBlocksForDay) {
        // block.startTime and block.endTime are "HH:MM" strings from the schema
        if (requestedStartTimeHHMM >= block.startTime && requestedEndTimeHHMM <= block.endTime) {
            isWithinScheduledBlock = true;
            break;
        }
    }

    if (!isWithinScheduledBlock) {
        logger.debug(`Requested time ${requestedStartTimeHHMM}-${requestedEndTimeHHMM} is outside doctor's scheduled blocks for dayOfWeek ${requestedDayOfWeek}`);
        return false;
    }

    // 2. Check for conflicting appointments (Confirmed or Requested status)
    const conflictQuery = {
        doctor: doctorId,
        status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] },
        isDeleted: { $ne: true },
        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        appointmentTime: { $lt: requestedEndTimeDate }, // Existing appointment starts before potential slot ends
        $expr: { $gt: [{ $add: ["$appointmentTime", { $multiply: ["$durationMinutes", 60000] }] }, requestedStartTimeDate] } // Existing appointment ends after potential slot starts
    };

    if (excludeAppointmentId) {
        conflictQuery._id = { $ne: excludeAppointmentId };
    }

    const conflictingAppointment = await Appointment.findOne(conflictQuery);

    if (conflictingAppointment) {
        logger.debug(`Conflict found with appointment ${conflictingAppointment._id} for doctor ${doctorId} at ${requestedStartTimeDate}`);
        return false;
    }

    logger.debug(`Doctor ${doctorId} is available at ${requestedStartTimeDate}`);
    return true;
};


/**
 * Create a new appointment request.
 * @param {object} appointmentData - Appointment details.
 * @param {object} requestedByUser - The user making the request.
 * @returns {Promise<object>} The created appointment document.
 */
export const createAppointment = async (appointmentData, requestedByUser) => {
    const { doctor: doctorProfileId, appointmentTime, durationMinutes = 30, reasonForVisit } = appointmentData;
    let patientProfileId = appointmentData.patient; // May be provided by Staff/Admin

    if (requestedByUser.role === UserRoles.PATIENT) {
        if (!requestedByUser.patientProfile) {
            throw new ApiError(400, 'Patient profile not found for the requesting user.');
        }
        patientProfileId = requestedByUser.patientProfile.toString();
    } else if (!patientProfileId) {
        throw new ApiError(400, 'Patient ID is required when Staff/Admin creates an appointment.');
    }

    logger.debug(`AppointmentService: Creating appointment request by user ${requestedByUser._id} (Role: ${requestedByUser.role}) for patient ${patientProfileId}`);

    const patientExists = await PatientProfile.countDocuments({ _id: patientProfileId, isDeleted: { $ne: true } });
    const doctorExists = await DoctorProfile.countDocuments({ _id: doctorProfileId, isDeleted: { $ne: true } });

    if (!patientExists) throw new ApiError(404, 'Patient profile not found.');
    if (!doctorExists) throw new ApiError(404, 'Doctor profile not found.');

    const requestedTimeDate = new Date(appointmentTime);
    if (isNaN(requestedTimeDate.getTime()) || requestedTimeDate.getTime() <= Date.now()) {
        throw new ApiError(400, 'Invalid or past appointment time specified.');
    }

    const isAvailable = await checkDoctorAvailability(doctorProfileId, requestedTimeDate, durationMinutes);
    if (!isAvailable) {
        throw new ApiError(409, 'Doctor is not available at the requested time or a conflict exists.');
    }

    let initialStatus = AppointmentStatus.REQUESTED;
    let scheduledByStaff = null;
    if (requestedByUser.role === UserRoles.STAFF || requestedByUser.role === UserRoles.ADMIN) {
        initialStatus = AppointmentStatus.CONFIRMED;
        scheduledByStaff = requestedByUser._id;
    }

    const newAppointment = new Appointment({
        patient: patientProfileId,
        doctor: doctorProfileId,
        appointmentTime: requestedTimeDate,
        durationMinutes,
        reasonForVisit,
        status: initialStatus,
        scheduledByStaff: scheduledByStaff,
        createdBy: requestedByUser._id,
        updatedBy: requestedByUser._id,
    });

    await newAppointment.save();
    logger.info(`Appointment ${newAppointment._id} created successfully with status ${initialStatus}`);

    return getAppointmentById(newAppointment._id);
};

/**
 * Get appointments based on criteria.
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
            .populate({ path: 'patient', select: 'userAccount', populate: { path: 'userAccount', select: 'firstName lastName email' } })
            .populate({ path: 'doctor', select: 'userAccount specialty', populate: { path: 'userAccount', select: 'firstName lastName email' } })
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
 */
export const getAppointmentById = async (appointmentId) => {
    logger.debug('AppointmentService: Fetching appointment by ID:', appointmentId);
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } })
        .populate({ path: 'patient', select: 'userAccount dateOfBirth gender', populate: { path: 'userAccount', select: 'firstName lastName email phoneNumber' } })
        .populate({ path: 'doctor', select: 'userAccount specialty languagesSpoken', populate: { path: 'userAccount', select: 'firstName lastName email phoneNumber profilePictureUrl' } })
        .populate({ path: 'scheduledByStaff', select: 'firstName lastName role' })
        .select('-__v');

    if (!appointment) {
        throw new ApiError(404, 'Appointment not found.');
    }
    return appointment;
};

/**
 * Update an appointment's status or details.
 */
export const updateAppointment = async (appointmentId, updateData, updatedByUser) => {
    logger.debug(`AppointmentService: Updating appointment ${appointmentId} by user ${updatedByUser._id}`, { updateData });
    const { status, appointmentTime, durationMinutes, completionNotes } = updateData;

    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } });
    if (!appointment) throw new ApiError(404, 'Appointment not found.');

    if ((status === AppointmentStatus.CONFIRMED || status === AppointmentStatus.COMPLETED) &&
        ![UserRoles.DOCTOR, UserRoles.STAFF, UserRoles.ADMIN].includes(updatedByUser.role)) {
        throw new ApiError(403, 'Forbidden: Only Doctor, Staff, or Admin can confirm/complete appointments.');
    }

    if (appointmentTime) {
        const newTime = new Date(appointmentTime);
        const newDuration = durationMinutes || appointment.durationMinutes;
        if (isNaN(newTime.getTime()) || newTime.getTime() <= Date.now()) {
            throw new ApiError(400, 'Invalid or past appointment time specified for reschedule.');
        }
        const isAvailable = await checkDoctorAvailability(appointment.doctor.toString(), newTime, newDuration, appointmentId);
        if (!isAvailable) {
            throw new ApiError(409, 'Doctor is not available at the requested reschedule time or a conflict exists.');
        }
        appointment.appointmentTime = newTime;
        if (durationMinutes) appointment.durationMinutes = newDuration;
    }

    if (status) appointment.status = status;
    if (completionNotes && status === AppointmentStatus.COMPLETED) appointment.completionNotes = completionNotes;
    if (updateData.cancellationReason && status === AppointmentStatus.CANCELLED) appointment.cancellationReason = updateData.cancellationReason;

    appointment.updatedBy = updatedByUser._id;
    await appointment.save();
    logger.info(`Appointment ${appointmentId} updated successfully by ${updatedByUser._id}`);
    return getAppointmentById(appointmentId);
};

/**
 * Cancel an appointment.
 */
export const cancelAppointment = async (appointmentId, reason, cancelledByUser) => {
    logger.warn(`AppointmentService: Cancelling appointment ${appointmentId} by user ${cancelledByUser._id}`);
    const appointment = await Appointment.findOne({ _id: appointmentId, isDeleted: { $ne: true } });
    if (!appointment) throw new ApiError(404, 'Appointment not found.');

    if ([AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED].includes(appointment.status)) {
        throw new ApiError(400, `Cannot cancel appointment with status: ${appointment.status}`);
    }

    const isPatientOwner = cancelledByUser.role === UserRoles.PATIENT && appointment.patient.equals(cancelledByUser.patientProfile);
    const isDoctorOwner = cancelledByUser.role === UserRoles.DOCTOR && appointment.doctor.equals(cancelledByUser.doctorProfile);
    const isStaffOrAdmin = [UserRoles.STAFF, UserRoles.ADMIN].includes(cancelledByUser.role);

    let canCancel = false;
    if (isPatientOwner && [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED].includes(appointment.status)) {
        canCancel = true;
    } else if (isDoctorOwner || isStaffOrAdmin) {
        canCancel = true;
    }

    if (!canCancel) {
        throw new ApiError(403, 'Forbidden: You are not authorized to cancel this appointment.');
    }

    appointment.status = AppointmentStatus.CANCELLED;
    appointment.cancellationReason = reason;
    appointment.updatedBy = cancelledByUser._id;

    await appointment.save();
    logger.info(`Appointment ${appointmentId} cancelled successfully by ${cancelledByUser._id}`);
    return getAppointmentById(appointmentId);
};

/**
 * Delete an appointment (soft delete) - Admin only.
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

    await appointmentToDelete.softDelete(deletedByUser._id);
    logger.info(`Appointment ${appointmentId} soft deleted successfully by admin ${deletedByUser._id}`);
};
