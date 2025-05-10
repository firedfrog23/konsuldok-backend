// src/api/routes/index.js
import express from 'express';
import appointmentRoutes from './appointment.routes.js';
import authRoutes from './auth.routes.js';
import medicalDocumentRoutes from './medicalDocument.routes.js';
import medicalNoteRoutes from './medicalNote.routes.js';
import patientRoutes from './patient.routes.js';
import userRoutes from './user.routes.js';
import doctorRoutes from './doctor.routes.js';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to KonsulDok API' });
});

// Mount resource-specific routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/notes', medicalNoteRoutes);
router.use('/documents', medicalDocumentRoutes);
router.use('/doctors', doctorRoutes);

export default router;
