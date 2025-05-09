/**
 * Class for standardizing successful API responses.
 */
class ApiResponse {
    /**
     * Creates an instance of ApiResponse.
     * @param {number} statusCode - HTTP status code for the success response.
     * @param {*} data - The data payload to be included in the response.
     * @param {string} [message="Success"] - A descriptive message for the response.
     */
    constructor(statusCode, data, message = "Success"){
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = statusCode < 400; // Success is typically indicated by status codes < 400
    }
}

export { ApiResponse };
