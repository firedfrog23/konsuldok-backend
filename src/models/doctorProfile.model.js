// src/models/doctorProfile.model.js (Day-Specific Availability)
import mongoose from 'mongoose';
import { trackingFieldsPlugin } from './base.model.js';

// List of common medical specialties in Indonesia (approx. 20)
const commonIndonesianSpecialties = [
    'Penyakit Dalam', // Internal Medicine
    'Anak', // Pediatrics
    'Obstetri & Ginekologi', // Obstetrics & Gynecology
    'Bedah Umum', // General Surgery
    'Mata', // Ophthalmology
    'THT-KL', // ENT (Otolaryngology)
    'Kulit & Kelamin', // Dermatology & Venereology
    'Saraf', // Neurology
    'Kesehatan Jiwa', // Psychiatry
    'Jantung & Pembuluh Darah', // Cardiology & Vascular Medicine
    'Paru', // Pulmonology (Lungs)
    'Ortopedi & Traumatologi', // Orthopedics & Traumatology
    'Radiologi', // Radiology
    'Anestesiologi & Terapi Intensif', // Anesthesiology & Intensive Care
    'Patologi Klinik', // Clinical Pathology
    'Gigi Umum', // General Dentistry
    'Urologi', // Urology
    'Bedah Saraf', // Neurosurgery
    'Onkologi Radiasi', // Radiation Oncology (or 'Penyakit Kanker' - Cancer)
    'Gastroenterologi-Hepatologi', // Gastroenterology-Hepatology
    'Lainnya', // Other
];

// Enum for days of the week (consistent with Date.getDay())
const DayOfWeek = Object.freeze({
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
});
const AvailableDaysOfWeek = Object.values(DayOfWeek);

// Schema for a single availability block within a week
const WeeklyAvailabilitySchema = new mongoose.Schema({
    dayOfWeek: { // 0 for Sunday, 1 for Monday, etc.
        type: Number,
        required: [true, 'Day of the week is required.'],
        enum: AvailableDaysOfWeek,
    },
    startTime: { // Format HH:MM (e.g., "09:00")
        type: String,
        required: [true, 'Start time is required (HH:MM format).'],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid start time format (HH:MM).']
    },
    endTime: { // Format HH:MM (e.g., "17:30")
        type: String,
        required: [true, 'End time is required (HH:MM format).'],
        match: [/^(0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/, 'Invalid end time format (HH:MM).'],
        validate: [function(value) {
            // `this` refers to the WeeklyAvailabilitySchema subdocument instance
            return value > this.startTime;
        }, 'End time must be after start time for the same availability block.']
    }
}, { _id: false }); // Don't create separate IDs for each availability block


// --- Main Doctor Profile Schema ---
const doctorProfileSchema = new mongoose.Schema({
    userAccount: { // Link back to the User model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // One profile per user account
        index: true,
    },
    specialty: {
        type: String,
        required: [true, 'Doctor specialty is required'],
        trim: true,
        index: true,
        enum: {
            values: commonIndonesianSpecialties,
            message: 'Invalid specialty specified. Please select from the provided list.'
        }
    },
    licenseNumber: { // Medical license number (e.g., STR)
        type: String,
        required: [true, 'Medical license number is required'],
        unique: true,
        trim: true,
        index: true,
    },
    yearsOfExperience: {
        type: Number,
        min: 0,
    },
    qualifications: { // Array of degrees, certifications etc.
        type: [String],
        default: [],
    },
    consultationFee: { // Optional: Standard consultation fee
        type: Number,
        min: 0,
    },
    biography: {
        type: String,
        trim: true,
    },
    languagesSpoken: {
        type: [String],
        default: ['Bahasa Indonesia'],
    },

    // --- NEW: Weekly Availability Schedule ---
    // Array of availability blocks. Allows multiple blocks per day (e.g., morning/afternoon)
    // or different times on different days.
    weeklySchedule: {
        type: [WeeklyAvailabilitySchema],
        default: [], // Default to no specific availability set
        // Optional: Add validation to ensure no overlapping slots for the same dayOfWeek
        validate: [function(schedule) {
            if (!schedule || schedule.length === 0) return true;
            // Group slots by day
            const slotsByDay = schedule.reduce((acc, slot) => {
                acc[slot.dayOfWeek] = acc[slot.dayOfWeek] || [];
                acc[slot.dayOfWeek].push({ start: slot.startTime, end: slot.endTime });
                return acc;
            }, {});
            // Check for overlaps within each day
            for (const day in slotsByDay) {
                const daySlots = slotsByDay[day].sort((a, b) => a.start.localeCompare(b.start));
                for (let i = 0; i < daySlots.length - 1; i++) {
                    if (daySlots[i].end > daySlots[i+1].start) {
                        this.invalidate(`weeklySchedule`, `Overlapping time slots detected for day ${day}.`, schedule);
                        return false; // Found overlap
                    }
                }
            }
            return true; // No overlaps found
        }, 'Weekly schedule contains overlapping time slots for the same day.']
    },

});

// Apply the tracking fields plugin
doctorProfileSchema.plugin(trackingFieldsPlugin);

const DoctorProfile = mongoose.model('DoctorProfile', doctorProfileSchema);

export default DoctorProfile;
