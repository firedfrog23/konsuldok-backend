import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { UserRoles } from '../../utils/constants.js';
import logger from '../../utils/logger.js';
import {
	cancelAppointment as cancelAppointmentService,
	createAppointment as createAppointmentService,
	deleteAppointment as deleteAppointmentService,
	getAppointmentById,
	getAppointments,
	updateAppointment as updateAppointmentService
} from '../services/appointment.service.js';

/**
 * @desc    Create/Request an appointment
 * @route   POST /api/appointments
 * @access  Private (Patient, Staff, Admin)
 */
export const createAppointment = asyncHandler(async (req, res) => {
    logger.info(`Controller: createAppointment called by user ${req.user?._id}`);
    const appointmentData = req.body;
    if (req.user.role === UserRoles.PATIENT) {
        if (!req.user.patientProfile) throw new ApiError(400, 'Patient profile not found for requesting user.');
        appointmentData.patient = req.user.patientProfile;
    } else if (!appointmentData.patient) {
        throw new ApiError(400, 'Patient ID is required when creating appointment as Staff/Admin.');
    }
    const createdAppointment = await createAppointmentService(appointmentData, req.user);
    res.status(201).json(new ApiResponse(201, createdAppointment, 'Appointment created successfully.'));
});

/**
 * @desc    Get appointments (filtered based on role/query)
 * @route   GET /api/appointments
 * @access  Private (All authenticated roles)
 */
export const getMyAppointments = asyncHandler(async (req, res) => {
    logger.info(`Controller: getMyAppointments called by user ${req.user?._id}`);
    const filterOptions = { ...req.query };
    if (req.user.role === UserRoles.PATIENT) {
        if (!req.user.patientProfile) throw new ApiError(400, 'Patient profile not found.');
        filterOptions.patientId = req.user.patientProfile;
    } else if (req.user.role === UserRoles.DOCTOR) {
        if (!req.user.doctorProfile) throw new ApiError(400, 'Doctor profile not found.');
        filterOptions.doctorId = req.user.doctorProfile;
    }
    const result = await getAppointments(filterOptions, req.query); // Pass pagination from req.query
    res.status(200).json(new ApiResponse(200, result, 'Appointments retrieved successfully.'));
});

/**
 * @desc    Get a single appointment by ID
 * @route   GET /api/appointments/:appointmentId
 * @access  Private (Involved Patient/Doctor/Staff, Admin)
 */
export const getAppointment = asyncHandler(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    logger.info(`Controller: getAppointment called by user ${req.user?._id} for appointment ${appointmentId}`);
    const appointment = await getAppointmentById(appointmentId);
    res.status(200).json(new ApiResponse(200, appointment, 'Appointment retrieved successfully.'));
});

/**
 * @desc    Update an appointment (e.g., confirm, complete, reschedule)
 * @route   PATCH /api/appointments/:appointmentId
 * @access  Private (Doctor, Staff, Admin)
 */
export const updateAppointment = asyncHandler(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    logger.info(`Controller: updateAppointment called by user ${req.user?._id} for appointment ${appointmentId}`);
    const updateData = req.body;
    const updatedAppointment = await updateAppointmentService(appointmentId, updateData, req.user);
    res.status(200).json(new ApiResponse(200, updatedAppointment, 'Appointment updated successfully.'));
});

/**
 * @desc    Cancel an appointment
 * @route   PATCH /api/appointments/:appointmentId/cancel
 * @access  Private (Involved Patient/Doctor/Staff, Admin)
 */
export const cancelAppointment = asyncHandler(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    logger.warn(`Controller: cancelAppointment called by user ${req.user?._id} for appointment ${appointmentId}`);
    const { reason } = req.body;
    if (!reason) throw new ApiError(400, 'Cancellation reason is required.');
    const cancelledAppointment = await cancelAppointmentService(appointmentId, reason, req.user);
    res.status(200).json(new ApiResponse(200, cancelledAppointment, 'Appointment cancelled successfully.'));
});

/**
 * @desc    Delete an appointment (Admin only?)
 * @route   DELETE /api/appointments/:appointmentId
 * @access  Private (Admin)
 */
export const deleteAppointment = asyncHandler(async (req, res) => {
    const appointmentId = req.params.appointmentId;
    logger.warn(`Controller: deleteAppointment called by admin ${req.user?._id} for appointment ${appointmentId}`);
    await deleteAppointmentService(appointmentId, req.user);
    res.status(200).json(new ApiResponse(200, null, 'Appointment deleted successfully.'));
});
