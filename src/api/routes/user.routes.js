// src/api/routes/user.routes.js
import express from 'express';
import {
    getAllUsers,
    getUser,
    updateMyProfile,
    updateUserByAdmin,
    deleteUserByAdmin,
    updateProfilePicture
} from '../controllers/user.controller.js';
import { UserRoles } from '../../utils/constants.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
    adminUpdateUserValidator,
    mongoIdParamValidator,
    updateUserProfileValidator
    // Add a validator for profile picture if needed (e.g., for other fields sent with it)
} from '../validators/user.validator.js';
import { uploadProfilePictureMiddleware, handleMulterError } from '../middleware/multer.middleware.js';


const router = express.Router();

// All routes below require authentication by default
router.use(authenticate);

// --- Routes for Users (Managing Own Profile) ---
router.patch(
    '/profile/me',
    updateUserProfileValidator, // Validate text fields if any
    validate,
    updateMyProfile
);

router.patch(
    '/profile/picture',
    uploadProfilePictureMiddleware, // 1. Multer handles file upload
    handleMulterError,             // 2. Handle Multer-specific errors
    updateProfilePicture           // 3. Controller processes the file
);

// --- Routes for Admins (Managing All Users) ---
router.route('/')
    .get(authorize(UserRoles.ADMIN), getAllUsers);

router.route('/:userId')
    .get(
        authorize(UserRoles.ADMIN),
        mongoIdParamValidator('userId'),
        validate,
        getUser
    )
    .patch(
        authorize(UserRoles.ADMIN),
        mongoIdParamValidator('userId'),
        adminUpdateUserValidator, // Validator for admin updates
        validate,
        updateUserByAdmin
    )
    .delete(
        authorize(UserRoles.ADMIN),
        mongoIdParamValidator('userId'),
        validate,
        deleteUserByAdmin
    );

export default router;
