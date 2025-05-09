// src/api/routes/user.routes.js
import express from 'express';
// Import specific controller functions directly
import {
	deleteUserByAdmin,
	getAllUsers,
	getUser,
	updateMyProfile,
	updateUserByAdmin
} from '../controllers/user.controller.js';
// Import middleware and validators
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { adminUpdateUserValidator, mongoIdParamValidator, updateUserProfileValidator } from '../validators/user.validator.js';

const router = express.Router();

// All routes below require authentication
router.use(authenticate);

// --- Routes for Admins ---
router.route('/')
    .get(authorize(UserRoles.ADMIN), getAllUsers); // Use imported function

router.route('/:userId')
    .get(authorize(UserRoles.ADMIN), mongoIdParamValidator('userId'), validate, getUser) // Use imported function
    .patch(authorize(UserRoles.ADMIN), mongoIdParamValidator('userId'), adminUpdateUserValidator, validate, updateUserByAdmin) // Use imported function
    .delete(authorize(UserRoles.ADMIN), mongoIdParamValidator('userId'), validate, deleteUserByAdmin); // Use imported function

// --- Routes for Regular Users (Updating Own Profile) ---
router.patch('/profile/me', updateUserProfileValidator, validate, updateMyProfile); // Use imported function

export default router;
