// src/api/routes/doctor.routes.js
import express from 'express';
import { listPublicDoctors, getDoctorAvailabilitySlots } from '../controllers/doctor.controller.js';
import { mongoIdParamValidator } from '../validators/user.validator.js'; // For doctorId param
import { validate } from '../middleware/validate.js';
// Optional: Add specific query validators for listing doctors if needed
// import { listDoctorsQueryValidator } from '../validators/doctor.validator.js';

const router = express.Router();

// Public route to get a list of doctors for appointment booking
router.get(
    '/list-for-booking',
    // listDoctorsQueryValidator, // Example: if you create validators for query params
    // validate,
    listPublicDoctors
);

// Route to get availability for a specific doctor
router.get(
    '/:doctorId/availability',
    mongoIdParamValidator('doctorId'), // Validate doctorId format
    validate,
    getDoctorAvailabilitySlots
);

// You can add more doctor-related public or protected routes here
// For example, a public route to get a single doctor's detailed profile (excluding sensitive info)
// router.get('/:doctorId/profile', mongoIdParamValidator('doctorId'), validate, getPublicDoctorProfile);

export default router;
