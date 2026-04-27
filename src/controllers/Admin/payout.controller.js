const Payout = require('../../models/payout.model')
const Booking = require('../../models/booking.model')
const User = require('../../models/user.model')
const StripeConnectService = require('../../services/stripeConnect.service')
const { ERRORS, objectValidator, paginationHandler, getDateRangeQuery } = require('../../utils')
const mongoose = require('mongoose')

const getLiveStripePayoutStatus = async (provider) => {
    if (!provider?.stripe_account_id) {
        return { payoutsEnabled: false, chargesEnabled: false }
    }

    try {
        const account = await StripeConnectService.getAccount(provider.stripe_account_id)
        const payoutsEnabled = !!account.payouts_enabled
        const chargesEnabled = !!account.charges_enabled

        // Keep local user status in sync with Stripe.
        await User.findByIdAndUpdate(provider._id, {
            payout_enabled: payoutsEnabled,
            stripe_account_status: chargesEnabled && payoutsEnabled ? 'enabled' : 'pending'
        })

        return { payoutsEnabled, chargesEnabled }
    } catch (error) {
        console.error(`[PAYOUT] Failed to fetch live Stripe status for provider ${provider?._id}:`, error.message)
        return { payoutsEnabled: false, chargesEnabled: false }
    }
}

/**
 * Get current disbursement days configuration
 */
const getDisbursementDays = async (req, res) => {
    try {
        // Get the first provider to see current disbursement days
        const provider = await User.findOne({ role: 'provider' })

        const currentDays = provider ? (provider.disbursement_days || 7) : 7

        return res.status(200).send({
            success: true,
            data: {
                disbursement_days: currentDays,
                message: `Current disbursement days: ${currentDays} days`
            }
        })
    } catch (error) {
        console.error('Error getting disbursement days:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Update disbursement days configuration
 */
const updateDisbursementDays = async (req, res) => {
    try {
        const { disbursement_days } = req.body

        if (!disbursement_days || disbursement_days < 0) {
            throw new Error('Invalid disbursement days')
        }

        // Update all providers with the new disbursement days
        await User.updateMany(
            { role: 'provider' },
            { disbursement_days: disbursement_days }
        )

        return res.status(200).send({
            success: true,
            message: 'Disbursement days updated successfully'
        })
    } catch (error) {
        console.error('Error updating disbursement days:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Process automated payouts based on disbursement days
 */
const processAutomatedPayouts = async () => {
    try {
        console.log('[PAYOUT CRON] Starting automated payout processing...')

        // Get all providers with their disbursement days
        const providers = await User.find({ role: 'provider' })

        let totalProcessed = 0
        let totalAmount = 0

        for (const provider of providers) {
            const { payoutsEnabled } = await getLiveStripePayoutStatus(provider)
            if (!payoutsEnabled) {
                continue
            }

            const disbursementDays = provider.disbursement_days || 7 // Default 7 days
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - disbursementDays)

            // Find eligible bookings for this provider
            const eligibleBookings = await Booking.find({
                provider_id: provider._id,
                status: 'approved',
                booking_status: 'past',
                payment_status: 'paid',
                payout_status: { $in: ['pending', null] },
                createdAt: { $lte: cutoffDate }
            }).populate('payout_id')

            // Process each eligible booking
            for (const booking of eligibleBookings) {
                try {
                    // Skip if payout already exists and is processed
                    if (booking.payout_id && booking.payout_id.status !== 'failed') {
                        continue
                    }

                    // Calculate amounts (10% platform fee)
                    const platformFeePercentage = 0.1
                    const platformFee = Math.round(booking.price * platformFeePercentage * 100) / 100
                    const providerAmount = booking.price - platformFee

                    // Create and process payout
                    const payout = await StripeConnectService.createPayoutForBooking(
                        booking._id,
                        providerAmount,
                        platformFee
                    )

                    // Update booking payout status
                    await Booking.findByIdAndUpdate(booking._id, {
                        payout_status: 'paid',
                        payout_id: payout._id,
                        payout_processed_date: new Date()
                    })

                    totalProcessed++
                    totalAmount += providerAmount

                    console.log(`[PAYOUT CRON] Processed payout for booking ${booking._id} - Amount: $${providerAmount}`)

                } catch (bookingError) {
                    console.error(`[PAYOUT CRON] Error processing booking ${booking._id}:`, bookingError.message)

                    // Mark booking as failed
                    await Booking.findByIdAndUpdate(booking._id, {
                        payout_status: 'failed'
                    })
                }
            }
        }

        console.log(`[PAYOUT CRON] Completed. Processed ${totalProcessed} payouts totaling $${totalAmount}`)

    } catch (error) {
        console.error('[PAYOUT CRON] Error in automated payout processing:', error)
    }
}

/**
 * Get eligible bookings for payout preview
 */
const getEligibleBookings = async (req, res) => {
    try {
        const { page, per_page } = req.query
        const { skip, limit } = paginationHandler(page, per_page)

        // Get all providers with their disbursement days
        const providers = await User.find({ role: 'provider' })

        let allEligibleBookings = []

        for (const provider of providers) {
            const { payoutsEnabled } = await getLiveStripePayoutStatus(provider)
            if (!payoutsEnabled) {
                continue
            }

            const disbursementDays = provider.disbursement_days || 7 // Default 7 days
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - disbursementDays)

            // Find eligible bookings for this provider
            const eligibleBookings = await Booking.find({
                provider_id: provider._id,
                status: 'approved',
                booking_status: 'past',
                payment_status: 'paid',
                payout_status: { $in: ['pending', null] },
                createdAt: { $lte: cutoffDate }
            })
                .populate('user_id', 'first_name last_name email')
                .populate('provider_id', 'first_name last_name email disbursement_days')
                .sort({ createdAt: 1 })

            // Add calculated amounts
            const bookingsWithAmounts = eligibleBookings.map(booking => {
                const platformFeePercentage = 0.1
                const platformFee = Math.round(booking.price * platformFeePercentage * 100) / 100
                const providerAmount = booking.price - platformFee

                return {
                    ...booking.toObject(),
                    platform_fee: platformFee,
                    provider_amount: providerAmount,
                    disbursement_days: provider.disbursement_days || 7,
                    days_since_booking: Math.floor((new Date() - booking.createdAt) / (1000 * 60 * 60 * 24))
                }
            })

            allEligibleBookings.push(...bookingsWithAmounts)
        }

        // Sort by creation date
        allEligibleBookings.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

        // Apply pagination
        const total = allEligibleBookings.length
        const paginatedBookings = allEligibleBookings.slice(skip, skip + limit)

        // Calculate totals
        const totalAmount = allEligibleBookings.reduce((sum, booking) => sum + booking.provider_amount, 0)
        const totalPlatformFee = allEligibleBookings.reduce((sum, booking) => sum + booking.platform_fee, 0)

        return res.status(200).send({
            success: true,
            data: {
                bookings: paginatedBookings,
                total,
                summary: {
                    total_eligible_bookings: total,
                    total_payout_amount: totalAmount,
                    total_platform_fee: totalPlatformFee,
                    total_gross_amount: totalAmount + totalPlatformFee
                }
            }
        })
    } catch (error) {
        console.error('Error getting eligible bookings:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get booking logs for payout management
 */
const getBookingLogs = async (req, res) => {
    try {
        const { page, per_page, search, status, from, to } = req.query
        const { skip, limit } = paginationHandler(page, per_page)

        let filter = {
            status: 'approved',
            booking_status: 'past',
            payment_status: 'paid'
        }
        let sort = { createdAt: -1 }

        // Filter by payout status
        if (status) {
            filter.payout_status = status
        }

        // Search by booking ID or user details
        if (search) {
            filter.$or = [
                { booking_id: { $regex: search, $options: 'i' } },
                { 'user_id.first_name': { $regex: search, $options: 'i' } },
                { 'user_id.last_name': { $regex: search, $options: 'i' } },
                { 'provider_id.first_name': { $regex: search, $options: 'i' } },
                { 'provider_id.last_name': { $regex: search, $options: 'i' } }
            ]
        }

        // Date range filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to)
        }

        const bookings = await Booking.find(filter)
            .populate('user_id', 'first_name last_name')
            .populate('provider_id', 'first_name last_name stripe_account_id')
            .sort(sort)
            .lean()

        const bookingsWithLiveStripe = []
        for (const booking of bookings) {
            const provider = booking.provider_id
            const { payoutsEnabled } = await getLiveStripePayoutStatus(provider)
            if (!payoutsEnabled) {
                continue
            }
            bookingsWithLiveStripe.push(booking)
        }

        const total = bookingsWithLiveStripe.length
        const paginatedBookings = bookingsWithLiveStripe.slice(skip, skip + limit)

        // Format response with requested fields
        const formattedBookings = paginatedBookings.map(booking => ({
            booking_id: booking.booking_id,
            id: booking._id,
            user_name: booking.user_id ? `${booking.user_id.first_name} ${booking.user_id.last_name}` : 'N/A',
            host_name: booking.provider_id ? `${booking.provider_id.first_name} ${booking.provider_id.last_name}` : 'N/A',
            booking_type: booking.booking_category || 'normal',
            booking_charges: booking.price || 0,
            status: booking.payment_status || 'unpaid',
            payout_status: booking.payout_status || 'unpaid',
            booking_status: booking.booking_status,
            approval_status: booking.status
        }))

        return res.status(200).send({
            success: true,
            total,
            data: formattedBookings
        })
    } catch (error) {
        console.error('Error getting booking logs:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Process manual payout for a specific booking
 */
const processManualPayout = async (req, res) => {
    try {
        const { booking_id } = req.params

        const booking = await Booking.findById(booking_id).populate({
            path: 'provider_id',
            select: 'stripe_account_id stripe_account_status'
        })
        if (!booking) {
            throw new Error('Booking not found')
        }

        if (booking.payout_status === 'paid') {
            throw new Error('Payout already processed')
        }

        if (booking.payment_status !== 'paid') {
            throw new Error('Booking payment not completed')
        }

        const provider = booking.provider_id
        const { payoutsEnabled } = await getLiveStripePayoutStatus(provider)
        if (!provider.stripe_account_id || !payoutsEnabled) {
            throw new Error('Provider does not have an active Stripe Connect account')
        }

        // Calculate amounts (you may want to adjust this based on your fee structure)
        const platformFeePercentage = 0.1 // 10% platform fee
        const platformFee = Math.round(booking.price * platformFeePercentage * 100) / 100
        const providerAmount = booking.price - platformFee

        // Create payout
        const payout = await StripeConnectService.createPayoutForBooking(
            booking_id,
            providerAmount,
            platformFee
        )

        // Process transfer immediately for manual payout
        await StripeConnectService.createTransfer(payout._id)

        return res.status(200).send({
            success: true,
            message: 'Payout processed successfully',
            data: payout
        })
    } catch (error) {
        console.error('Error processing manual payout:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get all payouts with filtering and pagination
 */
const getPayouts = async (req, res) => {
    try {
        const { page, per_page, status, provider_id, from, to } = req.query
        const options = paginationHandler(page, per_page)

        let filter = {}
        let sort = { createdAt: -1 }

        if (status) {
            filter.status = status
        }

        if (provider_id) {
            filter.provider_id = provider_id
        }

        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to)
        }

        const payouts = await Payout.find(filter, options)
            .populate('booking_id', 'booking_id price session_date')
            .populate('provider_id', 'first_name last_name email')
            .sort(sort)

        const total = await Payout.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: payouts
        })
    } catch (error) {
        console.error('Error getting payouts:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get payout statistics
 */
const getPayoutStats = async (req, res) => {
    try {
        const stats = await Payout.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    total_amount: { $sum: '$provider_amount' }
                }
            }
        ])

        const totalPending = await Payout.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$provider_amount' } } }
        ])

        const totalPaid = await Payout.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$provider_amount' } } }
        ])

        return res.status(200).send({
            success: true,
            data: {
                by_status: stats,
                total_pending: totalPending[0] || { count: 0, amount: 0 },
                total_paid: totalPaid[0] || { count: 0, amount: 0 }
            }
        })
    } catch (error) {
        console.error('Error getting payout stats:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Retry failed payout
 */
const retryPayout = async (req, res) => {
    try {
        const { payout_id } = req.params

        const payout = await Payout.findById(payout_id)
        if (!payout) {
            throw new Error('Payout not found')
        }

        if (payout.status !== 'failed') {
            throw new Error('Only failed payouts can be retried')
        }

        if (!payout.can_retry) {
            throw new Error('Maximum retry attempts exceeded')
        }

        // Reset payout status and retry
        payout.status = 'pending'
        payout.failure_reason = null
        await payout.save()

        // Process transfer
        await StripeConnectService.createTransfer(payout_id)

        return res.status(200).send({
            success: true,
            message: 'Payout retry initiated successfully'
        })
    } catch (error) {
        console.error('Error retrying payout:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get provider Stripe Connect status
 */
const getProviderConnectStatus = async (req, res) => {
    try {
        const { provider_id } = req.params

        const provider = await User.findById(provider_id)
        if (!provider) {
            throw new Error('Provider not found')
        }

        let accountDetails = null
        if (provider.stripe_account_id) {
            try {
                accountDetails = await StripeConnectService.getAccount(provider.stripe_account_id)
            } catch (error) {
                console.error('Error fetching account details:', error)
            }
        }

        return res.status(200).send({
            success: true,
            data: {
                provider_id: provider._id,
                stripe_account_id: provider.stripe_account_id,
                stripe_account_status: provider.stripe_account_status,
                payout_enabled: provider.payout_enabled,
                payout_schedule: provider.payout_schedule,
                disbursement_days: provider.disbursement_days,
                account_details: accountDetails
            }
        })
    } catch (error) {
        console.error('Error getting provider connect status:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Configure payout settings for a specific booking
 */
const configureBookingPayout = async (req, res) => {
    try {
        const { booking_id } = req.params
        const { payout_method, weekly_payout_day, disbursement_days } = req.body
        const adminId = req.decoded.id

        // Validate input
        if (!['manual', 'weekly', 'disbursement_day'].includes(payout_method)) {
            throw new Error('Invalid payout method')
        }

        if (payout_method === 'weekly' && (!weekly_payout_day || weekly_payout_day < 1 || weekly_payout_day > 7)) {
            throw new Error('Weekly payout day must be between 1 and 7')
        }

        if (payout_method === 'disbursement_day' && (!disbursement_days || disbursement_days < 0)) {
            throw new Error('Disbursement days must be a positive number')
        }

        // Find and update booking
        const booking = await Booking.findById(booking_id)
        if (!booking) {
            throw new Error('Booking not found')
        }

        // Calculate platform fee and provider amount (10% platform fee)
        const platformFeePercentage = 0.1
        const platformFee = Math.round(booking.price * platformFeePercentage * 100) / 100
        const amountDueToProvider = booking.price - platformFee

        // Update admin payout configuration and financial fields
        booking.admin_payout_config = {
            payout_method,
            weekly_payout_day: payout_method === 'weekly' ? weekly_payout_day : null,
            disbursement_days: payout_method === 'disbursement_day' ? disbursement_days : null,
            configured_by: adminId,
            configured_at: new Date()
        }

        // Set financial fields for validation
        booking.platform_fee = platformFee
        booking.amount_due_to_provider = amountDueToProvider

        await booking.save()

        // If payout already exists, update it with new configuration
        if (booking.payout_id) {
            await Payout.findByIdAndUpdate(booking.payout_id, {
                payout_type: payout_method,
                disbursement_days: payout_method === 'disbursement_day' ? disbursement_days : null,
                provider_amount: amountDueToProvider,
                platform_fee: platformFee
            })
        }

        return res.status(200).send({
            success: true,
            message: 'Booking payout configuration updated successfully',
            data: {
                ...booking.admin_payout_config.toObject(),
                platform_fee: platformFee,
                amount_due_to_provider: amountDueToProvider,
                total_amount: booking.price
            }
        })
    } catch (error) {
        console.error('Error configuring booking payout:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

/**
 * Get booking payout configuration
 */
const getBookingPayoutConfig = async (req, res) => {
    try {
        const { booking_id } = req.params

        const booking = await Booking.findById(booking_id)
            .populate('admin_payout_config.configured_by', 'first_name last_name email')
            .populate('provider_id', 'first_name last_name email stripe_account_status')

        if (!booking) {
            throw new Error('Booking not found')
        }

        return res.status(200).send({
            success: true,
            data: {
                booking_id: booking._id,
                booking_status: booking.status,
                payment_status: booking.payment_status,
                payout_status: booking.payout_status,
                provider: booking.provider_id,
                admin_payout_config: booking.admin_payout_config
            }
        })
    } catch (error) {
        console.error('Error getting booking payout config:', error)
        return res.status(400).send({
            success: false,
            message: error.message
        })
    }
}

module.exports = {
    getDisbursementDays,
    updateDisbursementDays,
    processAutomatedPayouts,
    getEligibleBookings,
    getBookingLogs,
    processManualPayout,
    getPayouts,
    getPayoutStats,
    retryPayout,
    getProviderConnectStatus,
    configureBookingPayout,
    getBookingPayoutConfig
}
