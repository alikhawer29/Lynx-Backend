const mongoose = require('mongoose')

const notificationSchema = mongoose.Schema({
    notification: {
        type: Object,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    recipients: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    for_all: {
        type: Boolean,
        default: false
    },
}, { timestamps: true })

module.exports = mongoose.model('Notification', notificationSchema)