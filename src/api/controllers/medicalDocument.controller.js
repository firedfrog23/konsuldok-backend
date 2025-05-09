import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { UserRoles } from '../../utils/constants.js';
import logger from '../../utils/logger.js';
import {
	deleteMedicalDocument as deleteMedicalDocumentService,
	getMedicalDocumentById as getMedicalDocumentByIdService,
	getMedicalDocumentsByPatient,
	updateMedicalDocument as updateMedicalDocumentService,
	uploadMedicalDocument
} from '../services/medicalDocument.service.js';

/**
 * @desc    Upload a medical document and create metadata
 * @route   POST /api/documents/upload/:patientId (Example route)
 * @access  Private (Patient, Staff, Doctor) - Requires file upload middleware
 */
export const uploadDocument = asyncHandler(async (req, res) => {
    const file = req.file;
    const patientId = req.params.patientId || req.body.patientId;
    const extraData = req.body;
    logger.debug(`Controller: Received upload request for patient ${patientId} by user ${req.user?._id}`);
    if (!file) throw new ApiError(400, 'No file uploaded.');
    if (!patientId) throw new ApiError(400, 'Patient ID is required.');
    const fileMetadata = { originalname: file.originalname, mimetype: file.mimetype, size: file.size };
    const documentRecord = await uploadMedicalDocument(file.path, fileMetadata, patientId, req.user, extraData);
    res.status(201).json(new ApiResponse(201, documentRecord, 'Document uploaded successfully.'));
});

/**
 * @desc    Get list of medical documents (metadata) for a patient
 * @route   GET /api/documents?patientId=...
 * @access  Private (Patient-Own, Staff, Doctor, Admin)
 */
export const getMedicalDocuments = asyncHandler(async (req, res) => {
    const patientId = req.query.patientId;
    logger.info(`Controller: getMedicalDocuments called by user ${req.user?._id} for patient ${patientId}`);
    if (!patientId) throw new ApiError(400, 'Patient ID query parameter is required.');
    if (req.user.role === UserRoles.PATIENT && req.user.patientProfile?.toString() !== patientId) {
		throw new ApiError(403, 'Forbidden: You can only view your own documents.');
    }
    const queryOptions = { ...req.query };
    const result = await getMedicalDocumentsByPatient(patientId, queryOptions);
    res.status(200).json(new ApiResponse(200, result, 'Medical documents retrieved successfully.'));
});

/**
 * @desc    Get metadata for a single medical document by its ID
 * @route   GET /api/documents/:documentId
 * @access  Private (Patient-Own, Staff, Doctor, Admin)
 */
// This is the controller function declaration
export const getMedicalDocumentById = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;
    logger.info(`Controller: getMedicalDocumentById called by user ${req.user?._id} for document ${documentId}`);
    const document = await getMedicalDocumentByIdService(documentId); // Use the alias here
    if (req.user.role === UserRoles.PATIENT && document.patient?.userAccount?._id.toString() !== req.user._id.toString()) {
		throw new ApiError(403, 'Forbidden: You cannot view this document.');
    }
    res.status(200).json(new ApiResponse(200, document, 'Medical document retrieved successfully.'));
});

/**
 * @desc    Update metadata for a medical document
 * @route   PATCH /api/documents/:documentId
 * @access  Private (Staff, Doctor, Admin, Uploader?)
 */
export const updateMedicalDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;
    logger.info(`Controller: updateMedicalDocument called by user ${req.user?._id} for document ${documentId}`);
    const updateData = req.body;
    const updatedDocument = await updateMedicalDocumentService(documentId, updateData, req.user);
    res.status(200).json(new ApiResponse(200, updatedDocument, 'Medical document updated successfully.'));
});

/**
 * @desc    Delete a medical document (metadata and file)
 * @route   DELETE /api/documents/:documentId
 * @access  Private (Staff, Doctor, Admin, Uploader?)
 */
export const deleteMedicalDocument = asyncHandler(async (req, res) => {
    const documentId = req.params.documentId;
    logger.warn(`Controller: deleteMedicalDocument called by user ${req.user?._id} for document ${documentId}`);
    await deleteMedicalDocumentService(documentId, req.user);
    res.status(200).json(new ApiResponse(200, null, 'Medical document deleted successfully.'));
});

// Optional: Controller for downloading the actual file
// export const downloadMedicalDocument = asyncHandler(async (req, res) => { ... });

