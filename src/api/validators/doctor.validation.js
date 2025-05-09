import { body } from 'express-validator';

// Validation for creating/updating a doctor profile (usually by Admin)
export const doctorProfileValidator = [
    body('specialty')
        .notEmpty()
		.withMessage('Specialty is required.')
        .trim()
        .escape(),
    body('licenseNumber')
        .notEmpty()
		.withMessage('License number is required.')
        .trim()
        .escape(),
    body('yearsOfExperience')
        .optional({ checkFalsy: true })
        .isInt({ min: 0 })
		.withMessage('Years of experience must be a non-negative integer.'),
    body('qualifications')
        .optional()
        .isArray()
		.withMessage('Qualifications must be an array of strings.'),
    body('qualifications.*')
        .optional()
        .isString()
		.trim()
		.escape(),
    body('clinicAddress.street')
		.optional()
		.trim()
		.escape(),
    body('clinicAddress.city')
		.optional()
		.trim()
		.escape(),
    body('clinicAddress.province')
		.optional()
		.trim()
		.escape(),
    body('clinicAddress.postalCode')
		.optional()
		.trim()
		.escape(),
    body('consultationFee')
        .optional({ checkFalsy: true })
        .isFloat({ min: 0 })
		.withMessage('Consultation fee must be a non-negative number.'),
    body('biography')
		.optional()
		.trim()
		.escape(),
    body('languagesSpoken')
        .optional()
        .isArray()
		.withMessage('Languages spoken must be an array of strings.'),
    body('languagesSpoken.*')
        .optional()
        .isString()
		.trim()
		.escape(),
    body('userAccount')
		.not()
		.exists()
		.withMessage('User account cannot be changed directly on profile update.'),
];

// You might reuse mongoIdParamValidator for routes like GET /api/doctors/:doctorId
// export const getDoctorValidator = mongoIdParamValidator('doctorId');
