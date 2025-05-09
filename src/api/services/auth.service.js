// src/api/services/auth.service.js (Populate Profile)
// Placeholder for authentication business logic

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js'; // Adjust path
import DoctorProfile from '../../models/doctorProfile.model.js'; // Adjust path
import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import StaffProfile from '../../models/staffProfile.model.js'; // Adjust path
import User from '../../models/user.model.js'; // Adjust path
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import { sendEmail } from '../../utils/emailSender.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Registers a new user and associated profile.
 * @param {object} userData - User registration data from controller.
 * @returns {Promise<object>} Object containing user and tokens.
 */
export const registerUser = async (userData) => {
    const { email, password, firstName, lastName, role, phoneNumber, ...profileData } = userData;
    logger.debug('AuthService: Attempting to register user:', email, role);

    // 1. Check if email already exists
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
        throw new ApiError(400, 'Email address is already registered.');
    }

    // 2. Create User instance (don't save yet)
    const newUser = new User({ email, password, firstName, lastName, role, phoneNumber });

    // 3. Based on role, create corresponding Profile document
    let profile = null;
    try {
        if (role === UserRoles.PATIENT) {
            profile = new PatientProfile({ userAccount: newUser._id, ...profileData });
            await profile.save();
            newUser.patientProfile = profile._id;
        } else if (role === UserRoles.DOCTOR) {
            profile = new DoctorProfile({ userAccount: newUser._id, ...profileData });
            await profile.save();
            newUser.doctorProfile = profile._id;
        } else if (role === UserRoles.STAFF) {
            profile = new StaffProfile({ userAccount: newUser._id, ...profileData });
            await profile.save();
            newUser.staffProfile = profile._id;
        }

        // 4. Save the user with the linked profile ID (triggers validation and password hash)
        await newUser.save();

    } catch (error) {
        // Clean up created user/profile if linking fails
        logger.error(`Registration Error: Failed to create profile or link user for ${email}`, error);
        if (profile && profile._id) {
            if (role === UserRoles.PATIENT) await PatientProfile.findByIdAndDelete(profile._id).catch(e => logger.error("Cleanup failed:", e));
            if (role === UserRoles.DOCTOR) await DoctorProfile.findByIdAndDelete(profile._id).catch(e => logger.error("Cleanup failed:", e));
            if (role === UserRoles.STAFF) await StaffProfile.findByIdAndDelete(profile._id).catch(e => logger.error("Cleanup failed:", e));
        }
        // If user was created but profile failed, delete user (or handle differently)
        // This assumes user creation itself didn't fail validation before profile creation attempt
        // await User.findByIdAndDelete(newUser._id).catch(e => logger.error("User cleanup failed:", e));

        if (error.code === 11000) throw new ApiError(400, 'Duplicate value error during profile creation.');
        // Rethrow Mongoose validation errors directly
        if (error.name === 'ValidationError') throw error;
        throw new ApiError(500, `User registration failed: ${error.message}`);
    }

    // 5. Generate JWT access token
    const payload = { id: newUser._id, role: newUser.role };
    const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    logger.info(`User registered successfully: ${newUser.email} (ID: ${newUser._id})`);
    // Return user object (re-fetch with populated profile)
    const userObject = await getUserProfile(newUser._id, newUser.role); // Use getUserProfile
    return { user: userObject, accessToken };
};

/**
 * Logs in a user.
 * @param {string} email - User's email.
 * @param {string} password - User's plain text password.
 * @returns {Promise<object>} Object containing user and tokens.
 */
export const loginUser = async (email, password) => {
    logger.debug('AuthService: Attempting login for user:', email);
    const user = await User.findOne({ email: email, isDeleted: { $ne: true } }).select('+password +passwordChangedAt');

    if (!user || !(await user.comparePassword(password))) {
        throw new ApiError(401, 'Invalid email or password.');
    }
    if (!user.isActive) {
        throw new ApiError(401, 'Account is inactive. Please contact support.');
    }

    const payload = { id: user._id, role: user.role };
    const accessToken = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });

    logger.info(`User logged in successfully: ${user.email} (ID: ${user._id})`);
    // Return user object (re-fetch with populated profile)
    const userObject = await getUserProfile(user._id, user.role); // Use getUserProfile
    return { user: userObject, accessToken };
};

/**
 * Handles forgot password request.
 * @param {string} email - User's email.
 */
export const requestPasswordReset = async (email) => {
    logger.debug('AuthService: Requesting password reset for:', email);
    const user = await User.findOne({ email: email, isActive: true, isDeleted: { $ne: true } });

    if (user) {
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        // Adjust frontend URL from config if needed
        const resetURL = `${config.cors.origin[0]}/reset-password/${resetToken}`;

        const message = `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}\nIf you didn't forget your password, please ignore this email. This link expires in 10 minutes.`;

        try {
            await sendEmail({
                to: user.email,
                subject: 'Your KonsulDok Password Reset Token (Valid for 10 min)',
                text: message,
            });
            logger.info(`Password reset email sent successfully to ${user.email}`);
        } catch (emailError) {
            logger.error(`Failed to send password reset email to ${user.email}`, emailError);
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validateBeforeSave: false });
            throw new ApiError(500, 'Failed to send password reset email. Please try again later.');
        }
    } else {
        logger.warn(`Password reset requested for non-existent or inactive email: ${email}`);
    }
};

/**
 * Resets user password using a valid token.
 * @param {string} token - The unhashed reset token from the URL.
 * @param {string} newPassword - The new password.
 */
export const resetPasswordWithToken = async (token, newPassword) => {
    logger.debug('AuthService: Attempting password reset with token');
    const hashedToken = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
        throw new ApiError(400, 'Token is invalid or has expired.');
    }

    user.password = newPassword;
    // passwordResetToken and passwordResetExpires are cleared by pre-save hook
    await user.save(); // Triggers pre-save hook

    logger.info(`Password reset successfully for user ${user.email}`);
};

/**
 * Fetches detailed profile based on user role by populating the relevant field.
 * @param {string} userId - User ID.
 * @param {string} userRole - User Role.
 * @returns {Promise<object>} User object populated with profile details.
 */
export const getUserProfile = async (userId, userRole) => {
    logger.debug(`AuthService: Fetching profile for user ${userId} with role ${userRole}`);
    // Determine which profile path to populate based on the role
    let populatePath = '';
    if (userRole === UserRoles.PATIENT) populatePath = 'patientProfile';
    else if (userRole === UserRoles.DOCTOR) populatePath = 'doctorProfile';
    else if (userRole === UserRoles.STAFF) populatePath = 'staffProfile';

    // Base query to find the user (active and not deleted)
    // Exclude sensitive fields by default
    const query = User.findOne({ _id: userId, isActive: true, isDeleted: { $ne: true } })
                    .select('-password -__v -passwordChangedAt -passwordResetToken -passwordResetExpires');

    // Populate the determined path if it exists
    if (populatePath) {
        query.populate({
            path: populatePath,
            select: '-__v -userAccount' // Exclude internal fields from the profile
        });
    }

    const userWithProfile = await query.exec();

    if (!userWithProfile) {
        throw new ApiError(404, 'User not found or is inactive.');
    }

    // Convert to plain object if needed, Mongoose docs are fine too
    return userWithProfile;
};
