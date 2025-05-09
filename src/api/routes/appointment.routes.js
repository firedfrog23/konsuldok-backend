import express from 'express';
import {
	cancelAppointment,
	createAppointment,
	deleteAppointment,
	getAppointment,
	getMyAppointments,
	updateAppointment
} from '../controllers/appointment.controller.js';
// Import middleware and validators
import { body } from 'express-validator';
import { UserRoles } from '../../utils/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createAppointmentValidator, updateAppointmentValidator } from '../validators/appointment.validator.js';
import { mongoIdParamValidator } from '../validators/user.validator.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.route('/')
    .get(getMyAppointments) // Use imported function
    .post(authorize(UserRoles.PATIENT, UserRoles.STAFF, UserRoles.ADMIN), createAppointmentValidator, validate, createAppointment); // Use imported function

// Routes for specific appointment ID
router.route('/:appointmentId')
    .get(mongoIdParamValidator('appointmentId'), validate, getAppointment) // Use imported function
    .patch(mongoIdParamValidator('appointmentId'), updateAppointmentValidator, validate, updateAppointment) // Use imported function
    .delete(authorize(UserRoles.ADMIN), mongoIdParamValidator('appointmentId'), validate, deleteAppointment); // Use imported function

// Route specifically for cancelling an appointment
router.patch(
    '/:appointmentId/cancel',
    mongoIdParamValidator('appointmentId'),
    body('reason').notEmpty().withMessage('Cancellation reason is required.').trim().escape(),
    validate,
    cancelAppointment // Use imported function
);

export default router;
