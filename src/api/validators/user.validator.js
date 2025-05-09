import { body, param } from 'express-validator';
import { AvailableUserRoles } from '../../utils/constants.js';

// Regex for common Indonesian phone number formats
const indonesianPhoneRegex = /^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;

// Validation rules for updating a user's own profile
export const updateUserProfileValidator = [
    body('firstName')
        .optional()
        .notEmpty()
		.withMessage('First name cannot be empty.')
        .trim()
        .escape(),
    body('lastName')
        .optional()
        .notEmpty()
		.withMessage('Last name cannot be empty.')
        .trim()
        .escape(),
    body('phoneNumber')
        .optional({ checkFalsy: true })
        .trim()
        .matches(indonesianPhoneRegex)
		.withMessage('Please provide a valid Indonesian phone number (e.g., 08..., 62..., +62...).')
        .escape(),
];

// Validation rules for admin updating any user's profile/status
export const adminUpdateUserValidator = [
    param('userId')
        .notEmpty()
		.withMessage('User ID parameter is required.')
        .isMongoId()
		.withMessage('Invalid User ID format.'),
    body('firstName')
        .optional()
        .notEmpty()
		.withMessage('First name cannot be empty.')
        .trim()
        .escape(),
    body('lastName')
        .optional()
        .notEmpty()
		.withMessage('Last name cannot be empty.')
        .trim()
        .escape(),
    body('phoneNumber')
        .optional({ checkFalsy: true })
        .trim()
        .matches(indonesianPhoneRegex)
		.withMessage('Please provide a valid Indonesian phone number (e.g., 08..., 62..., +62...).')
        .escape(),
    body('role')
        .optional()
        .isIn(AvailableUserRoles)
		.withMessage('Invalid user role specified.'),
    body('isActive')
        .optional()
        .isBoolean()
		.withMessage('isActive must be a boolean value (true or false).'),
    body('email')
		.not()
		.exists()
		.withMessage('Email cannot be updated via this route.'),
    body('password')
		.not()
		.exists()
		.withMessage('Password cannot be updated via this route.'),
];

// Basic validation for checking MongoDB ObjectId in params
export const mongoIdParamValidator = (paramName = 'id') => [
    param(paramName)
        .notEmpty().withMessage(`${paramName} parameter is required.`)
        .isMongoId().withMessage(`Invalid ${paramName} format.`)
];
