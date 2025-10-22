const mongoose = require('mongoose')
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')
const { ENUM_CONTENT_TYPES, ENUM_MEDIA_TYPES, MEDIA_TYPES } = require('../utils')

dotenv.config()

const contentSchema = mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ENUM_CONTENT_TYPES
    },
    title: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    media: {
        type: String,
        required: true,
    },
    media_type: {
        type: String,
        required: true,
        enum: ENUM_MEDIA_TYPES
    },
    media_thumbnail: {
        type: String,
        required: function () {
            return this.media_type === MEDIA_TYPES.VIDEO
        }
    },
    active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

contentSchema.virtual('media_url').get(function () {
    if (this.media && this.media.startsWith('http')) {
        return this.media
    }
    return `${process.env.BASE_URL}${this.media}`
})

contentSchema.virtual('media_thumbnail_url').get(function () {
    if (this.media_thumbnail && this.media_thumbnail.startsWith('http')) {
        return this.media_thumbnail
    }
    return `${process.env.BASE_URL}${this.media_thumbnail}`
})

contentSchema.plugin(mongooseLeanVirtuals)

module.exports = mongoose.model('Content', contentSchema)
