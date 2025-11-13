const express = require('express')
const router = express.Router()

const userRoutes = require('./user.route')
const authRoutes = require('./authentication.route')
const feedbackRoutes = require('./feedback.route')
const generalRoutes = require('./general.route')
const categoryRoutes = require('./category.route')
const conversationRoutes = require('./conversation.route')
const notificationRoutes = require('./notification.route')
const packageRoutes = require('./package.route')
const serviceRoutes = require('./service.route')
const bookingRoutes = require('./booking.route')
const pushnotificationRoutes = require('./pushnotification.route')
const contentRoutes = require('./content.route')
const reviewRoutes = require('./review.route')
const reportRoutes = require('./report.route')
const slotRoutes = require('./slot.route')

router.use('/user', userRoutes)

router.use('/auth', authRoutes)

router.use('/feedback', feedbackRoutes)

router.use('/general', generalRoutes)

router.use('/category', categoryRoutes)

router.use('/conversation', conversationRoutes)

router.use('/notification', notificationRoutes)

router.use('/package', packageRoutes)

router.use('/service', serviceRoutes)

router.use('/booking', bookingRoutes)

router.use('/push-notification', pushnotificationRoutes)

router.use('/content', contentRoutes)

router.use('/review', reviewRoutes)

router.use('/report', reportRoutes)

router.use('/slot', slotRoutes)

module.exports = router