const jwt = require("jsonwebtoken")
const User = require('../models/user.model')
const Otp = require('../models/otp.model')
const Conversation = require('../models/conversation.model')
const { comparePassword } = require('../helpers/encryption')
const { generateToken } = require('../helpers/token')
const { generateOTP, ERRORS, ROLES, objectValidator, AUTH_TYPES, normalize } = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendMail } = require("../helpers/email")

const socialLogin = (async (req, res) => {
    try {

        let { access_token, type, source, device_id } = req.body

        if (!access_token || !type) {
            throw new Error(ERRORS.REQUIRED_FIELD)
        }

        let email = null, name = null, picture = null, sub = null

        if (type === AUTH_TYPES.GOOGLE) {

            const google_response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${access_token}`);
            const google_data = await google_response.json();

            if (google_data.error) {
                return res.status(401).json({ error: "Invalid Google Token" });
            }

            email = google_data?.email
            name = google_data?.name
            picture = google_data?.picture
            sub = google_data?.sub

        } else if (type === AUTH_TYPES.APPLE) {

            const decoded = jwt.decode(access_token, { complete: true });

            if (!decoded || !decoded.payload) {
                return res.status(401).json({ error: "Invalid Apple Token" });
            }

            email = decoded?.payload?.email
            sub = decoded?.payload?.sub
            name = decoded?.payload?.email.split("@")[0]

        }

        let projection = { __v: 0, password: 0, createdAt: 0, updatedAt: 0 }

        let userExist = await User.findOne({ provider_id: sub }, projection).populate([{ path: "manager" }])

        if (!userExist) {
            userExist = await User.create({
                name,
                email,
                picture,
                auth_provider: type,
                provider_id: sub
            });
        }

        let requested_user_role = source ? source : ROLES.MANAGER

        if ((requested_user_role !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }

        if (!userExist.active) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
        }

        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

        if (device_id) {
            userExist.device_ids = device_id
        }

        await userExist.save()

        let currentUser = { ...userExist._doc }

        let active_subscription = await getCurrentSubscription(currentUser._id)
        currentUser.active_subscription = active_subscription

        let conversation = await Conversation.findOne({ participants: { $in: [currentUser._id] } }).select("_id")
        currentUser.conversation = conversation._id

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

const login = (async (req, res) => {
    try {

        let { email, password, source, device_id } = req.body

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


        if (userExist.role === ROLES.PROVIDER && !userExist.is_verified) {
            throw new Error("Your profile is pending admin approval");
        }

        if (!activeUser) {
            throw new Error(ERRORS.BLOCKEDBY_ADMIN)
        }



        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

        if (device_id) {
            userExist.device_ids = device_id
        }

        await userExist.save()

        let currentUser = { ...userExist._doc }

        delete currentUser.password
        currentUser.image_url = userExist.image_url

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

const signup = (async (req, res) => {
    try {

        let { body, files } = req
        let { email, role } = body

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let userExist = await User.findOne({ email }, { _id: 1 })

        if (userExist) {
            throw new Error(ERRORS.USER_EXIST)
        }

        let payload = { ...body }

        // Set default role to USER if not provided
        if (!role) {
            payload.role = ROLES.USER
        }

        // Convert files array to object for easier access (when using .any())
        let filesMap = {}
        if (files && Array.isArray(files)) {
            files.forEach(file => {
                filesMap[file.fieldname] = file
            })
        }

        // Handle profile picture upload
        if (filesMap['image']) {
            payload.picture = normalize(filesMap['image'].path)
        }

        // Handle provider certifications
        if (role === ROLES.PROVIDER) {
            // Build certifications array from form fields
            let certifications = []

            // Method 1: Try to extract from array notation
            let certIndex = 0
            while (body[`certifications[${certIndex}][institution_name]`]) {
                let cert = {
                    institution_name: body[`certifications[${certIndex}][institution_name]`],
                    certificate_title: body[`certifications[${certIndex}][certificate_title]`],
                    certificate_picture: null
                }

                // Check if there's a corresponding file upload
                const certPictureField = `certifications[${certIndex}][certificate_picture]`
                if (filesMap[certPictureField]) {
                    cert.certificate_picture = normalize(filesMap[certPictureField].path)
                }

                certifications.push(cert)
                certIndex++
            }

            // Method 2: If no certifications found, try to parse from JSON string
            if (certifications.length === 0 && body.certifications) {
                try {
                    let parsedCerts = typeof body.certifications === 'string'
                        ? JSON.parse(body.certifications)
                        : body.certifications

                    if (Array.isArray(parsedCerts)) {
                        certifications = parsedCerts.map((cert, index) => {
                            let certData = {
                                institution_name: cert.institution_name,
                                certificate_title: cert.certificate_title,
                                certificate_picture: null
                            }

                            // Try to find matching file
                            if (filesMap[`certificates[${index}]`]) {
                                certData.certificate_picture = normalize(filesMap[`certificates[${index}]`].path)
                            } else if (filesMap.certificates && filesMap.certificates[index]) {
                                certData.certificate_picture = normalize(filesMap.certificates[index].path)
                            }

                            return certData
                        })
                    }
                } catch (e) {
                    console.log('Error parsing certifications JSON:', e)
                }
            }

            if (certifications.length === 0) {
                throw new Error("Service providers must provide at least one certification")
            }

            payload.certifications = certifications

            if (role === ROLES.PROVIDER) {
                payload.is_verified = false; // Providers need admin approval
                payload.active = false; // Admin can activate later
            }

            // Remove the individual certification fields from payload
            Object.keys(payload).forEach(key => {
                if (key.startsWith('certifications[')) {
                    delete payload[key]
                }
            })
        }

        let user = new User(payload)
        await user.save()

        // let conversation = new Conversation({ participants: [user._id] })
        // await conversation.save()

        const message = role === ROLES.PROVIDER
            ? "Service Provider Successfully Registered. Your account will be verified by admin."
            : "User Successfully Registered"

        return res.status(200).send({
            success: true,
            message
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

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

module.exports = {
    login,
    socialLogin,
    signup,
    forgetPassword,
    verifyOtp,
    resetPassword
}
