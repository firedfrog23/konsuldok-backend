/**
 * Custom error class for API-specific errors.
 * Extends the built-in Error class to include statusCode, data, and operational flag.
 */
class ApiError extends Error {
    /**
     * Creates an instance of ApiError.
     * @param {number} statusCode - HTTP status code for the error.
     * @param {string} message - Error message.
     * @param {Array} [errors=[]] - Optional array of detailed error messages or objects.
     * @param {string} [stack=""] - Optional stack trace. If not provided, captures the current stack.
     */
    constructor(
        statusCode,
        message = "Something went wrong",
        errors = [],
        stack = ""
    ){
        super(message); // Call the parent Error constructor
        this.statusCode = statusCode;
        this.data = null; // Used to attach additional data if needed
        this.message = message;
        this.success = false; // API call failure
        this.errors = errors; // Specific validation errors, etc.
        this.isOperational = true; // Distinguish operational errors from programming errors

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };
