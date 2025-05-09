import express from 'express';
import {
	createMedicalNote,
	deleteMedicalNote,
	getMedicalNoteById,
	getMedicalNotes,
	updateMedicalNote
} from '../controllers/medicalNote.controller.js';
// Import middleware and validators
import { UserRoles } from '../../utils/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { createMedicalNoteValidator, updateMedicalNoteValidator } from '../validators/medicalNote.validator.js';
import { mongoIdParamValidator } from '../validators/user.validator.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Assuming Standalone Routes for simplicity here:
router.route('/')
    .post(authorize(UserRoles.DOCTOR, UserRoles.STAFF), createMedicalNoteValidator, validate, createMedicalNote) // Use imported function
    .get(getMedicalNotes); // Use imported function

router.route('/:noteId')
    .get(mongoIdParamValidator('noteId'), validate, getMedicalNoteById) // Use imported function
    .patch(authorize(UserRoles.DOCTOR, UserRoles.STAFF), mongoIdParamValidator('noteId'), updateMedicalNoteValidator, validate, updateMedicalNote) // Use imported function
    .delete(authorize(UserRoles.DOCTOR, UserRoles.STAFF, UserRoles.ADMIN), mongoIdParamValidator('noteId'), validate, deleteMedicalNote); // Use imported function

export default router;
