import { body } from 'express-validator';
import { AvailableGenders } from '../../utils/constants.js';

// Regex for common Indonesian phone number formats
const indonesianPhoneRegex = /^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;

// Standard blood types
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Validation for creating a patient profile (usually linked to user creation or done by staff)
export const createPatientProfileValidator = [
    body('dateOfBirth')
        .optional({ checkFalsy: true })
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for date of birth.'),
    body('gender')
        .optional({ checkFalsy: true })
        .isIn(AvailableGenders)
		.withMessage('Invalid gender specified.'),
    body('address.street')
		.optional()
		.trim()
		.escape(),
    body('address.city')
		.optional()
		.trim()
		.escape(),
    body('address.province')
		.optional()
		.trim()
		.escape(),
    body('address.postalCode')
		.optional()
		.trim()
		.escape(),
    body('address.country')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.name')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.relationship')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(indonesianPhoneRegex)
		.withMessage('Please provide a valid Indonesian phone number for emergency contact.')
        .escape(),
    body('bloodType')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(bloodTypes)
		.withMessage('Invalid blood type specified. Valid types are: ' + bloodTypes.join(', '))
        .escape(),
    body('allergies')
		.optional()
		.isArray()
		.withMessage('Allergies must be an array of strings.'),
    body('allergies.*')
		.optional()
		.isString()
		.trim()
		.escape(),
    body('medicalHistorySummary')
		.optional()
		.trim()
		.escape(),
    body('insuranceProvider')
		.optional()
		.trim()
		.escape(),
    body('insurancePolicyNumber')
		.optional()
		.trim()
		.escape(),
];

// Validation for updating a patient profile
export const updatePatientProfileValidator = [
    // Use mongoIdParamValidator for the patient profile ID if needed in the route param
    // Example: ...mongoIdParamValidator('patientProfileId'),
    body('dateOfBirth')
        .optional({ checkFalsy: true })
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for date of birth.'),
    body('gender')
        .optional({ checkFalsy: true })
        .isIn(AvailableGenders)
		.withMessage('Invalid gender specified.'),
    body('address.street')
		.optional()
		.trim()
		.escape(),
    body('address.city')
		.optional()
		.trim()
		.escape(),
    body('address.province')
		.optional()
		.trim()
		.escape(),
    body('address.postalCode')
		.optional()
		.trim()
		.escape(),
    body('address.country')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.name')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.relationship')
		.optional()
		.trim()
		.escape(),
    body('emergencyContact.phone')
        .optional({ checkFalsy: true })
        .trim()
        .matches(indonesianPhoneRegex)
		.withMessage('Please provide a valid Indonesian phone number for emergency contact.')
        .escape(),
    body('bloodType')
        .optional({ checkFalsy: true })
        .trim()
        .isIn(bloodTypes)
		.withMessage('Invalid blood type specified. Valid types are: ' + bloodTypes.join(', '))
        .escape(),
    body('allergies')
		.optional()
		.isArray()
		.withMessage('Allergies must be an array of strings.'),
    body('allergies.*')
		.optional()
		.isString()
		.trim()
		.escape(),
    body('medicalHistorySummary')
		.optional()
		.trim()
		.escape(),
    body('insuranceProvider')
		.optional()
		.trim()
		.escape(),
    body('insurancePolicyNumber')
		.optional()
		.trim()
		.escape(),
    body('userAccount')
		.not()
		.exists()
		.withMessage('User account cannot be changed.'),
];
