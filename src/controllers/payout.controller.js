const User = require('../models/user.model')
const Payout = require('../models/payout.model')
const Booking = require('../models/booking.model')
const StripeConnectService = require('../services/stripeConnect.service')
const { ERRORS, objectValidator, paginationHandler, getDateRangeQuery } = require('../utils')
const mongoose = require('mongoose')

/**
 * Sync user's database status with current Stripe account status
 */
const syncAccountStatus = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        if (!user.stripe_account_id) {
            throw new Error('No Stripe Connect account found')
        }

        // Get current account status from Stripe
        const account = await StripeConnectService.getAccount(user.stripe_account_id)

        // Determine status based on Stripe account
        let status = 'pending'
        if (account.charges_enabled && account.payouts_enabled) {
            status = 'enabled'
        } else if (account.requirements.currently_due.length > 0) {
            status = 'restricted'
        }

        // Update user's database with current Stripe status
        await User.findByIdAndUpdate(userId, {
            stripe_account_status: status,
            payout_enabled: account.payouts_enabled || false
        })

        return res.status(200).send({
            success: true,
            message: 'Account status synced successfully',
            data: {
                stripe_account_status: status,
                payout_enabled: account.payouts_enabled || false,
                charges_enabled: account.charges_enabled || false,
                account_id: account.id
            }
        })
    } catch (error) {
        console.error('Error syncing account status:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's stored details for editing/updating
 */
const getProviderDetails = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        // Get payout details from bankdetails (fallback to payout_details for older records)
        const payoutDetails = user.bankdetails || user.payout_details || {}

        return res.status(200).send({
            success: true,
            data: {
                // Payout details (from payout_details object)
                first_name: payoutDetails.first_name,
                last_name: payoutDetails.last_name,
                date_of_birth: payoutDetails.date_of_birth,
                country: payoutDetails.country,
                address_line1: payoutDetails.address_line1,
                city: payoutDetails.city,
                postal_code: payoutDetails.postal_code,
                state: payoutDetails.state,
                email: payoutDetails.email,
                phone_number: payoutDetails.phone_number,

                // Bank info (masked for security)
                bank_account_number: payoutDetails.bank_account_number,
                bank_routing_number: payoutDetails.bank_routing_number,
                bank_account_holder_name: payoutDetails.bank_account_holder_name,

                // SSN (masked for security)
                ssn_full_number: payoutDetails.ssn_full_number,

                // Stripe account info (from main user object)
                stripe_account_id: user.stripe_account_id,
                stripe_account_status: user.stripe_account_status,
                payout_enabled: user.payout_enabled,
                payout_schedule: user.payout_schedule,
                payout_day: user.payout_day,
                disbursement_days: user.disbursement_days
            }
        })
    } catch (error) {
        console.error('Error getting provider details:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Create Stripe Connect account with collected provider information
 */
const createConnectAccount = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id
        const {
            // Basic Identity
            first_name,
            last_name,
            date_of_birth,
            country,

            // Address
            address_line1,
            city,
            postal_code,
            state,

            // Contact
            email,
            phone_number,

            // Bank Account (for payouts)
            bank_account_number,
            bank_routing_number,
            bank_account_holder_name,

            // Verification
            ssn_full_number
        } = req.body

        const user = await User.findById(userId)
        console.log(user)
        if (!user) {
            throw new Error('User not found')
        }

        if (user.role !== 'provider') {
            throw new Error('Only providers can create Connect accounts')
        }

        // Validate required fields
        if (!first_name || !last_name || !date_of_birth || !country ||
            !address_line1 || !city || !postal_code || !state ||
            !email || !phone_number ||
            !bank_account_number || !bank_routing_number || !bank_account_holder_name) {
            throw new Error('Missing required fields for Stripe Connect account creation')
        }

        // Get uploaded identity document if any
        const idDocumentFile = req.file || null

        // Create Connect account with minimal required information
        const account = await StripeConnectService.createConnectAccountWithDetails(userId, {
            email: email || user.email,
            personalInfo: {
                first_name,
                last_name,
                phone_number,
                date_of_birth,
                address: {
                    line1: address_line1,
                    city,
                    state,
                    postal_code,
                    country
                },
                ssn_full_number
            },
            bankAccount: {
                account_number: bank_account_number,
                routing_number: bank_routing_number,
                account_holder_name: bank_account_holder_name
            }
        }, req.ip, idDocumentFile)

        // Store all provider details in user object (bankdetails)
        const bankdetails = {
            first_name,
            last_name,
            date_of_birth,
            country,
            address_line1,
            city,
            postal_code,
            state,
            email: email || user.email,
            phone_number,
            bank_account_number,
            bank_routing_number,
            bank_account_holder_name,
            ssn_full_number
        }

        await User.findByIdAndUpdate(userId, {
            // Keep both keys for backward compatibility
            bankdetails,
            payout_details: bankdetails,

            // Only update Stripe-related fields
            stripe_account_id: account.id,
            stripe_account_status: account.charges_enabled && account.payouts_enabled ? 'enabled' : 'pending',
            payout_enabled: account.payouts_enabled || false,
            disbursement_days: user.disbursement_days || 7
        })

        return res.status(200).send({
            success: true,
            message: 'Stripe Connect account created successfully',
            data: {
                account_id: account.id,
                status: account.charges_enabled ? 'enabled' : 'pending',
                requirements: account.requirements
            }
        })
    } catch (error) {
        console.error('Error creating Connect account:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Upload verification document for Stripe Connect
 */
const uploadVerificationDocument = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id
        const { document_type } = req.body // 'identity_document' or 'company_document'

        if (!req.file) {
            throw new Error('No document file provided')
        }

        const user = await User.findById(userId)
        if (!user || user.role !== 'provider') {
            throw new Error('Provider not found')
        }

        // Upload document to Stripe and get file ID
        const fileId = await StripeConnectService.uploadVerificationDocument(
            req.file.buffer,
            req.file.mimetype,
            document_type
        )

        return res.status(200).send({
            success: true,
            message: 'Document uploaded successfully',
            data: {
                file_id: fileId,
                document_type
            }
        })
    } catch (error) {
        console.error('Error uploading verification document:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get required fields for Stripe Connect onboarding
 */
const getRequiredFields = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user || user.role !== 'provider') {
            throw new Error('Provider not found')
        }

        // Check if account already exists
        let existingAccount = null
        if (user.stripe_account_id) {
            try {
                existingAccount = await StripeConnectService.getAccount(user.stripe_account_id)
            } catch (error) {
                console.error('Error fetching existing account:', error)
            }
        }

        return res.status(200).send({
            success: true,
            data: {
                has_account: !!user.stripe_account_id,
                account_status: user.stripe_account_status,
                existing_account: existingAccount ? {
                    id: existingAccount.id,
                    charges_enabled: existingAccount.charges_enabled,
                    payouts_enabled: existingAccount.payouts_enabled,
                    requirements: existingAccount.requirements
                } : null,
                required_fields: {
                    basic_identity: [
                        'first_name',
                        'last_name',
                        'date_of_birth',
                        'country'
                    ],
                    verification: [
                        'ssn_full_number', // Full SSN required for Custom accounts
                        'id_document' // Identity document for verification
                    ],
                    address: [
                        'address_line1',
                        'city',
                        'postal_code',
                        'state', // for US
                        'country'
                    ],
                    contact: [
                        'email',
                        'phone_number'
                    ],
                    bank_account: [
                        'bank_account_number',
                        'bank_routing_number',
                        'bank_account_holder_name'
                    ]
                },
                note: "These are the minimum fields required to enable payouts. Additional verification may be requested by Stripe based on transaction volume."
            }
        })
    } catch (error) {
        console.error('Error getting required fields:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's payout settings
 */
const getPayoutSettings = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        return res.status(200).send({
            success: true,
            data: {
                stripe_account_id: user.stripe_account_id,
                stripe_account_status: user.stripe_account_status,
                payout_enabled: user.payout_enabled,
                payout_schedule: user.payout_schedule,
                payout_day: user.payout_day,
                disbursement_days: user.disbursement_days
            }
        })
    } catch (error) {
        console.error('Error getting payout settings:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Update provider's payout settings
 */
const updatePayoutSettings = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id
        const { payout_schedule, payout_day, disbursement_days } = req.body

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        if (user.role !== 'provider') {
            throw new Error('Only providers can update payout settings')
        }

        const updateData = {}

        if (payout_schedule) {
            if (!['manual', 'daily', 'weekly'].includes(payout_schedule)) {
                throw new Error('Invalid payout schedule')
            }
            updateData.payout_schedule = payout_schedule
        }

        if (payout_day !== undefined) {
            if (payout_schedule === 'weekly' && (payout_day < 1 || payout_day > 7)) {
                throw new Error('Payout day must be between 1 and 7 for weekly schedule')
            }
            if (payout_schedule === 'daily' && payout_day < 1) {
                throw new Error('Disbursement days must be at least 1')
            }
            updateData.payout_day = payout_day
        }

        if (disbursement_days !== undefined) {
            if (disbursement_days < 0) {
                throw new Error('Disbursement days cannot be negative')
            }
            updateData.disbursement_days = disbursement_days
        }

        await User.findByIdAndUpdate(userId, updateData)

        return res.status(200).send({
            success: true,
            message: 'Payout settings updated successfully'
        })
    } catch (error) {
        console.error('Error updating payout settings:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's payouts
 */
const getProviderPayouts = async (req, res) => {
    try {
        const { decoded } = req
        const { page, per_page, status, from, to } = req.query
        const { skip, limit } = paginationHandler(page, per_page)

        let filter = { provider_id: decoded.id }
        let sort = { createdAt: -1 }

        // Filter by status
        if (status) {
            filter.status = status
        }

        // Date range filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to)
        }

        const payouts = await Payout.find(filter)
            .populate('booking_id', 'booking_id price session_date session_time')
            .sort(sort)
            .skip(skip)
            .limit(limit)

        const total = await Payout.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: payouts
        })
    } catch (error) {
        console.error('Error getting provider payouts:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's payout statistics
 */
const getProviderPayoutStats = async (req, res) => {
    try {
        const { decoded } = req
        const providerId = decoded.id

        const stats = await Payout.aggregate([
            { $match: { provider_id: new mongoose.Types.ObjectId(providerId) } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total_amount: { $sum: '$provider_amount' }
                }
            }
        ])

        const totalEarnings = await Payout.aggregate([
            { $match: { provider_id: new mongoose.Types.ObjectId(providerId), status: 'paid' } },
            { $group: { _id: null, amount: { $sum: '$provider_amount' } } }
        ])

        const pendingEarnings = await Payout.aggregate([
            { $match: { provider_id: new mongoose.Types.ObjectId(providerId), status: 'pending' } },
            { $group: { _id: null, amount: { $sum: '$provider_amount' } } }
        ])

        return res.status(200).send({
            success: true,
            data: {
                by_status: stats,
                total_earnings: totalEarnings[0]?.amount || 0,
                pending_earnings: pendingEarnings[0]?.amount || 0
            }
        })
    } catch (error) {
        console.error('Error getting provider payout stats:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's Stripe account balance
 */
const getAccountBalance = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user || !user.stripe_account_id) {
            throw new Error('Stripe Connect account not found')
        }

        const balance = await StripeConnectService.getAccountBalance(user.stripe_account_id)

        return res.status(200).send({
            success: true,
            data: balance
        })
    } catch (error) {
        console.error('Error getting account balance:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Create dashboard login link for Stripe Connect account
 */
const createDashboardLoginLink = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        if (!user.stripe_account_id) {
            throw new Error('No Stripe Connect account found')
        }

        // Check account status
        const account = await StripeConnectService.getAccount(user.stripe_account_id)

        // Only create login link if account is properly onboarded
        if (!account.charges_enabled || !account.payouts_enabled) {
            // Create onboarding link for restricted accounts
            const onboardingLink = await StripeConnectService.createOnboardingLink(user.stripe_account_id)

            return res.status(200).send({
                success: true,
                data: {
                    login_url: null,
                    onboarding_url: onboardingLink.url,
                    account_status: user.stripe_account_status,
                    requirements: account.requirements,
                    message: "Account needs to complete onboarding before accessing dashboard.",
                    next_steps: [
                        "Click onboarding link to complete Stripe requirements",
                        "Accept Terms of Service in Stripe dashboard",
                        "Complete any pending verification requirements"
                    ]
                }
            })
        }

        // Create login link for fully onboarded accounts
        const loginLink = await StripeConnectService.createLoginLink(user.stripe_account_id)

        return res.status(200).send({
            success: true,
            data: {
                login_url: loginLink.url,
                account_status: user.stripe_account_status,
                expires_at: new Date(loginLink.created * 1000 + loginLink.expires_in * 1000)
            }
        })
    } catch (error) {
        console.error('Error creating dashboard login link:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's Stripe Connect account details
 */
const getAccountDetails = async (req, res) => {
    try {
        const { decoded } = req
        const userId = decoded.id

        const user = await User.findById(userId)
        if (!user) {
            throw new Error('User not found')
        }

        if (!user.stripe_account_id) {
            return res.status(200).send({
                success: true,
                data: {
                    has_account: false,
                    message: 'No Stripe Connect account found'
                }
            })
        }

        // Get account details from Stripe
        const account = await StripeConnectService.getAccount(user.stripe_account_id)

        return res.status(200).send({
            success: true,
            data: {
                has_account: true,
                account_id: account.id,
                charges_enabled: account.charges_enabled,
                payouts_enabled: account.payouts_enabled,
                requirements: account.requirements,
                capabilities: account.capabilities,
                business_profile: account.business_profile,
                individual: account.individual,
                external_accounts: account.external_accounts,
                created: account.created,
                updated: account.updated
            }
        })
    } catch (error) {
        console.error('Error getting account details:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider's booking payout history
 */
const getBookingPayoutHistory = async (req, res) => {
    try {
        const { decoded } = req
        const { page, per_page, status } = req.query
        const { skip, limit } = paginationHandler(page, per_page)

        let filter = {
            provider_id: decoded.id,
            payment_status: 'paid'
        }
        let sort = { createdAt: -1 }

        // Filter by payout status
        if (status) {
            filter.payout_status = status
        }

        const bookings = await Booking.find(filter)
            .populate('user_id', 'first_name last_name email')
            .populate('payout_id', 'status provider_amount processed_date')
            .sort(sort)
            .skip(skip)
            .limit(limit)

        const total = await Booking.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: bookings
        })
    } catch (error) {
        console.error('Error getting booking payout history:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

module.exports = {
    createConnectAccount,
    syncAccountStatus,
    getProviderDetails,
    uploadVerificationDocument,
    getRequiredFields,
    getPayoutSettings,
    updatePayoutSettings,
    getProviderPayouts,
    getProviderPayoutStats,
    getAccountBalance,
    getAccountDetails,
    createDashboardLoginLink,
    getBookingPayoutHistory
}
