/**
 * Wraps an asynchronous route handler function to catch errors and pass them to the next middleware.
 * @param {Function} requestHandler - The asynchronous function to wrap (e.g., a controller method).
 * @returns {Function} A new function that handles promise rejection.
 */
const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
    };
};

export { asyncHandler };
