// src/api/routes/patient.routes.js
import express from 'express';
// Import specific controller functions directly
import {
	createPatientProfile,
	deletePatientProfile,
	getAllPatientProfiles,
	getMyPatientProfile,
	getPatientProfile,
	updatePatientProfile
} from '../controllers/patient.controller.js';
// Import middleware and validators
import { UserRoles } from '../../utils/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createPatientProfileValidator, updatePatientProfileValidator } from '../validators/patient.validator.js';
import { mongoIdParamValidator } from '../validators/user.validator.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// --- Routes for Staff/Admins/Doctors ---
router.route('/')
    .get(authorize(UserRoles.ADMIN, UserRoles.STAFF, UserRoles.DOCTOR), getAllPatientProfiles) // Use imported function
    .post(authorize(UserRoles.ADMIN, UserRoles.STAFF), createPatientProfileValidator, validate, createPatientProfile); // Use imported function

router.route('/:profileId')
    .get(authorize(UserRoles.ADMIN, UserRoles.STAFF, UserRoles.DOCTOR, UserRoles.PATIENT), mongoIdParamValidator('profileId'), validate, getPatientProfile) // Use imported function
    .patch(authorize(UserRoles.ADMIN, UserRoles.STAFF), mongoIdParamValidator('profileId'), updatePatientProfileValidator, validate, updatePatientProfile) // Use imported function
    .delete(authorize(UserRoles.ADMIN), mongoIdParamValidator('profileId'), validate, deletePatientProfile); // Use imported function

// --- Routes for Patients (Accessing Own Profile) ---
router.get('/profile/me', authorize(UserRoles.PATIENT), getMyPatientProfile); // Use imported function

export default router;
