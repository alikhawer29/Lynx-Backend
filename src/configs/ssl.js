const fs = require('fs')
const dotenv = require('dotenv')

// dotenv.config()

// const isProtected = process.env.PROTECTED
const isProtected = false

const sslConfig = {}

const getCredentials = () => {
    if (isProtected === true) {
        return {
            key: fs.readFileSync(
                "../../../../../../../etc/apache2/ssl/onlinetestingserver.key",
                "utf8"
            ),
            cert: fs.readFileSync(
                "../../../../../../../etc/apache2/ssl/onlinetestingserver.crt",
                "utf8"
            ),
            ca: fs.readFileSync(
                "../../../../../../../etc/apache2/ssl/onlinetestingserver.ca"
            ),
        };
    }

    return null
};

module.exports = {
    sslConfig,
    isProtected,
    credentials: getCredentials()
}