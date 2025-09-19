const mongoose = require("mongoose")
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')

dotenv.config()

const serviceSchema = mongoose.Schema({
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        index: true
    },
    image: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
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
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

serviceSchema.plugin(mongooseLeanVirtuals)

serviceSchema.pre(/^find/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

serviceSchema.pre(/^count/, function (next) {
    if (!this.getFilter().deleted) {
        this.where({ deleted: false })
    } else {
        delete this.getFilter().deleted
    }
    next()
})

serviceSchema.methods.trash = async function () {
    this.deleted = true
    this.deletedAt = new Date()
    await this.save()
}

serviceSchema.methods.restore = async function () {
    this.deleted = false
    this.deletedAt = null
    await this.save()
}

serviceSchema.virtual('image_url').get(function () {
    if (this.image && this.image.startsWith('http')) {
        return this.image
    }
    return `${process.env.BASE_URL}${this.image}`
})

module.exports = mongoose.model("Service", serviceSchema)
