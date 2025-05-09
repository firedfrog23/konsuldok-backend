import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { AvailableUserRoles, UserRoles } from '../utils/constants.js';
import { trackingFieldsPlugin } from './base.model.js';

// Regex for common Indonesian phone number formats (starting with 08, 62, or +62)
const indonesianPhoneRegex = /^(^\+62|62|^08)(\d{3,4}-?){2}\d{3,4}$/;

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        index: true,
        match: [/.+@.+\..+/, 'Please provide a valid email address'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        select: false, // Exclude password from query results by default
        minlength: [8, 'Password must be at least 8 characters long'],
    },
    passwordChangedAt: {
        type: Date,
        select: false, // Exclude by default, select when needed for comparison
    },
    firstName: {
        type: String,
        required: [true, 'First name is required'],
        trim: true,
    },
    lastName: {
        type: String,
        required: [true, 'Last name is required'],
        trim: true,
    },
    phoneNumber: {
        type: String,
        trim: true,
        match: [indonesianPhoneRegex, 'Please provide a valid Indonesian phone number (e.g., 08..., 62..., +62...).']
    },
    role: {
        type: String,
        required: true,
        enum: {
            values: AvailableUserRoles,
            message: 'Invalid role specified. Valid roles are: ' + AvailableUserRoles.join(', ')
        },
        index: true,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    patientProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PatientProfile',
        required: function() { return this.role === UserRoles.PATIENT; }, // Required only if role is Patient
        default: null,
    },
    doctorProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorProfile',
        required: function() { return this.role === UserRoles.DOCTOR; }, // Required only if role is Doctor
        default: null,
    },
    staffProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffProfile',
        required: function() { return this.role === UserRoles.STAFF; }, // Required only if role is Staff
        default: null,
    },
    passwordResetToken: {
        type: String,
        select: false,
    },
    passwordResetExpires: {
        type: Date,
        select: false,
    },
});

// Apply the tracking fields plugin
userSchema.plugin(trackingFieldsPlugin);

// Pre-save hook to hash password if modified AND update passwordChangedAt
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        // Hash the password with cost of 10
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);

        // Update passwordChangedAt field (subtract 1 second to ensure token issued AFTER change is valid)
        // Do not set passwordChangedAt if the document is new (initial password set)
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000; // Set slightly in the past
        }

        // Clear password reset fields when password changes
        this.passwordResetToken = undefined;
        this.passwordResetExpires = undefined;
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare candidate password with the user's hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    // Ensure the password field was selected when fetching the user
    if (!this.password) {
        // Attempt to refetch the user with the password field if necessary
        const userWithPassword = await this.constructor.findById(this._id).select('+password');
        if (!userWithPassword || !userWithPassword.password) {
			throw new Error('Password field not available for comparison.');
        }
        // Use the fetched password for comparison
        return bcrypt.compare(candidatePassword, userWithPassword.password);
    }
    // If password was already selected, compare directly
    return bcrypt.compare(candidatePassword, this.password);
};


/**
 * Generates a password reset token, hashes it, and sets expiry.
 * @returns {string} The unhashed reset token to be sent to the user.
 */
userSchema.methods.createPasswordResetToken = function() {
    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Hash the token and store it in the database
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

    // Set token expiry time (e.g., 10 minutes from now)
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes in milliseconds

    // Return the unhashed token (this is what gets sent to the user)
    return resetToken;
};

/**
 * Checks if the password was changed after the given JWT timestamp.
 * @param {number} JWTTimestamp - The 'iat' (issued at) timestamp from the JWT payload (in seconds).
 * @returns {boolean} True if password was changed after the token was issued, false otherwise.
 */
userSchema.methods.passwordChangedAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        // Convert passwordChangedAt Date to timestamp in seconds
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);

        // Check if the password was changed AFTER the token was issued
        return JWTTimestamp < changedTimestamp;
    }

    // False means password was NOT changed after the token was issued (or never changed)
    return false;
};


// Virtual for full name
userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`.trim();
});

// Ensure virtuals are included when converting document to JSON/Object
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;
