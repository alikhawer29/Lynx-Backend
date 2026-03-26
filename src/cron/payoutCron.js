const cron = require('node-cron')
const Payout = require('../models/payout.model')
const Booking = require('../models/booking.model')
const User = require('../models/user.model')
const StripeConnectService = require('../services/stripeConnect.service')

class PayoutCronJob {

    /**
     * Start the payout processing cron job
     * Runs daily at midnight to process eligible payouts based on disbursement days
     */
    static startPayoutCron() {
        // Run daily at midnight (00:00)
        cron.schedule('0 0 * * *', async () => {
            console.log('[PAYOUT CRON] Running automated payout processing at', new Date().toISOString())
            await this.processAutomatedPayouts()
        })

        console.log('[PAYOUT CRON] Simplified payout cron job started successfully')
    }

    /**
     * Process automated payouts based on disbursement days (NEW SIMPLIFIED LOGIC)
     */
    static async processAutomatedPayouts() {
        try {
            console.log('[PAYOUT CRON] Starting automated payout processing...')

            // Import the new simplified function
            const { processAutomatedPayouts } = require('../controllers/Admin/payout.controller')

            // Call the simplified automated payout function
            await processAutomatedPayouts()

        } catch (error) {
            console.error('[PAYOUT CRON] Error in automated payout processing:', error)
        }
    }

    /**
     * Process scheduled payouts (manual and daily schedules)
     */
    static async processScheduledPayouts() {
        try {
            const now = new Date()

            // Find payouts that are due for processing
            const duePayouts = await Payout.find({
                status: 'pending',
                scheduled_date: { $lte: now },
                $or: [
                    { payout_type: 'manual' },
                    { payout_type: 'daily' }
                ]
            }).populate('provider_id')

            console.log(`[PAYOUT CRON] Found ${duePayouts.length} scheduled payouts to process`)

            for (const payout of duePayouts) {
                try {
                    await this.processSinglePayout(payout)
                } catch (error) {
                    console.error(`[PAYOUT CRON] Error processing payout ${payout._id}:`, error.message)
                }
            }

            console.log(`[PAYOUT CRON] Completed processing scheduled payouts`)
        } catch (error) {
            console.error('[PAYOUT CRON] Error in processScheduledPayouts:', error)
        }
    }

    /**
     * Process weekly payouts based on booking configurations
     */
    static async processWeeklyPayouts() {
        try {
            const now = new Date()
            const currentDayOfWeek = now.getDay() // 0 = Sunday, 1 = Monday, etc.

            // Find bookings with weekly payout schedule for today
            const weeklyBookings = await Booking.aggregate([
                {
                    $match: {
                        'admin_payout_config.payout_method': 'weekly',
                        'admin_payout_config.weekly_payout_day': currentDayOfWeek === 0 ? 7 : currentDayOfWeek,
                        payment_status: 'paid',
                        payout_status: { $in: ['pending', 'processing'] }
                    }
                },
                {
                    $lookup: {
                        from: 'payouts',
                        localField: '_id',
                        foreignField: 'booking_id',
                        as: 'payout'
                    }
                },
                {
                    $match: {
                        $or: [
                            { payout: { $size: 0 } }, // No payout created yet
                            { 'payout.status': 'pending' } // Payout exists but still pending
                        ]
                    }
                }
            ])

            console.log(`[PAYOUT CRON] Found ${weeklyBookings.length} bookings for weekly payouts`)

            for (const bookingData of weeklyBookings) {
                try {
                    await this.processBookingWeeklyPayout(bookingData._id)
                } catch (error) {
                    console.error(`[PAYOUT CRON] Error processing weekly payout for booking ${bookingData._id}:`, error.message)
                }
            }

            console.log(`[PAYOUT CRON] Completed processing weekly payouts`)
        } catch (error) {
            console.error('[PAYOUT CRON] Error in processWeeklyPayouts:', error)
        }
    }

    /**
     * Process weekly payout for a specific booking
     */
    static async processBookingWeeklyPayout(bookingId) {
        try {
            const booking = await Booking.findById(bookingId)
            const existingPayout = await Payout.findOne({ booking_id: bookingId })

            if (existingPayout && existingPayout.status === 'pending') {
                // Process existing pending payout
                await this.processSinglePayout(existingPayout)
            } else if (!existingPayout) {
                // Create new payout for the booking
                await this.createPayoutForCompletedBooking(bookingId)
            }
        } catch (error) {
            console.error('[PAYOUT CRON] Error in processBookingWeeklyPayout:', error)
        }
    }

    /**
     * Process a single payout
     */
    static async processSinglePayout(payout) {
        try {
            // Check if payout can be processed
            if (payout.status !== 'pending') {
                console.log(`[PAYOUT CRON] Payout ${payout._id} is not in pending status, skipping`)
                return
            }

            // Verify provider has enabled Stripe Connect using live Stripe status
            const provider = payout.provider_id
            if (!provider?.stripe_account_id) {
                console.log(`[PAYOUT CRON] Provider ${provider?._id} has no Stripe account, skipping payout ${payout._id}`)
                return
            }

            const account = await StripeConnectService.getAccount(provider.stripe_account_id)
            const payoutsEnabled = !!account.payouts_enabled
            const chargesEnabled = !!account.charges_enabled

            await User.findByIdAndUpdate(provider._id, {
                payout_enabled: payoutsEnabled,
                stripe_account_status: chargesEnabled && payoutsEnabled ? 'enabled' : 'pending'
            })

            if (!payoutsEnabled) {
                console.log(`[PAYOUT CRON] Provider ${provider._id} not eligible for payouts, skipping payout ${payout._id}`)
                return
            }

            // Process the transfer
            await StripeConnectService.createTransfer(payout._id)
            console.log(`[PAYOUT CRON] Successfully processed payout ${payout._id} for provider ${provider._id}`)
        } catch (error) {
            console.error(`[PAYOUT CRON] Failed to process payout ${payout._id}:`, error.message)

            // Mark payout as failed
            await payout.markAsFailed(error.message)
        }
    }

    /**
     * Create payouts for completed bookings
     * This should be called when a booking is marked as completed
     */
    static async createPayoutForCompletedBooking(bookingId) {
        try {
            const booking = await Booking.findById(bookingId).populate('provider_id')

            if (!booking) {
                throw new Error('Booking not found')
            }

            if (booking.payment_status !== 'paid') {
                console.log(`[PAYOUT CRON] Booking ${bookingId} not paid, skipping payout creation`)
                return
            }

            if (booking.status !== 'approved' || booking.booking_status !== 'past') {
                console.log(`[PAYOUT CRON] Booking ${bookingId} is not approved/past, skipping payout creation`)
                return
            }

            if (booking.payout_status !== 'pending') {
                console.log(`[PAYOUT CRON] Booking ${bookingId} already has payout status: ${booking.payout_status}`)
                return
            }

            const provider = booking.provider_id
            if (!provider.stripe_account_id) {
                console.log(`[PAYOUT CRON] Provider ${provider._id} has no Stripe account, skipping payout creation`)
                return
            }

            const account = await StripeConnectService.getAccount(provider.stripe_account_id)
            if (!account.payouts_enabled) {
                console.log(`[PAYOUT CRON] Provider ${provider._id} payouts not enabled yet, skipping payout creation`)
                return
            }

            // Calculate amounts (adjust based on your fee structure)
            const platformFeePercentage = 0.1 // 10% platform fee
            const platformFee = Math.round(booking.price * platformFeePercentage * 100) / 100
            const providerAmount = booking.price - platformFee

            // Create payout using booking-level configuration
            const payout = await StripeConnectService.createPayoutForBooking(
                bookingId,
                providerAmount,
                platformFee
            )

            console.log(`[PAYOUT CRON] Created payout ${payout._id} for booking ${bookingId}`)
            return payout
        } catch (error) {
            console.error(`[PAYOUT CRON] Error creating payout for booking ${bookingId}:`, error.message)
            throw error
        }
    }

    /**
     * Retry failed payouts (max 3 attempts)
     */
    static async retryFailedPayouts() {
        try {
            const failedPayouts = await Payout.find({
                status: 'failed',
                retry_count: { $lt: 3 },
                $or: [
                    { last_retry_date: null },
                    { last_retry_date: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } // 24 hours ago
                ]
            }).populate('provider_id')

            console.log(`[PAYOUT CRON] Found ${failedPayouts.length} failed payouts to retry`)

            for (const payout of failedPayouts) {
                try {
                    // Reset to pending and retry
                    payout.status = 'pending'
                    payout.failure_reason = null
                    await payout.save()

                    await this.processSinglePayout(payout)
                } catch (error) {
                    console.error(`[PAYOUT CRON] Error retrying payout ${payout._id}:`, error.message)
                }
            }
        } catch (error) {
            console.error('[PAYOUT CRON] Error in retryFailedPayouts:', error)
        }
    }

    /**
     * Get payout statistics for monitoring
     */
    static async getPayoutStatistics() {
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

            const overduePayouts = await Payout.countDocuments({
                status: 'pending',
                scheduled_date: { $lt: new Date() }
            })

            return {
                by_status: stats,
                overdue_count: overduePayouts
            }
        } catch (error) {
            console.error('[PAYOUT CRON] Error getting payout statistics:', error)
            throw error
        }
    }
}

module.exports = PayoutCronJob
