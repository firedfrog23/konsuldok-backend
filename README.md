# KonsulDok - Backend Awesomeness! 🚀

Hey there! So, this is a README of **KonsulDok** – my take on a modern, robust, and frankly, pretty cool API for managing a digital clinic or doctor consultation platform. If you're looking to build the next big thing in health-tech, or just need a solid foundation, you're in the right place!

I've focused on a clean structure, security, and those kind of features.

## KonsulDok (The Gist)

It's a Node.js & Express.js backend designed to handle all the nitty-gritty of a medical consultation platform. Think user roles, appointments, patient records, doctor schedules – the whole shebang.

**Basically, it lets you:**
* Register and manage different types of users (Patients, Doctors, Staff, Admins).
* Book, manage, and track appointments like a pro.
* Handle patient profiles and their medical history (documents & notes).
* Let doctors manage their availability and specialties.
* Securely store and retrieve medical documents (thanks, Cloudinary!).

## ✨ Key Features ✨

* **Rock-Solid Security & User Management:**
    * JWT-based authentication (cookies & Bearer tokens, your choice!).
    * Role-based access control (RBAC) – granular permissions for Patients, Doctors, Staff, and Admins.
    * Password hashing (bcrypt) and secure password reset flow (email-based).
    * Profile picture uploads to Cloudinary.
* **Smart Appointment Scheduling:**
    * Patients can request, and authorized users can create/confirm appointments.
    * Doctors can define their weekly availability (day-specific time slots).
    * Automatic conflict checking for doctor availability.
    * Update, cancel (with reason), and even soft-delete appointments.
* **Comprehensive Patient & Doctor Profiles:**
    * Detailed patient profiles (demographics, emergency contacts, allergies, etc.).
    * Doctor profiles with specialties (a nice list of common Indonesian ones included!), experience, qualifications, consultation fees, and their all-important `weeklySchedule`.
* **Medical Records Handled:**
    * **Medical Notes:** Create, view, update, and delete clinical notes for patients, linked to appointments.
    * **Medical Documents:** Securely upload medical documents (PDFs, images, etc.) for patients directly to **Cloudinary**. Metadata is stored neatly in the DB.
* **Admin Superpowers:**
    * Oversee users, manage profiles, and generally keep the system in check.
* **Built for Devs:**
    * **Clean Code Structure:** Services, controllers, routes, models – all logically separated.
    * **Async Handling:** `asyncHandler` wrapper to keep controllers clean.
    * **Standardized Responses:** `ApiResponse` and `ApiError` for predictable communication.
    * **Robust Validation:** `express-validator` on incoming requests.
    * **Helpful Middleware:** Authentication, authorization, rate limiting, Multer for file uploads, global error handling.
    * **Logging:** Winston for structured logging, Morgan for HTTP requests in dev.
    * **Seeding Script:** Get up and running with dummy data (`seed.js`) in a flash!

## 🛠️ What's Under the Hood? (The Tech Stack)

* **Backend:** Node.js, Express.js
* **Database:** MongoDB with Mongoose (ODM)
* **Authentication:** JSON Web Tokens (JWT)
* **File Storage:** Cloudinary (for profile pics & medical docs)
* **Email:** Nodemailer (for password resets, etc. – Mailtrap configured for dev!)
* **Password Hashing:** bcrypt
* **Validation:** express-validator
* **File Uploads:** Multer
* **Security:** Helmet, CORS
* **Logging:** Winston, Morgan (dev)
* **Rate Limiting:** express-rate-limit
* **Dev Tools:** Faker.js (for seeding), dotenv

## API Endpoint Highlights (A Sneak Peek)

The API is structured around resources, pretty standard stuff:

* `/api/auth/` (register, login, logout, me, forgot-password, reset-password)
* `/api/users/` (admin user management, self-profile updates, profile picture)
* `/api/patients/` (patient profile CRUD, own profile access)
* `/api/doctors/` (listing doctors for booking, getting doctor availability slots)
* `/api/appointments/` (CRUD for appointments, cancellation)
* `/api/notes/` (CRUD for medical notes)
* `/api/documents/` (CRUD for medical document metadata, upload handling via separate controller logic usually with patientId)

...and a `/health` check endpoint, because why not?

## 🚀 Getting It Running (The Quick Version)

1.  Clone.
2.  Set up your `.env` file.
3.  `npm install` (or `yarn`)
4.  `npm run dev` (to start the server, usually with Nodemon)
5.  **Optional but Recommended:** `npm run seed -- --doctors=25 --patients=50` to populate your DB with some fake data. You can tweak the numbers! (Heads up: the seed script **deletes existing data** in the collections it touches).

## 📢 So, What Can You Do With This?

This is a fairly comprehensive backend, and like any good project, it's always evolving. But it's got solid bones and is ready for action!

---

*Happy Coding!* ✨
*Jul*