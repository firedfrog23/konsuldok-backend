import { body } from 'express-validator';
import { AppointmentStatus, AvailableAppointmentStatuses } from '../../utils/constants.js';

// Validation for creating a new appointment
export const createAppointmentValidator = [
    body('patient')
        .notEmpty()
		.withMessage('Patient ID is required.')
        .isMongoId()
		.withMessage('Invalid Patient ID format.'),
    body('doctor')
        .notEmpty()
		.withMessage('Doctor ID is required.')
        .isMongoId()
		.withMessage('Invalid Doctor ID format.'),
    body('appointmentTime')
        .notEmpty()
		.withMessage('Appointment time is required.')
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for appointment time.')
        .custom(value => {
            if (new Date(value) <= new Date()) {
                throw new Error('Appointment time must be in the future.');
            }
            return true;
        }),
    body('durationMinutes')
        .optional()
        .isInt({ min: 5 })
		.withMessage('Duration must be an integer of at least 5 minutes.'),
    body('reasonForVisit')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
		.withMessage('Reason cannot exceed 500 characters.')
        .escape(),
    body('status')
		.not()
		.exists()
		.withMessage('Status cannot be set during creation.'),
];

// Validation for updating an appointment (e.g., confirming, cancelling)
export const updateAppointmentValidator = [
    body('appointmentTime')
        .optional()
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for appointment time.')
        .custom(value => {
            if (new Date(value) <= new Date()) {
                throw new Error('Appointment time must be in the future.');
            }
            return true;
        }),
    body('durationMinutes')
        .optional()
        .isInt({ min: 5 })
		.withMessage('Duration must be an integer of at least 5 minutes.'),
    body('status')
        .optional()
        .isIn(AvailableAppointmentStatuses)
		.withMessage('Invalid appointment status specified.'),
    body('cancellationReason')
        .optional({ checkFalsy: true })
        .if(body('status').equals(AppointmentStatus.CANCELLED))
        .notEmpty()
		.withMessage('Cancellation reason is required when cancelling.')
        .trim()
        .isLength({ max: 500 })
		.withMessage('Cancellation reason cannot exceed 500 characters.')
        .escape(),
    body('completionNotes')
        .optional({ checkFalsy: true })
        .if(body('status').equals(AppointmentStatus.COMPLETED))
        .trim()
        .escape(),
    body('patient')
		.not()
		.exists()
		.withMessage('Patient cannot be changed after creation.'),
    body('doctor')
		.not()
		.exists()
		.withMessage('Doctor cannot be changed after creation.'),
];
