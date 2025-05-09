import express from 'express';
import {
	deleteMedicalDocument
	// downloadMedicalDocument // If implemented
	,
	getMedicalDocumentById,
	getMedicalDocuments,
	updateMedicalDocument
} from '../controllers/medicalDocument.controller.js';
// Import middleware and validators
import { UserRoles } from '../../utils/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { documentMetadataValidator } from '../validators/medicalDocument.validator.js';
import { mongoIdParamValidator } from '../validators/user.validator.js';
// import upload from '../middleware/multerUpload.js'; // Assuming multer middleware for file handling

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// --- File Upload ---
// Example: router.post('/upload/:patientId', authorize(UserRoles.PATIENT, UserRoles.STAFF, UserRoles.DOCTOR), upload.single('document'), mongoIdParamValidator('patientId'), documentMetadataValidator, validate, uploadDocument);

// --- Metadata Management ---
router.route('/')
    .get(getMedicalDocuments); // Use imported function

router.route('/:documentId')
    .get(mongoIdParamValidator('documentId'), validate, getMedicalDocumentById) // Use imported function
    .patch(authorize(UserRoles.STAFF, UserRoles.DOCTOR, UserRoles.ADMIN), mongoIdParamValidator('documentId'), documentMetadataValidator, validate, updateMedicalDocument) // Use imported function
    .delete(authorize(UserRoles.STAFF, UserRoles.DOCTOR, UserRoles.ADMIN), mongoIdParamValidator('documentId'), validate, deleteMedicalDocument); // Use imported function

// Optional: Route to get download link or stream file
// router.get('/:documentId/download', mongoIdParamValidator('documentId'), validate, downloadMedicalDocument);


export default router;
