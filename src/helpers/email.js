const nodemailer = require('nodemailer')
const dotenv = require('dotenv')
const ejs = require('ejs')
const path = require('path')

dotenv.config();

const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,          // ✅ CHANGE
    secure: false,      // ✅ CHANGE (must be false for 587)
    auth: {
        user: process.env.EMAIL_FORMAIL,
        pass: process.env.EMAILPASSWORD_FORMAIL
    },
    tls: {
        rejectUnauthorized: true
    }
});

const sendMail = (async (from = "noreply@lynxconsultancy.com", to, subject, text, template, body) => {

    try {

        let verified = await transport.verify();

        if (verified) {

            let mailOptions = {
                from,
                to,
                subject,
            };

            if (text) {
                mailOptions.text = text
                return transport.sendMail(mailOptions);
            }

            if (template) {

                ejs.renderFile(
                    path.join(__dirname, `../../views/${template}.ejs`),
                    body,
                    (err, data) => {
                        if (err) {
                            console.error('Error rendering EJS template:', err);
                        } else {
                            mailOptions.html = data;
                            return transport.sendMail(mailOptions);
                        }
                    }
                );

            }



        }

    } catch (e) {
        console.log("Error Message :: ", e)
    }

})

module.exports = { sendMail }



