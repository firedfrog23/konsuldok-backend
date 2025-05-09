import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';

const medicalDocumentSchema = new mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PatientProfile',
        required: [true, 'Patient is required for the document'],
        index: true,
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Uploader user ID is required'],
        index: true,
    },
    fileName: {
        type: String,
        required: [true, 'Original filename is required'],
        trim: true,
    },
    fileType: { // Mime type (e.g., 'application/pdf', 'image/jpeg')
        type: String,
        required: [true, 'File type (MIME type) is required'],
        trim: true,
        index: true,
    },
    fileSize: { // Size of the file in bytes
        type: Number,
        required: [true, 'File size is required'],
    },
    cloudinaryUrl: { // Secure URL provided by Cloudinary after successful upload
        type: String,
        required: [true, 'Cloudinary URL is required'],
    },
    cloudinaryPublicId: { // Public ID from Cloudinary (needed for deletion/management)
        type: String,
        required: [true, 'Cloudinary Public ID is required'],
        unique: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    documentDate: {
        type: Date,
        index: true,
    },
    tags: {
        type: [String],
        default: [],
        validate: [array => array.every(tag => typeof tag === 'string' && tag.trim().length > 0), 'Tags must be non-empty strings']
    },
});

medicalDocumentSchema.plugin(trackingFieldsPlugin);

// Example compound index for querying documents by patient and date
medicalDocumentSchema.index({ patient: 1, documentDate: -1 }); // -1 for descending order

const MedicalDocument = mongoose.model('MedicalDocument', medicalDocumentSchema);

export default MedicalDocument;
