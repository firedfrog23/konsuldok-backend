// src/api/controllers/doctor.controller.js
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/logger.js';
import { getDoctorsForBooking, fetchDoctorAvailabilitySlots } from '../services/doctor.service.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * @desc    Get a list of doctors suitable for booking (publicly accessible)
 * @route   GET /api/doctors/list-for-booking
 * @access  Public
 */
export const listPublicDoctors = asyncHandler(async (req, res) => {
    logger.info('Controller: listPublicDoctors called', { query: req.query });
    const queryOptions = { ...req.query };

    // Basic validation for query params can be added here
    if (queryOptions.limit && (isNaN(parseInt(queryOptions.limit)) || parseInt(queryOptions.limit) > 100)) {
        queryOptions.limit = 50; // Max limit for dropdowns
    }
    if (queryOptions.page && isNaN(parseInt(queryOptions.page))) {
        queryOptions.page = 1;
    }

    const result = await getDoctorsForBooking(queryOptions);
    res.status(200).json(new ApiResponse(200, result, 'Doctors for booking retrieved successfully.'));
});

/**
 * @desc    Get available appointment slots for a specific doctor on a given date
 * @route   GET /api/doctors/:doctorId/availability
 * @access  Public (or Authenticated, depending on your needs)
 */
export const getDoctorAvailabilitySlots = asyncHandler(async (req, res) => {
    const { doctorId } = req.params;
    const { date, duration } = req.query; // date in 'YYYY-MM-DD', duration in minutes

    logger.info(`Controller: getDoctorAvailabilitySlots for doctor ${doctorId} on date ${date}`);

    if (!date) {
        throw new ApiError(400, 'Date query parameter is required.');
    }
    // Optional: Validate date format here

    const durationMinutes = duration ? parseInt(duration) : 30; // Default to 30 mins
    if (isNaN(durationMinutes) || durationMinutes <= 0) {
        throw new ApiError(400, 'Invalid duration specified.');
    }

    const availableSlots = await fetchDoctorAvailabilitySlots(doctorId, date, durationMinutes);
    res.status(200).json(new ApiResponse(200, { availableSlots }, 'Doctor availability retrieved successfully.'));
});
