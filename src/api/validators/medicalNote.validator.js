import { body } from 'express-validator';

// Validation for creating a medical note
export const createMedicalNoteValidator = [
    body('patient')
        .notEmpty()
		.withMessage('Patient ID is required.')
        .isMongoId()
		.withMessage('Invalid Patient ID format.'),
    body('consultationDate')
        .optional()
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for consultation date.'),
    body('noteContent')
        .notEmpty()
		.withMessage('Note content cannot be empty.')
        .trim()
        .isLength({ max: 5000 })
		.withMessage('Note content exceeds maximum length of 5000 characters.')
        .escape(),
    body('tags')
        .optional()
        .isArray()
		.withMessage('Tags must be an array.'),
    body('tags.*')
        .optional()
        .isString()
		.withMessage('Tags must be strings.')
        .trim()
        .notEmpty()
		.withMessage('Tags cannot be empty strings.')
        .escape(),
    body('appointment')
        .optional()
        .isMongoId()
		.withMessage('Invalid Appointment ID format.'),
    body('authoredBy')
		.not()
		.exists()
		.withMessage('Author cannot be set manually.'),
];

// Validation for updating a medical note
export const updateMedicalNoteValidator = [
    body('consultationDate')
        .optional()
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for consultation date.'),
    body('noteContent')
        .optional()
        .notEmpty()
		.withMessage('Note content cannot be empty.')
        .trim()
        .isLength({ max: 5000 })
		.withMessage('Note content exceeds maximum length of 5000 characters.')
        .escape(),
    body('tags')
        .optional()
        .isArray()
		.withMessage('Tags must be an array.'),
    body('tags.*')
        .optional()
        .isString()
		.withMessage('Tags must be strings.')
        .trim()
        .notEmpty()
		.withMessage('Tags cannot be empty strings.')
        .escape(),
    body('appointment')
        .optional({ nullable: true })
        .isMongoId()
		.withMessage('Invalid Appointment ID format.'),
    body('patient')
		.not()
		.exists()
		.withMessage('Patient cannot be changed.'),
    body('authoredBy')
		.not()
		.exists()
		.withMessage('Author cannot be changed.'),
];
