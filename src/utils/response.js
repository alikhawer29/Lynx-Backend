// response.js
module.exports = {
    success(message = "Success", data = null, statusCode = 200) {
        return {
            status: true,
            message,
            data,
        };
    },

    error(message = "Error", statusCode = 400, details = null) {
        return {
            status: false,
            message,
            statusCode,
            details,
        };
    }
};