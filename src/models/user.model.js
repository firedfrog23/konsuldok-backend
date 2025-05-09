import bcrypt from 'bcrypt';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { AvailableUserRoles, UserRoles } from '../utils/constants.js';
import { trackingFieldsPlugin } from './base.model.js';

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
        select: false,
        minlength: [8, 'Password must be at least 8 characters long'],
    },
    passwordChangedAt: {
        type: Date,
        select: false,
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
    // --- ADDED FOR PROFILE PICTURE ---
    profilePictureUrl: {
        type: String,
        trim: true,
        default: null, // Or a URL to a default avatar
    },
    profilePictureCloudinaryId: {
        type: String,
        trim: true,
        default: null,
    },
    // --- END ADDED ---
    patientProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PatientProfile',
        required: function() { return this.role === UserRoles.PATIENT; },
        default: null,
    },
    doctorProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorProfile',
        required: function() { return this.role === UserRoles.DOCTOR; },
        default: null,
    },
    staffProfile: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StaffProfile',
        required: function() { return this.role === UserRoles.STAFF; },
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

userSchema.plugin(trackingFieldsPlugin);

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000;
        }
        this.passwordResetToken = undefined;
        this.passwordResetExpires = undefined;
        next();
    } catch (err) {
        next(err);
    }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) {
        const userWithPassword = await this.constructor.findById(this._id).select('+password');
        if (!userWithPassword || !userWithPassword.password) {
            throw new Error('Password field not available for comparison.');
        }
        return bcrypt.compare(candidatePassword, userWithPassword.password);
    }
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    return resetToken;
};

userSchema.methods.passwordChangedAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

userSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

export default User;
