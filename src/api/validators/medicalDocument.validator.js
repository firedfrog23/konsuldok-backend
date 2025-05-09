import { body } from 'express-validator';

// Validation rules when creating/updating metadata for a medical document
export const documentMetadataValidator = [
    body('patient')
        .if(body('patient').exists())
        .notEmpty()
		.withMessage('Patient ID is required.')
        .isMongoId()
		.withMessage('Invalid Patient ID format.'),
    body('description')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ max: 500 })
		.withMessage('Description cannot exceed 500 characters.')
        .escape(),
    body('documentDate')
        .optional({ checkFalsy: true })
        .isISO8601()
		.toDate()
		.withMessage('Invalid date format for document date.'),
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

    body('fileName')
		.not()
		.exists()
		.withMessage('Filename is set during upload.'),
    body('fileType')
		.not()
		.exists()
		.withMessage('File type is set during upload.'),
    body('fileSize')
		.not()
		.exists()
		.withMessage('File size is set during upload.'),
    body('cloudinaryUrl')
		.not()
		.exists()
		.withMessage('Cloudinary URL is set during upload.'),
    body('cloudinaryPublicId')
		.not()
		.exists()
		.withMessage('Cloudinary Public ID is set during upload.'),
    body('uploadedBy')
		.not()
		.exists()
		.withMessage('Uploader is set internally.'),
];
