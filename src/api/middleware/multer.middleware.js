import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';

const tempUploadDir = path.join(path.resolve(), 'temp_uploads');

if (!fs.existsSync(tempUploadDir)) {
    try {
        fs.mkdirSync(tempUploadDir, { recursive: true });
        logger.info(`Temporary upload directory created: ${tempUploadDir}`);
    } catch (err) {
        logger.error(`Error creating temporary upload directory: ${err.message}`);
    }
}


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempUploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const imageFileFilter = (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new ApiError(400, 'Invalid file type. Only JPEG, PNG, GIF, and WEBP images are allowed.'), false); // Reject file
    }
};

// Configure Multer upload instance
const upload = multer({
    storage: storage,
    fileFilter: imageFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB file size limit
    }
});

/**
 * Middleware to handle single file upload.
 * Expects the file to be in a field named 'profilePicture'.
 */
export const uploadProfilePictureMiddleware = upload.single('profilePicture');

/**
 * Middleware to handle errors from Multer.
 * This should be placed after the Multer upload middleware in your route.
 */
export const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // A Multer error occurred when uploading.
        if (err.code === 'LIMIT_FILE_SIZE') {
            return next(new ApiError(400, 'File is too large. Maximum size is 5MB.'));
        }
        // Handle other Multer errors if needed
        return next(new ApiError(400, `File upload error: ${err.message}`));
    } else if (err) {
        return next(err); // This could be the ApiError from fileFilter
    }
    next();
};
