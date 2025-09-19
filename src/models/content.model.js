const mongoose = require('mongoose')
const { ENUM_CONTENT_TYPES } = require('../utils')

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
        type: String
    },
    media_type: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    }
}, { timestamps: true })

module.exports = mongoose.model('Content', contentSchema)