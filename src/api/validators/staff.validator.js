import { body } from 'express-validator';

// Validation for creating/updating a staff profile (usually by Admin)
export const staffProfileValidator = [
    body('jobTitle')
        .notEmpty()
		.withMessage('Job title is required.')
        .trim()
        .escape(),
    body('department')
        .optional({ checkFalsy: true })
        .trim()
        .escape(),
    body('employeeId')
        .optional({ checkFalsy: true })
        .trim()
        .escape(),
    body('hireDate')
        .optional({ checkFalsy: true })
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for hire date.'),
    body('certifications')
        .optional()
        .isArray()
		.withMessage('Certifications must be an array of strings.'),
    body('certifications.*')
        .optional()
        .isString()
		.trim()
		.escape(),
    body('userAccount')
		.not()
		.exists()
		.withMessage('User account cannot be changed directly on profile update.'),
];
