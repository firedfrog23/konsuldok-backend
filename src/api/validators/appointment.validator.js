// src/api/validators/appointment.validator.js
import { body } from 'express-validator';
import { AppointmentStatus, AvailableAppointmentStatuses } from '../../utils/constants.js';

// Validation for creating a new appointment
export const createAppointmentValidator = [
    body('patient')
        .optional() // Makes the field optional in the initial request body
        .if((value, { req }) => req.body.patient != null) // Run further validation only if 'patient' was provided in the body
        .isMongoId().withMessage('Invalid Patient ID format (if provided in body).'),
    // Note: The controller will ensure the 'patient' field is ultimately set,
    // either from req.user.patientProfile (for Patient role) or from req.body (for Staff/Admin role).

    body('doctor')
        .notEmpty().withMessage('Doctor ID is required.')
        .isMongoId().withMessage('Invalid Doctor ID format.'),

    body('appointmentTime')
        .notEmpty().withMessage('Appointment time is required.')
        .isISO8601().withMessage('Appointment time must be a valid ISO8601 date string.')
        .toDate() // Converts to a Date object for the custom validation
        .custom((value, { req }) => {
            // value is now a Date object
            if (value <= new Date()) {
                throw new Error('Appointment time must be in the future.');
            }
            // Additional check: Ensure the selected time is not in the past relative to current time
            // This is mostly covered by the above, but good for clarity if date part is today
            const requestedTime = new Date(req.body.appointmentTime); // Re-parse original string for full precision
            if (requestedTime.getTime() <= Date.now()) {
                 throw new Error('Appointment date and time must be in the future.');
            }
            return true;
        }),

    body('durationMinutes')
        .optional()
        .isInt({ min: 5 }).withMessage('Duration must be an integer of at least 5 minutes.'),

    body('reasonForVisit')
        .optional({ checkFalsy: true }) // Allows empty string, null, undefined to pass if optional
        .trim()
        .isLength({ max: 500 }).withMessage('Reason for visit cannot exceed 500 characters.')
        .escape(), // Sanitize

    body('status')
        .not().exists().withMessage('Status cannot be set during creation.'), // Status is set by backend logic
];

// Validation for updating an appointment (e.g., confirming, cancelling)
export const updateAppointmentValidator = [
    body('appointmentTime')
        .optional()
        .isISO8601().withMessage('Appointment time must be a valid ISO8601 date string.')
        .toDate()
        .custom((value, { req }) => {
            if (value <= new Date()) {
                throw new Error('Appointment time must be in the future.');
            }
            const requestedTime = new Date(req.body.appointmentTime);
            if (requestedTime.getTime() <= Date.now()) {
                 throw new Error('Appointment date and time must be in the future.');
            }
            return true;
        }),
    body('durationMinutes')
        .optional()
        .isInt({ min: 5 }).withMessage('Duration must be an integer of at least 5 minutes.'),
    body('status')
        .optional()
        .isIn(AvailableAppointmentStatuses).withMessage('Invalid appointment status specified.'),
    body('cancellationReason')
        .optional({ checkFalsy: true })
        .if(body('status').equals(AppointmentStatus.CANCELLED)) // Only require if status is being set to Cancelled
        .notEmpty().withMessage('Cancellation reason is required when cancelling.')
        .trim()
        .isLength({ max: 500 }).withMessage('Cancellation reason cannot exceed 500 characters.')
        .escape(),
    body('completionNotes')
        .optional({ checkFalsy: true })
        .if(body('status').equals(AppointmentStatus.COMPLETED)) // Only relevant if status is Completed
        .trim()
        .isLength({ max: 1000 }).withMessage('Completion notes cannot exceed 1000 characters.')
        .escape(),
    // Prevent changing patient or doctor during an update
    body('patient').not().exists().withMessage('Patient cannot be changed during update.'),
    body('doctor').not().exists().withMessage('Doctor cannot be changed during update.'),
];
