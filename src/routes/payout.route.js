const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })

const payoutController = require('../controllers/payout.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

// Stripe Connect backend-only onboarding
router.post('/connect/create-account',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    upload.single('id_document'),
    payoutController.createConnectAccount
)

router.get('/connect/provider-details',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getProviderDetails
)

router.post('/sync-status',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.syncAccountStatus
)

router.post('/connect/upload-document',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    upload.single('document'),
    payoutController.uploadVerificationDocument
)

router.get('/connect/required-fields',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getRequiredFields
)

// Payout settings
router.get('/settings',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getPayoutSettings
)

router.put('/settings',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.updatePayoutSettings
)

// Payout history and statistics
router.get('/payouts',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getProviderPayouts
)

router.get('/payouts/stats',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getProviderPayoutStats
)

router.get('/booking-payout-history',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getBookingPayoutHistory
)

// Stripe account management
router.get('/account/balance',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getAccountBalance
)

router.get('/account/details',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.getAccountDetails
)

router.post('/account/dashboard-link',
    AuthVerifier,
    RestrictAccess([ROLES.PROVIDER]),
    payoutController.createDashboardLoginLink
)

module.exports = router
