import mongoose from "mongoose";

/**
 * Mongoose plugin to add common tracking fields and soft delete functionality.
 * - Adds isDeleted, deletedBy, deletedAt fields.
 * - Adds createdBy, updatedBy fields.
 * - Sets timestamps: true if not already set.
 * - Adds a pre-find hook to exclude deleted documents by default.
 * - Adds a softDelete instance method.
 */
export const trackingFieldsPlugin = function(schema) {
    // Add soft delete and audit fields
    schema.add({
        isDeleted: {
            type: Boolean,
            default: false,
            index: true
        },
        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        deletedAt: {
            type: Date
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    });

    // Ensure timestamps are enabled (createdAt, updatedAt)
    if (!schema.options.timestamps) {
        schema.set('timestamps', true);
    }


    schema.pre(/^find/, function(next) {
        // Check if the 'includeDeleted' option is explicitly set to true
        if (this.getOptions().includeDeleted !== true) {
            // If not, add the condition to filter out documents where isDeleted is true
            this.where({ isDeleted: { $ne: true } });
        }
        next();
    });

    /**
     * Soft deletes the document instance.
     * Sets isDeleted to true, records deletion time and user (if provided).
     * @param {mongoose.Schema.Types.ObjectId} [userId] - The ID of the user performing the deletion.
     * @returns {Promise<mongoose.Document>} The saved document instance.
     */
    schema.methods.softDelete = function(userId) {
        // Only proceed if the document is not already deleted
        if (!this.isDeleted) {
            this.isDeleted = true;
            this.deletedAt = new Date();
            if (userId) {
                this.deletedBy = userId;
                if (!this.updatedBy) {
                    this.updatedBy = userId;
                }
            }
            return this.save();
        }
        return Promise.resolve(this);
    };
};
