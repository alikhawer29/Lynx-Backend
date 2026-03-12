const express = require('express')
const router = express.Router()

const payoutController = require('../../controllers/Admin/payout.controller')
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware')
const { ROLES } = require('../../utils')

// Disbursement configuration
router.get('/disbursement-days',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getDisbursementDays
)

router.post('/disbursement-days/update',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.updateDisbursementDays
)

// Simplified payout flow - eligible bookings
router.get('/eligible-bookings',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getEligibleBookings
)

// Automated payout processing (can be called manually or by cron)
router.post('/process-automated-payouts',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.processAutomatedPayouts
)

// Booking logs for payout management
router.get('/booking-logs',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getBookingLogs
)

// Manual payout processing
router.post('/process/:booking_id',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.processManualPayout
)

// Payout management
router.get('/payouts',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getPayouts
)

router.get('/payouts/stats',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getPayoutStats
)

router.post('/payouts/:payout_id/retry',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.retryPayout
)

// Provider Connect status
router.get('/provider/:provider_id/connect-status',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getProviderConnectStatus
)

// Booking payout configuration
router.post('/booking/:booking_id/configure',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.configureBookingPayout
)

router.get('/booking/:booking_id/config',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    payoutController.getBookingPayoutConfig
)

module.exports = router
