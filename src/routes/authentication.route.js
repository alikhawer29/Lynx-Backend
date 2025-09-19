const express = require('express')
const router = express.Router()

const authController = require('../controllers/authentication.controller')
const upload = require('../middlewares/upload.middleware')

router.post('/signup', upload("user").single("image"), authController.signup)

router.post('/login', authController.login)

router.post('/social-login', authController.socialLogin)

router.post('/forget-password', authController.forgetPassword)

router.post('/verify-otp', authController.verifyOtp)

router.post('/reset-password', authController.resetPassword)

module.exports = router