import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';
import { AvailableAppointmentStatuses, AppointmentStatus } from '../utils/constants.js';

const appointmentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PatientProfile',
        required: [true, 'Patient is required for the appointment'],
        index: true,
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DoctorProfile',
        required: [true, 'Doctor is required for the appointment'],
        index: true,
    },
    scheduledByStaff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    appointmentTime: {
        type: Date,
        required: [true, 'Appointment time is required'],
        index: true,
    },
    durationMinutes: {
        type: Number,
        default: 30,
        min: [5, 'Duration must be at least 5 minutes'],
    },
    reasonForVisit: {
        type: String,
        trim: true,
        maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    status: {
        type: String,
        required: true,
        enum: {
            values: AvailableAppointmentStatuses,
            message: 'Invalid appointment status.'
        },
        default: AppointmentStatus.REQUESTED,
        index: true,
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    },

    completionNotes: {
        type: String,
        trim: true,
    },
    // Optional: Type of service requested/provided
    // serviceType: {
    //     type: String,
    //     trim: true
    // }
});

// Apply the tracking fields plugin
appointmentSchema.plugin(trackingFieldsPlugin);

appointmentSchema.index({ doctor: 1, appointmentTime: 1 });
appointmentSchema.index({ patient: 1, appointmentTime: 1 });


const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
