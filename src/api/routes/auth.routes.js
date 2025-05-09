import express from 'express';
import {
	forgotPassword,
	getMe,
	login,
	logout,
	register,
	resetPassword
} from '../controllers/auth.controller.js';
// Import validators and middleware
import { authenticate } from '../middleware/authenticate.js';
import { loginRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import { forgotPasswordValidator, loginValidator, registerValidator, resetPasswordValidator } from '../validators/auth.validator.js';

const router = express.Router();

// Public routes - Use imported functions directly
router.post('/register', registerValidator, validate, register);
router.post('/login', loginRateLimiter, loginValidator, validate, login);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.patch('/reset-password/:token', resetPasswordValidator, validate, resetPassword);

// Protected routes - Use imported functions directly
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);

export default router;
