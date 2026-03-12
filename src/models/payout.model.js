const mongoose = require('mongoose')
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')

dotenv.config()

const payoutSchema = new mongoose.Schema({
    // Reference to the booking this payout is for
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },

    // Provider who will receive the payout
    provider_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // Amount details
    total_amount: {
        type: Number,
        required: true
    },
    provider_amount: {
        type: Number,
        required: true
    },
    platform_fee: {
        type: Number,
        required: true
    },

    // Payout status
    status: {
        type: String,
        enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
        default: 'pending'
    },

    // Stripe details
    stripe_transfer_id: {
        type: String,
        default: null
    },
    stripe_account_id: {
        type: String,
        required: true
    },

    // Payout scheduling
    payout_type: {
        type: String,
        enum: ['manual', 'weekly', 'daily'],
        default: 'manual'
    },
    scheduled_date: {
        type: Date,
        default: null
    },
    processed_date: {
        type: Date,
        default: null
    },

    // Disbursement configuration
    disbursement_days: {
        type: Number,
        default: null  // Number of days after booking completion to process payout
    },

    // Error handling
    failure_reason: {
        type: String,
        default: null
    },
    retry_count: {
        type: Number,
        default: 0
    },
    last_retry_date: {
        type: Date,
        default: null
    },

    // Metadata
    notes: {
        type: String,
        default: null
    },

    // Soft delete
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

// Plugins
payoutSchema.plugin(mongooseLeanVirtuals)

// Pre hooks for queries
payoutSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

payoutSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

// Instance methods
payoutSchema.methods.trash = async function () {
    this.deleted = true
    this.deletedAt = new Date()
    await this.save()
}

payoutSchema.methods.restore = async function () {
    this.deleted = false
    this.deletedAt = null
    await this.save()
}

payoutSchema.methods.markAsPaid = async function (transferId) {
    this.status = 'paid'
    this.stripe_transfer_id = transferId
    this.processed_date = new Date()
    await this.save()
}

payoutSchema.methods.markAsFailed = async function (reason) {
    this.status = 'failed'
    this.failure_reason = reason
    this.retry_count += 1
    this.last_retry_date = new Date()
    await this.save()
}

// Virtuals
payoutSchema.virtual('is_overdue').get(function () {
    if (!this.scheduled_date || this.status !== 'pending') return false
    return new Date() > this.scheduled_date
})

payoutSchema.virtual('can_retry').get(function () {
    return this.status === 'failed' && this.retry_count < 3
})

module.exports = mongoose.model('Payout', payoutSchema)
