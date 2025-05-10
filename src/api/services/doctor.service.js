// src/api/services/doctor.service.js
import DoctorProfile from '../../models/doctorProfile.model.js';
import User from '../../models/user.model.js'; // Needed for populating user details
import Appointment from '../../models/appointment.model.js'; // --- ADDED: For conflict checking ---
import { ApiError } from '../../utils/ApiError.js';
import logger from '../../utils/logger.js';
import { UserRoles, AppointmentStatus } from '../../utils/constants.js'; // --- ADDED: AppointmentStatus ---

/**
 * Get a list of active doctors suitable for booking appointments.
 * Populates essential user account information like name and profile picture.
 * @param {object} queryOptions - Options for filtering (e.g., specialty) and pagination.
 * @returns {Promise<object>} Object containing list of doctors and pagination info.
 */
export const getDoctorsForBooking = async (queryOptions = {}) => {
    logger.debug('DoctorService: Fetching doctors for booking with options:', queryOptions);
    const {
        specialty,
        search, // Search by doctor's name
        sortBy = 'userAccountInfo.firstName', // Default sort by name
        order = 'asc',
        limit = 100, // Default to a higher limit for dropdowns, can be adjusted
        page = 1
    } = queryOptions;

    const pipeline = [];

    // Stage 1: Match active DoctorProfiles
    pipeline.push({ $match: { isDeleted: { $ne: true } } });


    // Stage 2: Lookup User details from Users collection
    pipeline.push({
        $lookup: {
            from: User.collection.name,
            localField: 'userAccount',
            foreignField: '_id',
            as: 'userAccountInfoArr'
        }
    });

    // Stage 3: Unwind the userAccountInfoArr
    pipeline.push({
        $unwind: {
            path: '$userAccountInfoArr',
            preserveNullAndEmptyArrays: false
        }
    });

    // Stage 4: Rename userAccountInfoArr to userAccountInfo
     pipeline.push({
        $addFields: {
            userAccountInfo: "$userAccountInfoArr"
        }
    });


    // Stage 5: Match active users with the DOCTOR role
    pipeline.push({
        $match: {
            'userAccountInfo.isActive': true,
            'userAccountInfo.isDeleted': { $ne: true },
            'userAccountInfo.role': UserRoles.DOCTOR
        }
    });

    // Stage 6: Apply specialty filter if provided
    if (specialty) {
        pipeline.push({ $match: { specialty: { $regex: specialty, $options: 'i' } } });
    }

    // Stage 7: Apply search filter by name (firstName or lastName)
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        pipeline.push({
            $match: {
                $or: [
                    { 'userAccountInfo.firstName': searchRegex },
                    { 'userAccountInfo.lastName': searchRegex },
                ]
            }
        });
    }

    // Stage 8: Sorting
    const sortStage = {};
    sortStage[sortBy] = order === 'asc' ? 1 : -1;
    pipeline.push({ $sort: sortStage });

    // Stage 9: Pagination - Facet for data and total count
    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    pipeline.push({
        $facet: {
            metadata: [{ $count: "totalCount" }],
            data: [
                { $skip: skip },
                { $limit: limitValue },
                {
                    $project: {
                        _id: 1,
                        specialty: 1,
                        consultationFee: 1,
                        userAccount: {
                            _id: '$userAccountInfo._id',
                            firstName: '$userAccountInfo.firstName',
                            lastName: '$userAccountInfo.lastName',
                            fullName: { $concat: ["$userAccountInfo.firstName", " ", "$userAccountInfo.lastName"] },
                            profilePictureUrl: '$userAccountInfo.profilePictureUrl'
                        }
                    }
                }
            ]
        }
    });

    try {
        const results = await DoctorProfile.aggregate(pipeline);
        const doctors = results[0].data;
        const totalCount = results[0].metadata.length > 0 ? results[0].metadata[0].totalCount : 0;

        // No need for manual fullName mapping if done in $project
        // const processedDoctors = doctors.map(doc => ({
        //     ...doc,
        //     userAccount: {
        //         ...doc.userAccount,
        //         fullName: `${doc.userAccount.firstName} ${doc.userAccount.lastName}`.trim()
        //     }
        // }));

        return {
            doctors, // Use doctors directly from aggregation
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error('DoctorService: Error fetching doctors list for booking:', { error: error.message, stack: error.stack });
        throw new ApiError(500, 'Failed to retrieve doctors list.');
    }
};


/**
 * Fetches availability for a specific doctor for a given date.
 * @param {string} doctorId - The ID of the DoctorProfile.
 * @param {string} dateString - The date to check availability for (e.g., 'YYYY-MM-DD').
 * @param {number} [durationMinutes=30] - The duration of the appointment slot.
 * @returns {Promise<Array<string>>} List of available time slots (e.g., ["09:00", "09:30"]).
 */
export const fetchDoctorAvailabilitySlots = async (doctorId, dateString, durationMinutes = 30) => {
    logger.debug(`DoctorService: Fetching availability for doctor ${doctorId} on ${dateString} for ${durationMinutes} mins`);

    const doctorProfile = await DoctorProfile.findById(doctorId);
    if (!doctorProfile) {
        throw new ApiError(404, 'Doctor profile not found.');
    }

    // Ensure dateString is treated as local date to avoid timezone shifts when getting dayOfWeek
    const [year, month, day] = dateString.split('-').map(Number);
    const requestedDate = new Date(year, month - 1, day); // Month is 0-indexed

    if (isNaN(requestedDate.getTime())) {
        throw new ApiError(400, 'Invalid date format provided. Use YYYY-MM-DD.');
    }
    const dayOfWeek = requestedDate.getDay(); // 0 (Sunday) - 6 (Saturday)

    const workingSlots = doctorProfile.weeklySchedule.filter(slot => slot.dayOfWeek === dayOfWeek);
    if (workingSlots.length === 0) {
        logger.debug(`Doctor ${doctorId} has no schedule for dayOfWeek ${dayOfWeek} on ${dateString}`);
        return [];
    }

    const availableTimeSlots = [];
    const slotIncrement = 15; // Check availability in 15-minute increments

    for (const workBlock of workingSlots) {
        const blockStartTimeParts = workBlock.startTime.split(':').map(Number);
        const blockEndTimeParts = workBlock.endTime.split(':').map(Number);

        let currentSlotTime = new Date(requestedDate); // Use the correctly parsed local date
        currentSlotTime.setHours(blockStartTimeParts[0], blockStartTimeParts[1], 0, 0);

        const blockEndTime = new Date(requestedDate); // Use the correctly parsed local date
        blockEndTime.setHours(blockEndTimeParts[0], blockEndTimeParts[1], 0, 0);

        while (currentSlotTime < blockEndTime) {
            const potentialSlotStart = new Date(currentSlotTime);
            const potentialSlotEnd = new Date(potentialSlotStart.getTime() + durationMinutes * 60000);

            if (potentialSlotEnd > blockEndTime) {
                break;
            }

            // Check for conflicts with existing appointments
            const conflictQuery = {
                doctor: doctorId,
                status: { $in: [AppointmentStatus.CONFIRMED, AppointmentStatus.REQUESTED] },
                isDeleted: { $ne: true },
                // Check for overlap: (StartA < EndB) and (EndA > StartB)
                appointmentTime: { $lt: potentialSlotEnd },
                $expr: { $gt: [{ $add: ["$appointmentTime", { $multiply: ["$durationMinutes", 60000] }] }, potentialSlotStart] }
            };

            const conflictingAppointment = await Appointment.findOne(conflictQuery);

            if (!conflictingAppointment) {
                availableTimeSlots.push(
                    `${String(potentialSlotStart.getHours()).padStart(2, '0')}:${String(potentialSlotStart.getMinutes()).padStart(2, '0')}`
                );
            }
            currentSlotTime = new Date(currentSlotTime.getTime() + slotIncrement * 60000);
        }
    }
    return [...new Set(availableTimeSlots)].sort();
};
