const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const Payout = require('../models/payout.model')
const Booking = require('../models/booking.model')
const User = require('../models/user.model')

class StripeConnectService {

    /**
     * Create Stripe Connect account with minimal provider details (backend-only)
     */
    static async createConnectAccountWithDetails(userId, accountData, requestIp, idDocumentFile = null) {
        try {
            const {
                email,
                personalInfo,
                bankAccount
            } = accountData

            // Create the Connect account with minimal details
            const account = await stripe.accounts.create({
                type: 'custom',
                country: personalInfo?.address?.country || 'US',
                email: email,
                business_type: 'individual',
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                individual: {
                    first_name: personalInfo?.first_name,
                    last_name: personalInfo?.last_name,
                    email: email,
                    phone: personalInfo?.phone_number,
                    dob: {
                        day: parseInt(personalInfo?.date_of_birth.split('-')[2]),
                        month: parseInt(personalInfo?.date_of_birth.split('-')[1]),
                        year: parseInt(personalInfo?.date_of_birth.split('-')[0])
                    },
                    address: {
                        line1: personalInfo?.address?.line1,
                        city: personalInfo?.address?.city,
                        state: personalInfo?.address?.state,
                        postal_code: personalInfo?.address?.postal_code,
                        country: personalInfo?.address?.country
                    },
                    id_number: personalInfo?.ssn_full_number // Use id_number for full SSN
                },
                tos_acceptance: {
                    date: Math.floor(Date.now() / 1000),
                    ip: requestIp // IP of the user
                },
                business_profile: {
                    name: `${personalInfo?.first_name} ${personalInfo?.last_name}`,
                    mcc: '7299',
                    url: 'https://blitzmobileapps.com/' || personalInfo?.website || 'https://example.com' // optional but sometimes required
                },
                external_account: {
                    object: 'bank_account',
                    country: personalInfo?.address?.country || 'US',
                    currency: 'usd',
                    account_number: bankAccount?.account_number,
                    routing_number: bankAccount?.routing_number,
                    account_holder_name: bankAccount?.account_holder_name
                }
            })

            // Upload identity document if provided
            if (idDocumentFile) {
                try {
                    const file = await stripe.files.create({
                        purpose: 'identity_document',
                        file: {
                            data: idDocumentFile.buffer,
                            name: idDocumentFile.originalname,
                            type: idDocumentFile.mimetype
                        }
                    })

                    // Update account with identity document
                    await stripe.accounts.update(account.id, {
                        individual: {
                            verification: {
                                document: {
                                    front: file.id
                                }
                            }
                        }
                    })
                } catch (docError) {
                    console.error('Error uploading identity document:', docError)
                    // Don't fail the account creation if document upload fails
                }
            }

            // Update user with Stripe account ID
            let status = 'pending'
            if (account.charges_enabled && account.payouts_enabled) {
                status = 'enabled'
            } else if (account.requirements.currently_due.length > 0) {
                status = 'restricted'
            }

            const user = await User.findById(userId)
            await User.findByIdAndUpdate(userId, {
                stripe_account_id: account.id,
                stripe_account_status: status,
                payout_enabled: account.payouts_enabled || false, // Sync with Stripe's payout status
                disbursement_days: user.disbursement_days || 7 // Keep existing disbursement days
            })

            return account
        } catch (error) {
            console.error('Error creating Connect account with details:', error)
            throw error
        }
    }

    /**
     * Upload verification document to Stripe
     */
    static async uploadVerificationDocument(fileBuffer, mimeType, documentType) {
        try {
            const file = await stripe.files.create({
                purpose: 'identity_document',
                file: {
                    data: fileBuffer,
                    name: `verification_${Date.now()}.${mimeType.split('/')[1]}`,
                    type: mimeType
                }
            })

            return file.id
        } catch (error) {
            console.error('Error uploading verification document:', error)
            throw error
        }
    }

    /**
     * Update existing account with additional information
     */
    static async updateAccountWithDetails(accountId, accountData) {
        try {
            const updateParams = {}

            if (accountData.personalInfo) {
                updateParams.individual = {
                    ...updateParams.individual,
                    first_name: accountData.personalInfo.first_name,
                    last_name: accountData.personalInfo.last_name,
                    phone: accountData.personalInfo.phone_number,
                    address: {
                        line1: accountData.personalInfo.address.line1,
                        line2: accountData.personalInfo.address.line2 || undefined,
                        city: accountData.personalInfo.address.city,
                        state: accountData.personalInfo.address.state,
                        postal_code: accountData.personalInfo.address.postal_code,
                        country: accountData.personalInfo.address.country
                    }
                }
            }

            if (accountData.verification?.ssn_last4) {
                updateParams.individual = {
                    ...updateParams.individual,
                    ssn_last_4: accountData.verification.ssn_last4
                }
            }

            if (accountData.businessInfo) {
                updateParams.business_profile = {
                    ...updateParams.business_profile,
                    description: accountData.businessInfo.description,
                    url: accountData.businessInfo.website || undefined
                }
            }

            if (accountData.verification?.id_document_front) {
                updateParams.individual = {
                    ...updateParams.individual,
                    verification: {
                        document: {
                            front: accountData.verification.id_document_front
                        }
                    }
                }
            }

            const account = await stripe.accounts.update(accountId, updateParams)
            return account
        } catch (error) {
            console.error('Error updating account with details:', error)
            throw error
        }
    }

    /**
     * Get connected account details
     */
    static async getAccount(accountId) {
        try {
            const account = await stripe.accounts.retrieve(accountId)
            return account
        } catch (error) {
            console.error('Error retrieving account:', error)
            throw error
        }
    }

    /**
     * Create transfer from platform to provider
     */
    static async createTransfer(payoutId) {
        try {
            const payout = await Payout.findById(payoutId)
                .populate('booking_id')
                .populate('provider_id')

            if (!payout) {
                throw new Error('Payout not found')
            }

            if (payout.status !== 'pending') {
                throw new Error('Payout is not in pending status')
            }

            // Update payout status to processing
            payout.status = 'processing'
            await payout.save()

            // Create transfer
            const transfer = await stripe.transfers.create({
                amount: Math.round(payout.provider_amount * 100), // Convert to cents
                currency: 'usd',
                destination: payout.stripe_account_id,
                transfer_group: payout.booking_id.booking_id,
                metadata: {
                    payout_id: payout._id.toString(),
                    booking_id: payout.booking_id._id.toString(),
                    provider_id: payout.provider_id._id.toString()
                }
            })

            // Update payout with transfer details
            await payout.markAsPaid(transfer.id)

            // Update booking payout status
            await Booking.findByIdAndUpdate(payout.booking_id._id, {
                payout_status: 'paid',
                payout_id: payout._id
            })

            return transfer
        } catch (error) {
            console.error('Error creating transfer:', error)

            // Mark payout as failed
            const payout = await Payout.findById(payoutId)
            if (payout) {
                await payout.markAsFailed(error.message)
            }

            throw error
        }
    }

    /**
     * Create onboarding link for restricted accounts
     */
    static async createOnboardingLink(accountId) {
        try {
            const accountLink = await stripe.accountLinks.create({
                account: accountId,
                refresh_url: `${process.env.BASE_URL}/payouts/connect/refresh`,
                return_url: `${process.env.BASE_URL}/payouts/connect/return`,
                type: 'account_onboarding'
            })

            return accountLink
        } catch (error) {
            console.error('Error creating onboarding link:', error)
            throw error
        }
    }

    /**
     * Create payout for a booking using admin-configured settings
     */
    static async createPayoutForBooking(bookingId, providerAmount, platformFee) {
        try {
            const booking = await Booking.findById(bookingId).populate('provider_id')

            if (!booking) {
                throw new Error('Booking not found')
            }

            const provider = booking.provider_id
            if (!provider.stripe_account_id) {
                throw new Error('Provider does not have a Stripe Connect account')
            }

            // Use admin-configured payout settings
            const config = booking.admin_payout_config
            let scheduledDate = null

            if (config.payout_method === 'manual') {
                // Manual payouts don't have a scheduled date
                scheduledDate = null
            } else if (config.payout_method === 'weekly' && config.weekly_payout_day) {
                // Calculate next weekly payout date
                scheduledDate = this.getNextWeeklyDate(config.weekly_payout_day)
            } else if (config.payout_method === 'disbursement_day' && config.disbursement_days) {
                // Calculate disbursement date
                scheduledDate = new Date()
                scheduledDate.setDate(scheduledDate.getDate() + config.disbursement_days)
            }

            const payout = new Payout({
                booking_id: bookingId,
                provider_id: booking.provider_id._id,
                total_amount: booking.price,
                provider_amount: providerAmount,
                platform_fee: platformFee,
                stripe_account_id: provider.stripe_account_id,
                payout_type: config.payout_method,
                disbursement_days: config.disbursement_days,
                scheduled_date: scheduledDate
            })

            await payout.save()

            // Update booking with payout tracking
            await Booking.findByIdAndUpdate(bookingId, {
                payout_status: 'pending',
                amount_due_to_provider: providerAmount,
                platform_fee: platformFee,
                payout_id: payout._id
            })

            return payout
        } catch (error) {
            console.error('Error creating payout for booking:', error)
            throw error
        }
    }

    /**
     * Calculate next weekly payout date
     */
    static getNextWeeklyDate(dayOfWeek) {
        const now = new Date()
        const currentDay = now.getDay() // 0 = Sunday, 1 = Monday, etc.
        const targetDay = dayOfWeek === 7 ? 0 : dayOfWeek // Convert 7 (Sunday) to 0

        let daysUntilTarget = targetDay - currentDay
        if (daysUntilTarget <= 0) {
            daysUntilTarget += 7 // Next week if today or past
        }

        const nextDate = new Date(now)
        nextDate.setDate(now.getDate() + daysUntilTarget)
        nextDate.setHours(0, 0, 0, 0) // Start of day

        return nextDate
    }

    /**
     * Get account balance for a connected account
     */
    static async getAccountBalance(accountId) {
        try {
            const balance = await stripe.balance.retrieve({
                stripeAccount: accountId
            })

            return balance
        } catch (error) {
            console.error('Error retrieving account balance:', error)
            throw error
        }
    }

    /**
     * Create login link for provider dashboard
     */
    static async createLoginLink(accountId) {
        try {
            const loginLink = await stripe.accounts.createLoginLink(accountId)
            return loginLink
        } catch (error) {
            console.error('Error creating login link:', error)
            throw error
        }
    }

    /**
     * Update connected account
     */
    static async updateAccount(accountId, updateData) {
        try {
            const account = await stripe.accounts.update(accountId, updateData)
            return account
        } catch (error) {
            console.error('Error updating account:', error)
            throw error
        }
    }

    /**
     * Get transfer details
     */
    static async getTransfer(transferId) {
        try {
            const transfer = await stripe.transfers.retrieve(transferId)
            return transfer
        } catch (error) {
            console.error('Error retrieving transfer:', error)
            throw error
        }
    }

    /**
     * List transfers for a connected account
     */
    static async listTransfers(accountId, options = {}) {
        try {
            const transfers = await stripe.transfers.list({
                destination: accountId,
                ...options
            })

            return transfers
        } catch (error) {
            console.error('Error listing transfers:', error)
            throw error
        }
    }
}

module.exports = StripeConnectService
