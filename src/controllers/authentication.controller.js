const User = require('../models/user.model')
const Otp = require('../models/otp.model')
const Conversation = require('../models/conversation.model')
const { comparePassword } = require('../helpers/encryption')
const { generateToken, addToBlacklist } = require('../helpers/token')
const { generateOTP, ERRORS, ROLES, objectValidator, normalizeOptionalContactFields, AUTH_TYPES, normalize } = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendMail } = require("../helpers/email")
const admin = require('../configs/firebase')
const authPlaceholders = require('../configs/authPlaceholders.config')

const fs = require("fs");
const path = require("path");

function splitName(displayName) {
    const t = (displayName || '').trim()
    if (!t) return { first_name: 'User', last_name: '-' }
    const parts = t.split(/\s+/)
    if (parts.length === 1) return { first_name: parts[0], last_name: '-' }
    return { first_name: parts[0], last_name: parts.slice(1).join(' ') }
}

/**
 * Sign-in with Google / Apple / Facebook via Firebase Auth (client gets ID token; we verify with Admin).
 * Body: { id_token, source?, device_id?, device_type?, timezone?, first_name?, last_name? }
 * id_token = Firebase user.getIdToken() result.
 */
const firebaseLogin = (async (req, res) => {
    try {
        const { id_token, source, device_id, device_type, timezone, first_name, last_name } = req.body

        if (!id_token) {
            throw new Error(ERRORS.REQUIRED_FIELD)
        }

        const requestedRole =
            source === ROLES.PROVIDER
                ? ROLES.PROVIDER
                : source === ROLES.ADMIN
                  ? ROLES.ADMIN
                  : ROLES.USER

        if (requestedRole === ROLES.ADMIN) {
            return res.status(403).send({
                success: false,
                code: 'ADMIN_FIREBASE_NOT_ALLOWED',
                message: 'Admin sign-in is not available via this endpoint',
            })
        }

        let decoded
        try {
            decoded = await admin.auth().verifyIdToken(id_token)
        } catch (e) {
            console.error('firebase verifyIdToken:', e.message)
            return res.status(401).send({
                success: false,
                code: 'FIREBASE_TOKEN_INVALID',
                message: 'Invalid or expired Firebase ID token',
            })
        }

        const uid = decoded.uid
        const email = (decoded.email || '').toLowerCase() || null
        if (!email) {
            return res.status(400).send({
                success: false,
                code: 'FIREBASE_EMAIL_REQUIRED',
                message:
                    'No email on Firebase account. Enable email in Firebase Auth (provider) or use an account that shares email.',
            })
        }

        const displayName = decoded.name || email.split('@')[0]
        let nameParts =
            first_name && last_name
                ? { first_name: String(first_name).trim(), last_name: String(last_name).trim() }
                : splitName(displayName)

        const pic = decoded.picture ? String(decoded.picture) : 'uploads/user/dummy.jpg'

        const phoneSuffix = String(uid).replace(/\W/g, '').slice(0, 12) || 'fb'

        const projection = { __v: 0, password: 0, createdAt: 0, updatedAt: 0 }

        let userExist = await User.findOne(
            { auth_provider: AUTH_TYPES.FIREBASE, provider_id: uid },
            projection
        )

        if (!userExist) {
            userExist = await User.findOne({ email }, projection)
            if (userExist) {
                if (userExist.auth_provider === AUTH_TYPES.EMAIL && userExist.password) {
                    return res.status(409).send({
                        success: false,
                        code: 'ACCOUNT_EXISTS_WITH_EMAIL',
                        message:
                            'An account with this email already exists. Sign in with email and password.',
                    })
                }
                if (
                    [AUTH_TYPES.GOOGLE, AUTH_TYPES.APPLE, AUTH_TYPES.FACEBOOK].includes(
                        userExist.auth_provider
                    )
                ) {
                    return res.status(409).send({
                        success: false,
                        code: 'ACCOUNT_LEGACY_SOCIAL',
                        message:
                            'This email used the old sign-in. Contact support to migrate, or use a different email.',
                    })
                }
                if (userExist.auth_provider && userExist.auth_provider !== AUTH_TYPES.FIREBASE) {
                    return res.status(409).send({
                        success: false,
                        code: 'ACCOUNT_EXISTS_OTHER_PROVIDER',
                        message: 'This email is already linked to a different sign-in method.',
                    })
                }
                if (userExist.auth_provider === AUTH_TYPES.FIREBASE) {
                    userExist.provider_id = uid
                }
            }
        }

        if (!userExist) {
            if (requestedRole === ROLES.PROVIDER) {
                return res.status(400).send({
                    success: false,
                    code: 'PROVIDER_USE_SIGNUP',
                    message:
                        'Service provider accounts must be created through the full signup form with certifications.',
                })
            }

            const userData = {
                first_name: nameParts.first_name,
                last_name: nameParts.last_name,
                email,
                language: authPlaceholders.defaultLanguage,
                country_code: authPlaceholders.countryCode,
                dialing_code: authPlaceholders.dialingCode,
                phone: `fb${phoneSuffix}`.slice(0, 32),
                picture: pic,
                auth_provider: AUTH_TYPES.FIREBASE,
                provider_id: uid,
                role: ROLES.USER,
                active: true,
            }

            if (timezone) {
                const moment = require('moment-timezone')
                try {
                    if (moment.tz.zone(timezone)) {
                        userData.timezone = timezone
                    }
                } catch (error) {
                    console.warn(`Invalid timezone provided: ${timezone}`)
                }
            }

            userExist = await User.create(userData)
        } else {
            if (pic && pic.startsWith('http') && (!userExist.picture || userExist.picture.includes('dummy'))) {
                userExist.picture = pic
            }
            if (timezone) {
                const moment = require('moment-timezone')
                try {
                    if (moment.tz.zone(timezone)) {
                        userExist.timezone = timezone
                    }
                } catch (error) {
                    console.warn(`Invalid timezone provided: ${timezone}`)
                }
            }
        }

        if (requestedRole !== userExist.role) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }

        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified && userExist.reject_reason) {
            throw new Error('Your profile is rejected by admin')
        }

        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified) {
            throw new Error('Your profile is pending admin approval')
        }

        if (!userExist.active) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
        }

        const sessionToken = await generateToken({
            id: userExist._id,
            email: userExist.email,
            role: userExist.role,
        })

        if (device_id) {
            if (!userExist.device_ids) {
                userExist.device_ids = []
            }
            if (!userExist.device_ids.includes(device_id)) {
                userExist.device_ids.push(device_id)
            }
        }

        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            userExist.device_type = device_type
        }

        await userExist.save()

        let currentUser = { ...userExist._doc }
        delete currentUser.password

        if (userExist.role === ROLES.PROVIDER) {
            currentUser.image_url = userExist.image_url
            currentUser.resume_url = userExist.resume_url
            currentUser.certifications_with_urls = userExist.certifications_with_urls
        } else {
            currentUser.image_url = userExist.image_url
        }

        const active_subscription = await getCurrentSubscription(currentUser._id)
        currentUser.active_subscription = active_subscription

        const conversation = await Conversation.findOne({ participants: { $in: [currentUser._id] } })
            .select('_id')
            .lean()
        currentUser.conversation = conversation?._id || null

        return res.status(200).send({
            success: true,
            message: 'User successfully logged in',
            token: sessionToken,
            data: currentUser,
        })
    } catch (e) {
        console.log('Error Message :: ', e)
        return res.status(400).send({
            success: false,
            message: e.message,
        })
    }
})

const login = (async (req, res) => {
    try {

        let { email, password, source, device_id, device_type, timezone } = req.body

        if (!email || !password) {
            throw new Error(ERRORS.REQUIRED_FIELD)
        }

        let projection = { __v: 0, createdAt: 0, updatedAt: 0 }

        let userExist = await User.findOne({ email: email.toLowerCase() }, projection)

        if (!userExist) {
            throw new Error(ERRORS.INVALID_CREDENTIALS)
        }


        let validPassword = await comparePassword(password, userExist.password)

        if (!validPassword) {
            throw new Error(ERRORS.INVALID_CREDENTIALS)
        }

        let requestedUser = source ? source : ROLES.USER

        if ((requestedUser !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }

        let activeUser = userExist.active

        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified && userExist.reject_reason) {
            throw new Error("Your profile is rejected by admin");
        }

        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified) {
            throw new Error("Your profile is pending admin approval");
        }

        if (!activeUser) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
        }

        // Update timezone if provided (for current location)
        if (timezone) {
            const moment = require('moment-timezone');
            try {
                // Validate timezone
                if (moment.tz.zone(timezone)) {
                    userExist.timezone = timezone;
                } else {
                    console.warn(`Invalid timezone provided: ${timezone}`);
                }
            } catch (error) {
                console.warn(`Error validating timezone: ${error.message}`);
            }
        }

        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

        // Handle device_id and device_type
        if (device_id) {
            // Initialize device_ids array if it doesn't exist
            if (!userExist.device_ids) {
                userExist.device_ids = []
            }

            // Add device_id to array if it doesn't already exist
            if (!userExist.device_ids.includes(device_id)) {
                userExist.device_ids.push(device_id)
            }
        }

        // Update device_type if provided
        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            userExist.device_type = device_type
        }

        await userExist.save()

        let currentUser = { ...userExist._doc }

        delete currentUser.password

        // Add virtual fields for providers
        if (userExist.role === ROLES.PROVIDER) {
            currentUser.image_url = userExist.image_url
            currentUser.resume_url = userExist.resume_url
            currentUser.certifications_with_urls = userExist.certifications_with_urls
        } else {
            currentUser.image_url = userExist.image_url
        }

        let active_subscription = await getCurrentSubscription(currentUser._id)
        currentUser.active_subscription = active_subscription

        // if (currentUser.role !== ROLES.ADMIN) {
        //     let conversation = await Conversation.findOne({ participants: { $in: [currentUser._id] } }).select("_id")
        //     currentUser.conversation = conversation._id
        // }

        return res.status(200).send({
            success: true,
            message: "User successfully logged in",
            token,
            data: currentUser
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const signup = async (req, res) => {
    try {
        const { body, files } = req;
        const { email, role, device_id, device_type } = body;

        // Phone / country_code / dialing_code are optional — strip empties before strict field check
        const { forValidation, forSave } = normalizeOptionalContactFields(body, {
            treatMissingAsNull: true,
        });

        if (!objectValidator(forValidation)) {
            throw new Error(ERRORS.NULL_FIELD);
        }

        const userExist = await User.findOne({ email }, { _id: 1 });
        if (userExist) {
            throw new Error(ERRORS.USER_EXIST);
        }

        const payload = { ...forSave };

        // Default role
        payload.role = role || ROLES.USER;

        // Validate and set timezone if provided
        if (body.timezone) {
            const moment = require('moment-timezone');
            try {
                // Validate timezone
                if (moment.tz.zone(body.timezone)) {
                    payload.timezone = body.timezone;
                } else {
                    console.warn(`Invalid timezone provided during signup: ${body.timezone}`);
                    // Will use default from model
                }
            } catch (error) {
                console.warn(`Error validating timezone during signup: ${error.message}`);
                // Will use default from model
            }
        }

        // ===============================
        // FILE MAP (IMPORTANT FIX)
        // ===============================
        const filesMap = {};
        if (Array.isArray(files)) {
            files.forEach(file => {
                filesMap[file.fieldname] = file;
            });
        }

        // ===============================
        // PROFILE IMAGE
        // ===============================
        if (filesMap.image) {
            payload.picture = filesMap.image.path.replace(/\\/g, '/');
        }

        // ===============================
        // PROVIDER LOGIC
        // ===============================
        if (payload.role === ROLES.PROVIDER) {

            // Resume
            if (filesMap.resume) {
                payload.resume = filesMap.resume.path.replace(/\\/g, '/');
            }

            // ===============================
            // CERTIFICATIONS
            // ===============================
            let certifications = [];

            // Parse certifications from JSON string
            let parsedCertifications = [];
            if (body.certifications) {
                try {
                    parsedCertifications = typeof body.certifications === 'string'
                        ? JSON.parse(body.certifications)
                        : body.certifications;
                } catch (e) {
                    console.error('Error parsing certifications JSON:', e);
                }
            }

            // Find all certification files
            const certFiles = files.filter(file =>
                file.fieldname.startsWith("certifications[") &&
                file.fieldname.includes("certificate_picture")
            );

            // Match files with parsed certification data
            parsedCertifications.forEach((cert, index) => {
                const certFile = certFiles.find(file =>
                    file.fieldname.includes(`[${index}]`)
                );

                if (certFile) {
                    // Rename file
                    const ext = path.extname(certFile.originalname);
                    const newFileName = `certifications_${index}_certificate_picture-${Date.now()}${ext}`;
                    const newPath = path.join("uploads/user", newFileName);

                    fs.renameSync(certFile.path, newPath);

                    certifications.push({
                        institution_name: cert.institution_name,
                        certificate_title: cert.certificate_title,
                        certificate_picture: newPath.replace(/\\/g, "/")
                    });
                }
            });

            if (!certifications.length) {
                throw new Error("Service providers must upload at least one certification");
            }

            payload.certifications = certifications;

            payload.is_verified = false;
            payload.active = false;
        }

        // ===============================
        // HANDLE DEVICE INFORMATION
        // ===============================
        if (device_id) {
            payload.device_ids = [device_id]; // Initialize with first device
        }

        if (device_type && ['ios', 'android', 'web'].includes(device_type)) {
            payload.device_type = device_type;
        }

        // ===============================
        // SAVE USER
        // ===============================
        const user = new User(payload);
        await user.save();

        return res.status(200).json({
            success: true,
            message:
                payload.role === ROLES.PROVIDER
                    ? "Service Provider registered successfully. Awaiting admin approval."
                    : "User registered successfully"
        });

    } catch (error) {
        console.error("Signup Error:", error);
        return res.status(400).json({
            success: false,
            message: error.message
        });
    }
};


const forgetPassword = (async (req, res) => {
    try {

        let { email } = req.body

        if (!email) {
            throw new Error("Email is not provided")
        }

        let userExist = await User.findOne({ email }, { _id: 1, email: 1 })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let otpExist = await Otp.findOne({ userId: userExist._id })

        if (otpExist) {
            await Otp.findByIdAndDelete(otpExist._id)
        }

        let otp = await generateOTP()
        let expiry = new Date()
        expiry.setHours(expiry.getHours() + 1)

        let payload = {
            otp,
            expiry,
            userId: userExist._id,
        }

        sendMail("noreply@lynxconsultancy.com", email, "Password Recovery - Lynx Consultancy", otp)

        let otpData = new Otp(payload)
        await otpData.save()

        return res.status(200).send({
            success: true,
            message: `Code has been sent to email.`,
            data: req.body
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const verifyOtp = (async (req, res) => {
    try {

        let { email, otp } = req.body

        if (!email || !otp) {
            throw new Error("Email or OTP is not provided")
        }

        let userExist = await User.findOne({ email })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        let otpExist = await Otp.findOne({ userId: userExist._id })

        let now = new Date()

        if (now < otpExist.expiry) {

            if (otp == otpExist.otp) {

                return res.status(200).send({
                    success: true,
                    message: "OTP Verified",
                    data: { email }
                })

            } else {
                throw new Error("Invalid OTP")
            }

        } else {
            throw new Error("OTP has been expired")
        }

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const resetPassword = (async (req, res) => {
    try {

        let { email, password } = req.body

        if (!email || !password) {
            throw new Error("Email or Password is not provided")
        }

        let userExist = await User.findOne({ email })

        if (!userExist) {
            throw new Error(ERRORS.USER_NOTEXIST)
        }

        await User.findOneAndUpdate({ _id: userExist._id }, { password })

        return res.status(200).send({
            success: true,
            message: "Password reset successfully"
        })


    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

// ============================
// Logout (User / Provider)
// ============================
const logout = async (req, res) => {
    try {
        const { decoded } = req;
        const { device_id } = req.body || {};

        // Get the token from Authorization header and blacklist it so it can't be used again
        const authHeader = req.get('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            if (token) {
                addToBlacklist(token);
            }
        }

        if (decoded && decoded.id) {
            // Optionally remove device_id from user's device list (e.g. for push notifications)
            if (device_id) {
                await User.findByIdAndUpdate(decoded.id, {
                    $pull: { device_ids: device_id },
                });
            }
        }

        return res.status(200).send({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};

module.exports = {
    login,
    firebaseLogin,
    signup,
    forgetPassword,
    verifyOtp,
    resetPassword,
    logout,
};
