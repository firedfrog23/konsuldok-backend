import express from 'express';
import appointmentRoutes from './appointment.routes.js';
import authRoutes from './auth.routes.js';
import medicalDocumentRoutes from './medicalDocument.routes.js';
import medicalNoteRoutes from './medicalNote.routes.js';
import patientRoutes from './patient.routes.js';
import userRoutes from './user.routes.js';
// Import doctor and staff routes if you create them later
// import doctorRoutes from './doctor.routes.js';
// import staffRoutes from './staff.routes.js';

// Create the main router instance
const router = express.Router();

// Define a default route for the API root (optional)
router.get('/', (req, res) => {
    res.json({ message: 'Welcome to KonsulDok API' });
});

// Mount resource-specific routers onto the main router
router.use('/auth', authRoutes); // Routes for authentication (login, register, etc.)
router.use('/users', userRoutes); // Routes for user management (admin actions, profile updates)
router.use('/patients', patientRoutes); // Routes for patient profile management
router.use('/appointments', appointmentRoutes); // Routes for appointment management
router.use('/notes', medicalNoteRoutes); // Routes for medical notes (assuming base path /notes)
router.use('/documents', medicalDocumentRoutes); // Routes for medical documents (assuming base path /documents)

// Mount other routers as needed
// router.use('/doctors', doctorRoutes); // Example
// router.use('/staff', staffRoutes); // Example


// Export the main router to be used in app.js
export default router;
