const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config()

// Enable HTTPS for production (required for iOS)
const isProtected = process.env.PROTECTED === 'true' || process.env.PROTECTED === true

const sslConfig = {}

const getCredentials = () => {
    if (isProtected === true) {
        try {
            // Get the project root directory (Lynx-Backend)
            const projectRoot = path.resolve(__dirname, '../../');

            // SSL certificates are in public_html/ssl (one level up from Lynx-Backend)
            const sslPath = path.resolve(projectRoot, '../ssl');

            const credentials = {
                key: fs.readFileSync(
                    path.join(sslPath, 'customdevnewonli.key'),
                    "utf8"
                ),
                cert: fs.readFileSync(
                    path.join(sslPath, 'customdevnewonli.crt'),
                    "utf8"
                ),
                ca: fs.readFileSync(
                    path.join(sslPath, 'customdevnewonli.ca'),
                    "utf8"
                ),
            };

            console.log('✅ SSL certificates loaded successfully from:', sslPath);
            return credentials;
        } catch (error) {
            console.error('❌ Error loading SSL certificates:', error.message);
            console.error('⚠️  Falling back to HTTP server');
            return null;
        }
    }

    return null
};

module.exports = {
    sslConfig,
    isProtected,
    credentials: getCredentials()
}