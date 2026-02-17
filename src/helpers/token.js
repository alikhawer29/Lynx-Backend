var jwt = require("jsonwebtoken")

// In-memory blacklist for logged-out tokens (valid until token expiry)
// For multi-server setup, use Redis or DB instead
const tokenBlacklist = new Map(); // token -> exp (seconds)

const generateToken = async (payload) => {
    try {
        let token = await jwt.sign(payload, process.env.JWT_SECRET_KEY)
        return token
    } catch (error) {
        throw new Error()
    }
};

const verifyToken = async (token) => {
    try {
        if (isBlacklisted(token)) {
            throw new Error("Token has been revoked (logged out)")
        }
        let result = await jwt.verify(token, process.env.JWT_SECRET_KEY)
        return result
    } catch (error) {
        throw new Error(error.message === "Token has been revoked (logged out)" ? error.message : "Invalid Auth Token")
    }
};

const addToBlacklist = (token) => {
    try {
        const decoded = jwt.decode(token)
        if (decoded && decoded.exp) {
            tokenBlacklist.set(token, decoded.exp)
        } else {
            tokenBlacklist.set(token, Math.floor(Date.now() / 1000) + 86400) // default 24h
        }
    } catch (e) {
        tokenBlacklist.set(token, Math.floor(Date.now() / 1000) + 86400)
    }
};

const isBlacklisted = (token) => {
    const exp = tokenBlacklist.get(token)
    if (!exp) return false
    if (exp < Math.floor(Date.now() / 1000)) {
        tokenBlacklist.delete(token)
        return false
    }
    return true
};

module.exports = {
    generateToken,
    verifyToken,
    addToBlacklist,
};
