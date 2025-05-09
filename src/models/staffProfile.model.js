import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';

const staffProfileSchema = new mongoose.Schema({
    userAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    jobTitle: {
        type: String,
        required: [true, 'Job title is required'],
        trim: true,
        index: true,
    },
    department: {
        type: String,
        trim: true,
        index: true,
    },
    employeeId: {
        type: String,
        trim: true,
        unique: true,
        sparse: true,
        index: true,
    },
    hireDate: {
        type: Date,
    },
    certifications: {
        type: [String],
        default: [],
    },
});

// Apply the tracking fields plugin
staffProfileSchema.plugin(trackingFieldsPlugin);

const StaffProfile = mongoose.model('StaffProfile', staffProfileSchema);

export default StaffProfile;
