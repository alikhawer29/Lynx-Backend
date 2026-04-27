/**
 * Defaults for new users created via Firebase Auth (no password; schema still needs phone/location fields).
 * Override with env if needed.
 */
const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    defaultLanguage: process.env.OAUTH_DEFAULT_LANGUAGE || 'en',
    countryCode: process.env.OAUTH_COUNTRY_CODE || '00',
    dialingCode: process.env.OAUTH_DIALING_CODE || '+0',
};
