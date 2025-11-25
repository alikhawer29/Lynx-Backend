// authentication.controller.js
const User = require('../../models/user.model')
const Otp = require('../../models/otp.model')
const { comparePassword } = require('../../helpers/encryption')
const { generateToken } = require('../../helpers/token')
const { generateOTP, ERRORS, ROLES } = require('../../utils')
const { sendMail } = require("../../helpers/email")
const response = require('../../utils/response')


const login = (async (req, res) => {
    try {

        let { email, password, device_id } = req.body

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

        let requestedUser = ROLES.ADMIN

        if ((requestedUser !== userExist.role)) {
            throw new Error(ERRORS.UNAUTHORIZED)
        }


        let token = await generateToken({ id: userExist._id, email: userExist.email, role: userExist.role })

        if (device_id) {
            userExist.device_ids = device_id
        }

        await userExist.save()

        let currentUser = { ...userExist._doc }

        delete currentUser.password
        currentUser.image_url = userExist.image_url

        return res.status(200).json(response.success("Admin successfully logged in", {
            token,
            data: currentUser
        }));

    } catch (e) {
        console.log("Error Message :: ", e)
        const errorResponse = response.error(e.message, 400);
        return res.status(errorResponse.statusCode).json(errorResponse);

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

        return res.status(200).json(response.success(`Code has been sent to email.`));

    } catch (e) {
        console.log("Error Message :: ", e)
        const errorResponse = response.error(e.message, 400);
        return res.status(errorResponse.statusCode).json(errorResponse);
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

                return res.status(200).json(response.success("OTP Verified", { email }))

            } else {
                throw new Error("Invalid OTP")
            }

        } else {
            throw new Error("OTP has been expired")
        }

    } catch (e) {
        console.log("Error Message :: ", e)
        const errorResponse = response.error(e.message, 400);
        return res.status(errorResponse.statusCode).json(errorResponse);
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

        return res.status(200).json(response.success("Password reset successfully"));


    } catch (e) {
        console.log("Error Message :: ", e)
        const errorResponse = response.error(e.message, 400);
        return res.status(errorResponse.statusCode).json(errorResponse);
    }
})

module.exports = {
    login,
    forgetPassword,
    verifyOtp,
    resetPassword
}
