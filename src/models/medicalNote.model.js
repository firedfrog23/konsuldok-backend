import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';

const medicalNoteSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PatientProfile',
        required: [true, 'Patient is required for the medical note'],
        index: true,
    },
    authoredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Should be a User with role 'Doctor' or 'Staff'
        required: [true, 'Author (Doctor/Staff) is required'],
        index: true,
    },
    consultationDate: { // The date the consultation/event occurred
        type: Date,
        required: [true, 'Consultation date is required'],
        default: Date.now,
        index: true,
    },
    noteContent: { // The actual text content of the note
        type: String,
        required: [true, 'Note content cannot be empty'],
        trim: true,
        maxlength: [5000, 'Note content exceeds maximum length of 5000 characters'],
    },
    tags: {
        type: [String],
        default: [],
        validate: [array => array.every(tag => typeof tag === 'string' && tag.trim().length > 0), 'Tags must be non-empty strings']
    },
    appointment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment',
        index: true
    }
});

// Apply the tracking fields plugin
medicalNoteSchema.plugin(trackingFieldsPlugin);

// Example compound index for querying notes by patient and date
medicalNoteSchema.index({ patient: 1, consultationDate: -1 }); // -1 for descending order (recent first)

const MedicalNote = mongoose.model('MedicalNote', medicalNoteSchema);

export default MedicalNote;
