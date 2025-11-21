module.exports = {
    success(message = "Success", data = null) {
        return {
            status: true,
            message,
            data,
        };
    },

    error(message = "Error", code = 400, details = null) {
        return {
            status: false,
            message,
            code,
            details,
        };
    }
};
