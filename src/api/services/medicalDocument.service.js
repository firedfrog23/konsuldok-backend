import fs from 'fs'; // File system module for handling temporary files if needed
import { cloudinary } from '../../config/cloudinary.js'; // Adjust path
import config from '../../config/index.js'; // Adjust path
import MedicalDocument from '../../models/medicalDocument.model.js'; // Adjust path
import PatientProfile from '../../models/patientProfile.model.js'; // Adjust path
import { ApiError } from '../../utils/ApiError.js'; // Adjust path
import { UserRoles } from '../../utils/constants.js'; // Adjust path
import logger from '../../utils/logger.js'; // Adjust path

/**
 * Uploads a file to Cloudinary and creates a corresponding metadata document.
 * Assumes file is available at localPath after being processed by middleware like multer.
 * @param {string} localPath - The temporary path of the uploaded file on the server.
 * @param {object} fileMetadata - Information about the file (originalname, mimetype, size).
 * @param {string} patientId - The ID of the PatientProfile the document belongs to.
 * @param {object} uploadedByUser - The user performing the upload.
 * @param {object} [extraData={}] - Optional extra metadata like description, tags, documentDate.
 * @returns {Promise<object>} The created medical document metadata object.
 */
export const uploadMedicalDocument = async (localPath, fileMetadata, patientId, uploadedByUser, extraData = {}) => {
    logger.debug(`MedicalDocumentService: Uploading document for patient ${patientId} by user ${uploadedByUser._id}`);

    if (!localPath) {
        throw new ApiError(400, 'No file path provided for upload.');
    }

    // Validate patientId exists
    const patientExists = await PatientProfile.countDocuments({ _id: patientId, isDeleted: { $ne: true } });
    if (!patientExists) {
        // Clean up temp file before throwing error
        try { fs.unlinkSync(localPath); } catch (e) { logger.error(`Failed to cleanup temp file ${localPath} after patient validation failure.`); }
        throw new ApiError(404, `Patient profile not found with ID: ${patientId}`);
    }

    // TODO: Add permission check: Is uploadedByUser allowed to upload for this patient?
    // (e.g., Patient themselves, assigned Doctor/Staff, Admin)

    try {
        // 1. Upload file to Cloudinary
        logger.info(`Uploading file ${localPath} to Cloudinary...`);
        const uploadResult = await cloudinary.uploader.upload(localPath, {
            folder: config.cloudinary.uploadFolder,
            resource_type: "auto", // Detect resource type
            // Optional: Apply tags for organization in Cloudinary
            // tags: [patientId, ...(extraData.tags || [])],
        });
        logger.info(`Cloudinary upload successful: ${uploadResult.public_id}`);

        // 2. Create MedicalDocument metadata in DB
        const newDocument = new MedicalDocument({
            patient: patientId,
            uploadedBy: uploadedByUser._id,
            fileName: fileMetadata.originalname,
            fileType: uploadResult.resource_type === 'raw' ? fileMetadata.mimetype : uploadResult.resource_type,
            fileSize: uploadResult.bytes,
            cloudinaryUrl: uploadResult.secure_url,
            cloudinaryPublicId: uploadResult.public_id,
            description: extraData.description,
            documentDate: extraData.documentDate,
            tags: extraData.tags,
            createdBy: uploadedByUser._id,
        });

        await newDocument.save();

        // 3. Remove the locally saved temporary file (important!)
        try {
            fs.unlinkSync(localPath);
            logger.debug(`Successfully removed temp file: ${localPath}`);
        } catch (unlinkError) {
            logger.error(`Failed to remove temp file ${localPath}: ${unlinkError.message}`);
        }

        logger.info(`Document metadata ${newDocument._id} saved successfully by user ${uploadedByUser._id}`);
        // Populate before returning
        return getMedicalDocumentById(newDocument._id);

    } catch (error) {
        // Cleanup temp file if upload or DB save fails
        try {
            if (fs.existsSync(localPath)) {
                fs.unlinkSync(localPath);
            }
        } catch (cleanupError) {
            logger.error(`Error during cleanup after upload failure: ${cleanupError.message}`);
        }

        logger.error(`Failed to upload document: ${error.message}`, { error });
        throw new ApiError(500, `Upload failed: ${error.message}`);
    }
};

/**
 * Get medical documents for a specific patient.
 * @param {string} patientId - The ID of the PatientProfile.
 * @param {object} queryOptions - Filtering (tags, date), sorting, pagination (limit, page).
 * @returns {Promise<object>} List of document metadata and pagination info.
 */
export const getMedicalDocumentsByPatient = async (patientId, queryOptions = {}) => {
    logger.debug(`MedicalDocumentService: Fetching documents for patient ${patientId} with options:`, queryOptions);
    const { tags, startDate, endDate, sortBy = 'createdAt', order = 'desc', limit = 10, page = 1 } = queryOptions;

    const filter = { patient: patientId, isDeleted: { $ne: true } };
    if (tags) {
        // Assuming tags is a comma-separated string in query params
        filter.tags = { $in: tags.split(',').map(tag => tag.trim()).filter(Boolean) };
    }
    if (startDate || endDate) {
        filter.documentDate = {}; // Filter by the date the document refers to
        if (startDate) filter.documentDate.$gte = new Date(startDate);
        if (endDate) filter.documentDate.$lte = new Date(endDate);
    }

    const sort = {};
    sort[sortBy] = order === 'asc' ? 1 : -1;

    const limitValue = parseInt(limit, 10);
    const pageValue = parseInt(page, 10);
    const skip = (pageValue - 1) * limitValue;

    try {
        const documents = await MedicalDocument.find(filter)
            .populate('uploadedBy', 'firstName lastName role') // Populate uploader details
            .sort(sort)
            .skip(skip)
            .limit(limitValue)
            .select('-__v -cloudinaryPublicId'); // Exclude public ID from normal listing

        const totalCount = await MedicalDocument.countDocuments(filter);

        return {
            documents,
            totalPages: Math.ceil(totalCount / limitValue),
            currentPage: pageValue,
            totalCount,
        };
    } catch (error) {
        logger.error(`MedicalDocumentService: Error fetching documents for patient ${patientId}:`, error);
        throw new ApiError(500, 'Failed to retrieve medical documents.');
    }
};

/**
 * Get a single medical document metadata by ID.
 * @param {string} documentId - The ID of the document metadata.
 * @returns {Promise<object>} The document metadata object populated with patient/uploader.
 */
export const getMedicalDocumentById = async (documentId) => {
    logger.debug('MedicalDocumentService: Fetching document by ID:', documentId);
    const document = await MedicalDocument.findOne({ _id: documentId, isDeleted: { $ne: true } })
        .populate({ path: 'patient', select: 'userAccount', populate: { path: 'userAccount', select: 'firstName lastName' } })
        .populate('uploadedBy', 'firstName lastName role')
        .select('-__v -cloudinaryPublicId'); // Exclude public ID by default

    if (!document) {
        throw new ApiError(404, 'Medical document not found.');
    }
    return document;
};

/**
 * Update medical document metadata (e.g., description, tags).
 * @param {string} documentId - The ID of the document metadata to update.
 * @param {object} updateData - Data to update (only allowed fields like description, tags, documentDate).
 * @param {object} updatedByUser - The user performing the update.
 * @returns {Promise<object>} The updated document metadata object.
 */
export const updateMedicalDocument = async (documentId, updateData, updatedByUser) => {
    logger.debug(`MedicalDocumentService: Updating document ${documentId} by user ${updatedByUser._id}`);
    const { description, tags, documentDate } = updateData; // Extract allowed fields

    const docToUpdate = await MedicalDocument.findOne({ _id: documentId, isDeleted: { $ne: true } });
    if (!docToUpdate) throw new ApiError(404, 'Medical document not found.');

    // Permission Check: e.g., Only Admin, Staff, or original Uploader?
    const isAdminOrStaff = [UserRoles.ADMIN, UserRoles.STAFF, UserRoles.DOCTOR].includes(updatedByUser.role); // Doctors too?
    const isUploader = docToUpdate.uploadedBy.equals(updatedByUser._id);

    if (!isAdminOrStaff && !isUploader) {
        throw new ApiError(403, 'Forbidden: You are not authorized to update this document metadata.');
    }

    // Update fields if provided
    if (description !== undefined) docToUpdate.description = description;
    if (tags !== undefined) docToUpdate.tags = tags; // Assumes tags replace existing
    if (documentDate !== undefined) docToUpdate.documentDate = documentDate;

    // Set audit field
    docToUpdate.updatedBy = updatedByUser._id;

    await docToUpdate.save();
    logger.info(`Document metadata ${documentId} updated successfully by ${updatedByUser._id}`);

    return getMedicalDocumentById(documentId); // Re-fetch with populated data
};

/**
 * Delete a medical document (metadata and file from Cloudinary).
 * @param {string} documentId - The ID of the document metadata.
 * @param {object} deletedByUser - The user performing the deletion.
 * @returns {Promise<void>}
 */
export const deleteMedicalDocument = async (documentId, deletedByUser) => {
    logger.warn(`MedicalDocumentService: Attempting delete for document ${documentId} by user ${deletedByUser._id}`);
    // Fetch the document including the publicId needed for Cloudinary deletion
    const docToDelete = await MedicalDocument.findOne({ _id: documentId, isDeleted: { $ne: true } }).select('+cloudinaryPublicId');
    if (!docToDelete) throw new ApiError(404, 'Medical document not found.');

    // Permission Check: e.g., Only Admin, Staff, or original Uploader?
    const isAdminOrStaff = [UserRoles.ADMIN, UserRoles.STAFF, UserRoles.DOCTOR].includes(deletedByUser.role);
    const isUploader = docToDelete.uploadedBy.equals(deletedByUser._id);

    if (!isAdminOrStaff && !isUploader) {
        throw new ApiError(403, 'Forbidden: You are not authorized to delete this document.');
    }

    // 1. Attempt to delete from Cloudinary
    try {
        logger.info(`Attempting to delete document ${docToDelete.cloudinaryPublicId} from Cloudinary...`);
        const result = await cloudinary.uploader.destroy(docToDelete.cloudinaryPublicId, {
             resource_type: docToDelete.fileType === 'image' || docToDelete.fileType === 'video' ? docToDelete.fileType : 'raw' // Specify resource type for deletion
        });
        logger.info(`Cloudinary deletion result for ${docToDelete.cloudinaryPublicId}:`, result);
        if (result.result !== 'ok' && result.result !== 'not found') {
             // Log error but maybe don't block DB deletion if Cloudinary fails? Depends on policy.
			logger.error(`Cloudinary deletion failed for ${docToDelete.cloudinaryPublicId}: ${result.result}`);
        }
    } catch (cloudinaryError) {
        logger.error(`Error deleting document ${docToDelete.cloudinaryPublicId} from Cloudinary: ${cloudinaryError.message}`);
        // Decide if this error should prevent DB deletion. For now, we'll proceed.
    }

    // 2. Soft delete the metadata document from MongoDB
    await docToDelete.softDelete(deletedByUser._id);
    logger.info(`Document metadata ${documentId} soft deleted successfully by ${deletedByUser._id}`);
};
