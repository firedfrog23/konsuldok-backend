import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';
import { AvailableGenders, Genders } from '../utils/constants.js';

// Define standard blood types
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const patientProfileSchema = new mongoose.Schema({
    userAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true,
    },
    dateOfBirth: {
        type: Date,
    },
    gender: {
        type: String,
        enum: AvailableGenders,
    },
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        province: { type: String, trim: true },
        postalCode: { type: String, trim: true },
        country: { type: String, default: 'Indonesia', trim: true }
    },
    emergencyContact: {
        name: { type: String, trim: true },
        relationship: { type: String, trim: true },
        phone: { type: String, trim: true },
    },
    bloodType: {
        type: String,
        trim: true,
        enum: {
            values: bloodTypes,
            message: 'Invalid blood type specified. Valid types are: ' + bloodTypes.join(', ')
        }
    },
    allergies: {
        type: [String],
        default: [],
    },
    medicalHistorySummary: {
        type: String,
        trim: true,
    },
    insuranceProvider: { type: String, trim: true },
    insurancePolicyNumber: { type: String, trim: true },
});

patientProfileSchema.plugin(trackingFieldsPlugin);

// Age calculation
patientProfileSchema.virtual('age').get(function() {
    if (!this.dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(this.dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
});

// Ensure virtuals are included
patientProfileSchema.set('toJSON', { virtuals: true });
patientProfileSchema.set('toObject', { virtuals: true });


const PatientProfile = mongoose.model('PatientProfile', patientProfileSchema);

export default PatientProfile;
