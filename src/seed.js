// seed.js (Weekly Schedule & Specialty Coverage)
// Script to populate the KonsulDok database with dummy data using Faker.js and arguments.
// WARNING: This script ALWAYS DELETES existing data before seeding.

import { faker } from '@faker-js/faker/locale/id_ID'; // Use Indonesian locale
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Import Config, Models, Utils ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, './.env') }); // Load .env from root

// Corrected import paths assuming seed.js is in the root
import connectDB from './config/db.js';
import {
    Appointment,
    DoctorProfile,
    MedicalDocument,
    MedicalNote,
    PatientProfile,
    StaffProfile,
    User
} from './models/index.js'; // Use the index exporter
import { AppointmentStatus, Genders, UserRoles } from './utils/constants.js';
import logger from './utils/logger.js';

// --- Configuration from Arguments ---
const ARGS = process.argv.slice(2).reduce((acc, arg) => {
    const [key, value] = arg.split('=');
    acc[key] = value === undefined ? true : value; // Handle flags
    return acc;
}, {});

// Ensure NUM_DOCTORS is at least the number of specialties
const commonIndonesianSpecialties = [
    'Penyakit Dalam', 'Anak', 'Obstetri & Ginekologi', 'Bedah Umum', 'Mata',
    'THT-KL', 'Kulit & Kelamin', 'Saraf', 'Kesehatan Jiwa', 'Jantung & Pembuluh Darah',
    'Paru', 'Ortopedi & Traumatologi', 'Radiologi', 'Anestesiologi & Terapi Intensif',
    'Patologi Klinik', 'Gigi Umum', 'Urologi', 'Bedah Saraf', 'Onkologi Radiasi',
    'Gastroenterologi-Hepatologi', 'Lainnya',
];
const MIN_DOCTORS = commonIndonesianSpecialties.filter(s => s !== 'Lainnya').length; // Minimum needed to cover specialties
const requestedDoctors = parseInt(ARGS['--doctors'] || MIN_DOCTORS.toString(), 10); // Default to minimum
const NUM_DOCTORS = Math.max(requestedDoctors, MIN_DOCTORS); // Ensure we have enough doctors

const NUM_PATIENTS = parseInt(ARGS['--patients'] || '20', 10);
const NUM_STAFF = parseInt(ARGS['--staff'] || '3', 10);
const NUM_APPOINTMENTS = parseInt(ARGS['--appointments'] || '30', 10);
const NUM_NOTES = parseInt(ARGS['--notes'] || '40', 10);
const NUM_DOCUMENTS = parseInt(ARGS['--documents'] || '15', 10);
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Password123!';


// --- Database Connection ---
const disconnectDB = async () => {
    try {
        await mongoose.connection.close();
        logger.info('MongoDB Disconnected.');
    } catch (err) {
        logger.error(`Error disconnecting MongoDB: ${err.message}`);
        process.exit(1);
    }
};

// --- Data Generation Functions ---

// Creates base user data object (not saved yet).
const createBaseUser = (role, password) => {
    const gender = faker.helpers.arrayElement(['male', 'female']);
    const firstName = faker.person.firstName(gender);
    const lastName = faker.person.lastName();
    const emailDomain = {
        [UserRoles.ADMIN]: 'konsuldok.admin.local',
        [UserRoles.DOCTOR]: 'konsuldok.doctor.local',
        [UserRoles.STAFF]: 'konsuldok.staff.local',
        [UserRoles.PATIENT]: 'mail.local',
    }[role] || 'mail.error';

    const numDigits = faker.number.int({ min: 9, max: 11 });
    const remainingDigits = faker.string.numeric(numDigits);
    const generatedPhoneNumber = `08${remainingDigits}`;

    return {
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName, provider: emailDomain }).toLowerCase(),
        password: password, // Plain password, will be hashed by pre-save hook
        role: role,
        phoneNumber: generatedPhoneNumber,
        isActive: true,
    };
};

// Generates a weekly schedule with varying slots
const generateWeeklySchedule = () => {
    const schedule = [];
    const workDays = faker.helpers.arrayElements([1, 2, 3, 4, 5, 6], faker.number.int({ min: 3, max: 5 })); // Mon-Sat

    workDays.forEach(day => {
        // Possibility of morning and afternoon slots
        const hasMorningSlot = faker.datatype.boolean(0.9); // 90% chance of morning
        const hasAfternoonSlot = faker.datatype.boolean(0.8); // 80% chance of afternoon

        if (hasMorningSlot) {
            const startHour = faker.number.int({ min: 7, max: 9 });
            const endHour = faker.number.int({ min: startHour + 2, max: 12 }); // Ensure end > start
            schedule.push({
                dayOfWeek: day,
                startTime: `${String(startHour).padStart(2, '0')}:00`,
                endTime: `${String(endHour).padStart(2, '0')}:${faker.helpers.arrayElement(['00', '30'])}`,
            });
        }
        if (hasAfternoonSlot) {
            const startHour = faker.number.int({ min: 13, max: 15 });
            const endHour = faker.number.int({ min: startHour + 2, max: 18 }); // Ensure end > start
             // Avoid overlap with potential morning slot (basic check)
            const morningEnd = schedule.find(s => s.dayOfWeek === day)?.endTime || "00:00";
            if (`${String(startHour).padStart(2, '0')}:00` > morningEnd) {
                schedule.push({
                    dayOfWeek: day,
                    startTime: `${String(startHour).padStart(2, '0')}:00`,
                    endTime: `${String(endHour).padStart(2, '0')}:${faker.helpers.arrayElement(['00', '30'])}`,
                });
            }
        }
    });
    return schedule;
};


// Creates profile data object (not saved yet).
const createDoctorProfileData = (userId, adminUserId, specialty) => { // Accept specialty
    return {
        userAccount: userId,
        specialty: specialty, // Use assigned specialty
        licenseNumber: `STR-DOC-${faker.string.alphanumeric(7).toUpperCase()}`,
        yearsOfExperience: faker.number.int({ min: 1, max: 30 }),
        qualifications: [faker.helpers.arrayElement(['Sp.PD', 'Sp.A', 'Sp.JP', 'Sp.B', 'dr.', 'Sp.M', 'Sp.KK', 'Sp.THT-KL', 'Sp.N', 'drg.']), faker.company.name() + ' University'],
        // clinicAddress field removed as requested
        consultationFee: faker.number.int({ min: 50000, max: 500000 }),
        biography: faker.lorem.paragraph(),
        languagesSpoken: ['Bahasa Indonesia', ...(faker.datatype.boolean(0.3) ? ['English'] : [])],
        weeklySchedule: generateWeeklySchedule(), // Generate the new schedule format
        createdBy: adminUserId,
    };
};

// Creates profile data object (not saved yet).
const createStaffProfileData = (userId, adminUserId) => {
    return {
        userAccount: userId,
        jobTitle: faker.helpers.arrayElement(['Perawat', 'Resepsionis', 'Admin Poli', 'Asisten Dokter', 'Staf Pendaftaran']),
        department: faker.helpers.arrayElement(['Poli Umum', 'Pendaftaran', 'Rawat Jalan', 'Administrasi']),
        employeeId: `STF-${faker.string.alphanumeric(5).toUpperCase()}`,
        hireDate: faker.date.past({ years: 5 }),
        certifications: faker.datatype.boolean(0.2) ? [faker.lorem.words(2)] : [],
        createdBy: adminUserId,
    };
};

// Creates profile data object (not saved yet).
const createPatientProfileData = (userId, staffUserId) => {
    const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const allergies = ['Tidak Ada', 'Debu', 'Dingin', 'Obat (Amoxicillin)', 'Makanan (Udang)', 'Bulu Hewan', 'Kacang'];
    const numDigitsEC = faker.number.int({ min: 9, max: 11 });
    const remainingDigitsEC = faker.string.numeric(numDigitsEC);
    const emergencyPhoneNumber = `08${remainingDigitsEC}`;

    return {
        userAccount: userId,
        dateOfBirth: faker.date.birthdate({ min: 1, max: 90, mode: 'age' }),
        gender: faker.helpers.arrayElement(Object.values(Genders).filter(g => g !== Genders.PREFER_NOT_TO_SAY)),
        address: {
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            province: faker.location.state(),
            postalCode: faker.location.zipCode(),
        },
        emergencyContact: {
            name: faker.person.fullName(),
            relationship: faker.helpers.arrayElement(['Orang Tua', 'Pasangan', 'Anak', 'Saudara']),
            phone: emergencyPhoneNumber,
        },
        bloodType: faker.helpers.arrayElement(bloodTypes),
        allergies: faker.helpers.arrayElements(allergies, faker.number.int({ min: 0, max: 2 })).filter(a => a !== 'Tidak Ada'),
        medicalHistorySummary: faker.datatype.boolean(0.4) ? faker.lorem.sentence() : '',
        insuranceProvider: faker.datatype.boolean(0.6) ? faker.company.name() : '',
        insurancePolicyNumber: faker.datatype.boolean(0.6) ? faker.string.alphanumeric(10).toUpperCase() : '',
        createdBy: staffUserId,
    };
};

// Creates appointment data object (not saved yet).
const createAppointmentData = (patientProfileId, doctorProfileId, creatorUserId) => {
    const futureDate = faker.date.soon({ days: 45 });
    futureDate.setHours(faker.number.int({ min: 8, max: 16 }), faker.helpers.arrayElement([0, 30]), 0, 0);
    const day = futureDate.getDay();
    if (day === 0) futureDate.setDate(futureDate.getDate() + 1);

    const reasons = ['Konsultasi Rutin', 'Pemeriksaan Kesehatan', 'Keluhan Demam', 'Sakit Kepala', 'Kontrol Pasca Rawat', 'Vaksinasi', 'Imunisasi Anak', 'Pusing', 'Mual'];
    const statuses = [AppointmentStatus.REQUESTED, AppointmentStatus.CONFIRMED];

    return {
        patient: patientProfileId,
        doctor: doctorProfileId,
        appointmentTime: futureDate,
        durationMinutes: faker.helpers.arrayElement([15, 30, 45]),
        status: faker.helpers.arrayElement(statuses),
        reasonForVisit: faker.helpers.arrayElement(reasons),
        createdBy: creatorUserId,
        updatedBy: creatorUserId,
    };
};

// Creates medical note data object (not saved yet).
const createMedicalNoteData = (patientProfileId, authorUserId, appointmentId = null) => {
    return {
        patient: patientProfileId,
        authoredBy: authorUserId,
        consultationDate: faker.date.recent({ days: 60 }),
        noteContent: faker.lorem.paragraphs(faker.number.int({ min: 1, max: 3 })),
        tags: faker.helpers.arrayElements(['Follow Up', 'Diagnosis', 'Resep', 'Observasi', 'Rujukan'], faker.number.int({ min: 0, max: 3 })),
        appointment: appointmentId,
        createdBy: authorUserId,
        updatedBy: authorUserId,
    };
};

// Creates medical document data object (not saved yet).
const createMedicalDocumentData = (patientProfileId, uploaderUserId) => {
    const fileTypes = [
        { ext: 'pdf', mime: 'application/pdf', type: 'raw' },
        { ext: 'jpg', mime: 'image/jpeg', type: 'image' },
        { ext: 'png', mime: 'image/png', type: 'image' },
        { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', type: 'raw' },
    ];
    const chosenType = faker.helpers.arrayElement(fileTypes);
    const fileName = `${faker.lorem.slug()}_${faker.system.commonFileName(chosenType.ext)}`;

    return {
        patient: patientProfileId,
        uploadedBy: uploaderUserId,
        fileName: fileName,
        fileType: chosenType.mime,
        fileSize: faker.number.int({ min: 50 * 1024, max: 5 * 1024 * 1024 }),
        cloudinaryUrl: `https://res.cloudinary.com/demo/${chosenType.type}/upload/${faker.string.alphanumeric(10)}.${chosenType.ext}`, // Dummy URL
        cloudinaryPublicId: `konsuldok_uploads/${faker.string.alphanumeric(15)}`, // Dummy Public ID
        description: faker.lorem.sentence(),
        documentDate: faker.date.past({ years: 1 }),
        tags: faker.helpers.arrayElements(['Laboratorium', 'Radiologi', 'Resep Luar', 'Resume Medis', 'Hasil Tes'], faker.number.int({ min: 0, max: 2 })),
        createdBy: uploaderUserId,
        updatedBy: uploaderUserId,
    };
};

// --- Main Seeding Function ---
const seedDatabase = async () => {
    logger.info('--- Database Seeding Script ---');
    logger.info('Configuration:');
    logger.warn('  !! Existing data WILL BE DELETED !!'); // Updated log
    logger.info(`  Doctors: ${NUM_DOCTORS} (Ensuring >= ${MIN_DOCTORS} specialties)`);
    logger.info(`  Patients: ${NUM_PATIENTS}, Staff: ${NUM_STAFF}`);
    logger.info(`  Appointments: ${NUM_APPOINTMENTS}, Notes: ${NUM_NOTES}, Documents: ${NUM_DOCUMENTS}`);
    logger.info(`  Default Password: ${DEFAULT_PASSWORD}`);
    logger.info('---------------------------------');

    try {
        await connectDB();

        // --- Clear Existing Data (Now runs unconditionally) ---
        logger.warn('\nDeleting existing data...');
        try {
            await Appointment.deleteMany({}); logger.info('  Appointments deleted.');
            await MedicalNote.deleteMany({}); logger.info('  Medical Notes deleted.');
            await MedicalDocument.deleteMany({}); logger.info('  Medical Documents deleted.');
            await PatientProfile.deleteMany({}); logger.info('  Patient Profiles deleted.');
            await DoctorProfile.deleteMany({}); logger.info('  Doctor Profiles deleted.');
            await StaffProfile.deleteMany({}); logger.info('  Staff Profiles deleted.');
            await User.deleteMany({}); logger.info('  Users deleted.');
            logger.info('Existing data deletion complete.');
        } catch (err) {
            logger.error('Error deleting data:', err);
            throw err;
        }

        // --- Create Users and Profiles Sequentially ---
        logger.info('\nCreating users and profiles...');
        const createdUsersMap = {
            [UserRoles.ADMIN]: [],
            [UserRoles.STAFF]: [],
            [UserRoles.DOCTOR]: [],
            [UserRoles.PATIENT]: [],
        };
        const createdProfilesMap = {
            [UserRoles.DOCTOR]: [],
            [UserRoles.STAFF]: [],
            [UserRoles.PATIENT]: [],
        };

        let adminUser = null;

        // 1. Create Admin User first
        try {
            const adminData = createBaseUser(UserRoles.ADMIN, DEFAULT_PASSWORD);
            const adminUserModel = new User(adminData);
            adminUser = await adminUserModel.save();
            createdUsersMap[UserRoles.ADMIN].push(adminUser);
            logger.info(`    Created Admin user: ${adminUser.email}`);
        } catch (error) {
            logger.error('Error creating Admin user:', error);
            throw error;
        }

        // Helper function for creating user + profile + linking
        const createUserAndProfile = async (role, profileModel, profileDataFunc, profileMapKey) => {
            const userData = createBaseUser(role, DEFAULT_PASSWORD);
            const user = new User(userData);
            // Ensure profileDataFunc receives necessary arguments (userId, potentially creatorId)
            const profileData = profileDataFunc(user._id, adminUser?._id); // Pass user._id and adminId (if needed)
            const profile = await profileModel.create(profileData);

            if (role === UserRoles.STAFF) user.staffProfile = profile._id;
            else if (role === UserRoles.DOCTOR) user.doctorProfile = profile._id;
            else if (role === UserRoles.PATIENT) user.patientProfile = profile._id;

            const savedUser = await user.save(); // Save user AFTER profile link is set

            createdUsersMap[role].push(savedUser);
            createdProfilesMap[profileMapKey].push(profile);
            logger.info(`    Created ${role} user: ${savedUser.email} and profile ${profile._id}`);
            return { user: savedUser, profile };
        };

        // 2. Create Staff Users and Profiles
        for (let i = 0; i < NUM_STAFF; i++) {
            try {
                // Pass adminUser._id as the creator ID for StaffProfile
                await createUserAndProfile(UserRoles.STAFF, StaffProfile, (userId, adminId) => createStaffProfileData(userId, adminId), UserRoles.STAFF);
            } catch (error) {
                logger.error(`Error creating Staff user/profile ${i+1}:`, error);
            }
        }

        // 3. Create Doctor Users and Profiles (Ensuring Specialty Coverage)
        const specialtiesToCover = commonIndonesianSpecialties.filter(s => s !== 'Lainnya');
        for (let i = 0; i < NUM_DOCTORS; i++) {
            try {
                // Assign specialties sequentially first, then randomly if needed
                const specialty = specialtiesToCover[i] || faker.helpers.arrayElement(specialtiesToCover);
                const doctorData = createBaseUser(UserRoles.DOCTOR, DEFAULT_PASSWORD);
                const doctorUser = new User(doctorData);
                // Pass assigned specialty to profile data function along with admin ID
                const doctorProfileData = createDoctorProfileData(doctorUser._id, adminUser._id, specialty);
                const doctorProfile = await DoctorProfile.create(doctorProfileData);
                doctorUser.doctorProfile = doctorProfile._id;
                await doctorUser.save(); // Save user AFTER profile link

                createdUsersMap[UserRoles.DOCTOR].push(doctorUser);
                createdProfilesMap[UserRoles.DOCTOR].push(doctorProfile);
                logger.info(`    Created Doctor user: ${doctorUser.email} (Specialty: ${specialty}) and profile ${doctorProfile._id}`);
            } catch (error) {
                logger.error(`Error creating Doctor user/profile ${i+1}:`, error);
            }
        }

        // 4. Create Patient Users and Profiles
        const availableStaff = createdUsersMap[UserRoles.STAFF];
        if (availableStaff.length === 0) {
            logger.error("Cannot create patients as no staff users were created successfully.");
        } else {
            for (let i = 0; i < NUM_PATIENTS; i++) {
                 try {
                     const randomStaffCreator = faker.helpers.arrayElement(availableStaff);
                     // Pass staff creator ID to profile data function
                     await createUserAndProfile(UserRoles.PATIENT, PatientProfile, (userId) => createPatientProfileData(userId, randomStaffCreator._id), UserRoles.PATIENT);
                 } catch (error) {
                      logger.error(`Error creating Patient user/profile ${i+1}:`, error);
                 }
            }
        }
        logger.info(`  Successfully created and linked profiles.`);


        // Get references to created profiles for subsequent seeding
        const createdDoctorProfiles = createdProfilesMap[UserRoles.DOCTOR];
        const createdPatientProfiles = createdProfilesMap[UserRoles.PATIENT];
        const createdStaffUsers = createdUsersMap[UserRoles.STAFF];
        const createdDoctorUsers = createdUsersMap[UserRoles.DOCTOR];
        const createdPatientUsers = createdUsersMap[UserRoles.PATIENT];


        // --- Create Appointments ---
        if (NUM_APPOINTMENTS > 0 && createdPatientProfiles.length > 0 && createdDoctorProfiles.length > 0) {
            logger.info('\nCreating appointments...');
            const appointmentsData = [];
             for (let i = 0; i < NUM_APPOINTMENTS; i++) {
                 const randomPatientProfile = faker.helpers.arrayElement(createdPatientProfiles);
                 const randomDoctorProfile = faker.helpers.arrayElement(createdDoctorProfiles);
                 const patientUser = createdPatientUsers.find(u => u.patientProfile?.equals(randomPatientProfile._id));
                 // Decide if patient or staff creates the appointment
                 const creatorUser = faker.datatype.boolean(0.7) && patientUser // Ensure patientUser exists if chosen
                     ? patientUser
                     : faker.helpers.arrayElement(createdStaffUsers.length > 0 ? createdStaffUsers : [adminUser]); // Fallback to admin if no staff

                 if (creatorUser && randomPatientProfile && randomDoctorProfile) {
                     appointmentsData.push(createAppointmentData(randomPatientProfile._id, randomDoctorProfile._id, creatorUser._id));
                 } else {
                      logger.warn(`Could not find valid creator/patient/doctor for appointment iteration ${i}`);
                 }
             }
            if (appointmentsData.length > 0) {
                try {
                     const createdAppointments = await Appointment.insertMany(appointmentsData);
                     logger.info(`  Successfully created ${createdAppointments.length} appointments.`);
                     // --- Create Medical Notes (linked to some appointments) ---
                     if (NUM_NOTES > 0 && createdAppointments.length > 0) {
                         logger.info('\nCreating medical notes...');
                         const notesData = [];
                         const potentialAuthors = [...createdDoctorUsers, ...createdStaffUsers];
                         if (potentialAuthors.length > 0) {
                              for (let i = 0; i < NUM_NOTES; i++) {
                                  // Ensure we link notes to valid appointments and patients
                                  const randomAppointment = faker.helpers.arrayElement(createdAppointments);
                                  const author = faker.helpers.arrayElement(potentialAuthors);
                                  // Decide if note is linked to a specific appointment (70% chance)
                                  const linkAppointment = faker.datatype.boolean(0.7) ? randomAppointment._id : null;
                                  // Get patient ID from the (potentially linked) appointment
                                  const patientProfileIdForNote = randomAppointment.patient;

                                  if (patientProfileIdForNote && author) { // Ensure patient and author are valid
                                      notesData.push(createMedicalNoteData(patientProfileIdForNote, author._id, linkAppointment));
                                  } else {
                                       logger.warn(`Could not find valid patient/author for note iteration ${i}`);
                                  }
                              }
                              if (notesData.length > 0) {
                                  try {
                                      const createdNotes = await MedicalNote.insertMany(notesData);
                                      logger.info(`  Successfully created ${createdNotes.length} medical notes.`);
                                  } catch (noteErr) { logger.error('  Error creating medical notes:', noteErr.message); }
                              } else { logger.warn('No valid data generated for medical notes.'); }
                         } else { logger.warn('Skipping medical note creation as no potential authors found.'); }
                     } else { logger.info('\nSkipping medical note creation (Count is 0 or no appointments).'); } // Updated skip reason
                } catch (apptErr) { logger.error('  Error creating appointments:', apptErr.message); }
            } else { logger.warn('No valid data generated for appointments.'); }
        } else { logger.info('\nSkipping appointment creation (Count is 0 or no patients/doctors profiles).'); }


        // --- Create Medical Documents ---
        if (NUM_DOCUMENTS > 0 && createdPatientProfiles.length > 0) {
            logger.info('\nCreating medical documents...');
            const documentsData = [];
            const potentialUploaders = [ // Users who can upload documents
                ...createdPatientUsers,
                ...createdStaffUsers,
                ...createdDoctorUsers
            ];
            if (potentialUploaders.length > 0) {
                for (let i = 0; i < NUM_DOCUMENTS; i++) {
                    const randomPatientProfile = faker.helpers.arrayElement(createdPatientProfiles);
                    const uploader = faker.helpers.arrayElement(potentialUploaders);
                    if (randomPatientProfile && uploader) {
                        documentsData.push(createMedicalDocumentData(randomPatientProfile._id, uploader._id));
                    } else {
                        logger.warn(`Could not find valid patient/uploader for document iteration ${i}`);
                    }
                }
                if (documentsData.length > 0) {
                    try {
                        const createdDocuments = await MedicalDocument.insertMany(documentsData);
                        logger.info(`  Successfully created ${createdDocuments.length} medical documents.`);
                    } catch (docErr) { logger.error('  Error creating medical documents:', docErr.message); }
                } else { logger.warn('No valid data generated for medical documents.'); }
            } else { logger.warn('Skipping medical document creation as no potential uploaders found.'); }
        } else { logger.info('\nSkipping medical document creation (Count is 0 or no patient profiles).'); } // Updated skip reason


        logger.info('\n--- Database seeding completed successfully! ---');

    } catch (error) {
        logger.error('\n--- FATAL ERROR during database seeding: ---');
        logger.error(error);
        process.exitCode = 1;
    } finally {
        await disconnectDB();
    }
};

// --- Run the Seeder ---
seedDatabase();