const admin = require("firebase-admin");

const serviceAccount = require("./lynx.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = admin