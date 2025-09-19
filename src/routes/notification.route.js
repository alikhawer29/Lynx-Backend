const express = require('express')
const router = express.Router()

const notificationController = require('../controllers/notification.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.get('/get', AuthVerifier, notificationController.getNotification)

module.exports = router