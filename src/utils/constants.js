/**
 * Defines application-wide constants.
 */
export const DB_NAME = "konsuldok";

export const UserRoles = Object.freeze({
    ADMIN: 'Admin',
    DOCTOR: 'Doctor',
    STAFF: 'Staff', // Includes Nurses or other administrative staff
    PATIENT: 'Patient',
});

export const AvailableUserRoles = Object.values(UserRoles);

export const AppointmentStatus = Object.freeze({
    REQUESTED: 'Requested',
    CONFIRMED: 'Confirmed',
    CANCELLED: 'Cancelled',
    COMPLETED: 'Completed',
    NO_SHOW: 'NoShow',
});

export const AvailableAppointmentStatuses = Object.values(AppointmentStatus);

export const Genders = Object.freeze({
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
    PREFER_NOT_TO_SAY: 'Prefer Not To Say',
});

export const AvailableGenders = Object.values(Genders);
