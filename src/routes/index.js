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
const faqRoutes = require('./faq.route')
const chatRoutes = require('./chat.route')

const adminServiceRoutes = require('./Admin/service.route')
const adminCategoryRoutes = require('./Admin/category.route')
const adminContentRoutes = require('./Admin/content.route')

router.use('/user', userRoutes)

router.use('/auth', authRoutes)

router.use('/feedback', feedbackRoutes)

router.use('/general', generalRoutes)

router.use('/category', categoryRoutes)

router.use('/conversation', conversationRoutes)

router.use('/notification', notificationRoutes)

router.use('/package', packageRoutes)

router.use('/service', serviceRoutes)

router.use('/admin/service', adminServiceRoutes)

router.use('/admin/category', adminCategoryRoutes)

router.use('/admin/content', adminContentRoutes)

router.use('/booking', bookingRoutes)

router.use('/push-notification', pushnotificationRoutes)

router.use('/content', contentRoutes)

router.use('/review', reviewRoutes)

router.use('/report', reportRoutes)

router.use('/slot', slotRoutes)

router.use('/faq', faqRoutes)

router.use('/chat', chatRoutes)

module.exports = router