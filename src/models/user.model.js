const mongoose = require('mongoose')
const mongooseLeanVirtuals = require('mongoose-lean-virtuals')
const dotenv = require('dotenv')
const { encryptData } = require('../helpers/encryption')
const { ENUM_ROLES, ROLES, ENUM_AUTH_TYPES, AUTH_TYPES } = require('../utils')

dotenv.config()

const userSchema = mongoose.Schema({
    first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        unique: true,
        index: true,
        lowercase: true
    },
    password: {
        type: String,
        required: function () {
            return this.auth_provider === AUTH_TYPES.EMAIL
        }
    },
    language: {
        type: String,
        required: function () {
            return this.role === ROLES.USER
        }
    },
    picture: {
        type: String,
        default: "uploads/user/dummy.jpg"
    },
    country_code: {
        type: String,
        required: true
    },
    dialing_code: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    stripe_customer_id: {
        type: String,
    },
    favorite_services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    device_ids: [{
        type: String
    }],
    role: {
        type: String,
        enum: ENUM_ROLES,
        default: ROLES.USER
    },
    active: {
        type: Boolean,
        required: true,
        default: true
    },
    auth_provider: {
        type: String,
        enum: ENUM_AUTH_TYPES,
        default: AUTH_TYPES.EMAIL
    },
    provider_id: {
        type: String,
        required: function () {
            return this.auth_provider !== AUTH_TYPES.EMAIL
        }
    },

    // Provider-specific fields (for service providers)
    certifications: [{
        institution_name: {
            type: String,
            required: function () {
                return this.role === ROLES.PROVIDER && this.certifications && this.certifications.length > 0
            }
        },
        certificate_title: {
            type: String,
            required: function () {
                return this.role === ROLES.PROVIDER && this.certifications && this.certifications.length > 0
            }
        },
        certificate_picture: {
            type: String,
            required: function () {
                return this.role === ROLES.PROVIDER && this.certifications && this.certifications.length > 0
            }
        }
    }],

    // Provider verification status
    is_verified: {
        type: Boolean,
        default: false
    },

    reject_reason: {
        type: String,
        default: null
    },

    // Provider services (what services they can provide)
    provider_services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
})

userSchema.pre('save', (async function (next) {
    if (this.isModified('password')) {
        let encryptedPassword = await encryptData(this.password)
        this.password = encryptedPassword
    }

    return next()

}))

userSchema.pre('findOneAndUpdate', (async function (next) {
    if (this._update.password) {
        let encryptedPassword = await encryptData(this._update.password)
        this._update.password = encryptedPassword
    }

    return next()

}))

userSchema.index({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
userSchema.index({ location: '2dsphere' })


userSchema.virtual('image_url').get(function () {
    if (!this.picture) {
        return null
    }
    if (this.picture.startsWith('http')) {
        return this.picture
    }
    // Remove trailing slash from BASE_URL and add leading slash to path if needed
    const baseUrl = process.env.BASE_URL.replace(/\/$/, '')
    const path = this.picture.startsWith('/') ? this.picture : `/${this.picture}`
    return `${baseUrl}${path}`
})

userSchema.virtual('certifications_with_urls').get(function () {
    if (!this.certifications || this.certifications.length === 0) {
        return []
    }
    return this.certifications.map(cert => {
        let certificate_url = null
        if (cert.certificate_picture) {
            if (cert.certificate_picture.startsWith('http')) {
                certificate_url = cert.certificate_picture
            } else {
                // Remove trailing slash from BASE_URL and add leading slash to path if needed
                const baseUrl = process.env.BASE_URL.replace(/\/$/, '')
                const path = cert.certificate_picture.startsWith('/')
                    ? cert.certificate_picture
                    : `/${cert.certificate_picture}`
                certificate_url = `${baseUrl}${path}`
            }
        }
        return {
            institution_name: cert.institution_name,
            certificate_title: cert.certificate_title,
            certificate_picture: cert.certificate_picture,
            certificate_url
        }
    })
})

userSchema.plugin(mongooseLeanVirtuals)

module.exports = mongoose.model('User', userSchema)