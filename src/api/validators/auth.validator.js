// src/validators/auth.validator.js (Remove Escape from Specialty)
import { body } from 'express-validator';
// Import BOTH AvailableUserRoles and the UserRoles enum object
import { AvailableUserRoles, UserRoles } from '../../utils/constants.js'; // Adjust path
// Import specialties list if validating against it here (usually done by model enum)
// import { commonIndonesianSpecialties } from '../../models/doctorProfile.model.js'; // Example if needed

// Regex for common Indonesian phone number formats
const indonesianPhoneRegex = /^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;
// Regex for password complexity: min 8 chars, 1 lowercase, 1 uppercase, 1 number
const passwordComplexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;


// Validation rules for user registration
export const registerValidator = [
    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        // Enforce complexity requirements
        .matches(passwordComplexityRegex)
        .withMessage('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.')
        .trim(), // Trim after validation checks
    body('firstName')
        .notEmpty().withMessage('First name is required.')
        .trim()
        .escape(), // Prevent XSS
    body('lastName')
        .notEmpty().withMessage('Last name is required.')
        .trim()
        .escape(), // Prevent XSS
    body('role')
        .notEmpty().withMessage('Role is required.')
        .isIn(AvailableUserRoles).withMessage('Invalid user role specified.'),
    body('phoneNumber')
        .optional({ checkFalsy: true }) // Allows empty string or null/undefined
        .trim()
        .matches(indonesianPhoneRegex).withMessage('Please provide a valid Indonesian phone number (e.g., 08..., 62..., +62...).')
        .escape(),
    // Add validation for profile fields if passed during registration
    body('dateOfBirth')
        .optional({ checkFalsy: true })
        .isISO8601().toDate().withMessage('Invalid date format for date of birth.'),
    body('gender')
        .optional({ checkFalsy: true })
        // Assuming Genders constant is available or import it from constants.js
        // import { AvailableGenders } from '../../utils/constants.js';
        // .isIn(AvailableGenders).withMessage('Invalid gender specified.')
        ,
    body('address.city')
        .optional({ checkFalsy: true })
        .trim().escape(),
    body('address.province')
        .optional({ checkFalsy: true })
        .trim().escape(),
    // Doctor specific fields (if registering directly)
    body('specialty')
        .if(body('role').equals(UserRoles.DOCTOR)) // Only required if role is Doctor
        .notEmpty().withMessage('Specialty is required for Doctor role.')
        .trim(), // <<<--- REMOVED .escape() HERE
        // The model's enum validator handles the actual list check
        // .isIn(commonIndonesianSpecialties).withMessage('Invalid specialty.') // Usually redundant if model enum is used
    body('licenseNumber')
        .if(body('role').equals(UserRoles.DOCTOR))
        .notEmpty().withMessage('License number is required for Doctor role.')
        .trim()
        .escape(), // Keep escape here as it might contain user input potentially
    // Add similar .if(body('role').equals(UserRoles.STAFF)) for staff-specific fields if needed
    // Add similar .if(body('role').equals(UserRoles.PATIENT)) for patient-specific fields if needed
];

// Validation rules for user login
export const loginValidator = [
    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required.'),
];

// Validation rules for requesting password reset
export const forgotPasswordValidator = [
    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(),
];

// Validation rules for resetting password
export const resetPasswordValidator = [
    body('password')
        .notEmpty().withMessage('New password is required.')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
         // Also enforce complexity on reset
        .matches(passwordComplexityRegex)
        .withMessage('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number.')
        .trim(),
    // Token is validated via route param typically
];
