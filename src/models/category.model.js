const mongoose = require('mongoose')

const categorySchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        normal: {
            type: Number,
            required: true
        },
        premium: {
            type: Number,
            required: true
        }
    },
    active: {
        type: Boolean,
        default: true
    },
    deleted: {
        type: Boolean,
        default: false
    },
    deletedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true })

categorySchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

categorySchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

categorySchema.methods.trash = async function () {
    this.deleted = true
    this.deletedAt = new Date()
    await this.save()
}

categorySchema.methods.restore = async function () {
    this.deleted = false
    this.deletedAt = null
    await this.save()
}

module.exports = mongoose.model('Category', categorySchema)