const User = require('../models/user.model')
const Conversation = require('../models/conversation.model')
const {
    paginationHandler,
    objectValidator,
    getSearchQuery,
    getDateRangeQuery,
    ERRORS,
    GENERAL_STATUS,
} = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendNotification } = require('../helpers/notification')
const { removeImage } = require('../helpers/image')

const completeProfile = (async (req, res) => {
    try {

        let { decoded, body } = req

        let user = await User.findById(decoded.id)

        if (!user) {
            throw new Error("Invalid User")
        }

        if (user?.details) {
            throw new Error("Profile already completed")
        }

        let payload = {
            ...body,
            user: decoded.id
        }

        user.details = details._id
        await user.save()

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getUser = (async (req, res) => {
    try {

        let { page, per_page, role, search, from, to, sortBy, status, active } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}

        if (role && role !== 'undefined') {
            filter = {
                ...filter,
                role
            }
        }

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (status) {

            if (status === GENERAL_STATUS.PENDING) {
                filter = {
                    ...filter,
                    status,
                    details: {
                        $exists: true
                    }
                }
            } else {
                filter = { ...filter, status }
            }

        }

        if (req?.query?.hasOwnProperty("active") && active != null) {
            filter.active = active
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: -1 }
        }

        let projection = {
            password: 0
        }

        let users = await User.find(filter, projection, options).populate({ path: "manager", select: "name email company_name" }).sort(sort).lean()

        let total = await User.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: users
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getUserById = (async (req, res) => {
    try {

        const { decoded, params } = req
        let { id } = params

        let user = await User.findById(id).lean()

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const updateUser = (async (req, res) => {
    try {

        let { decoded, body, file } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        if (body?.role || body?.email || body?.password) {
            throw new Error("Email or Password is not allowed to be edit")
        }

        let payload = { ...body }

        if (file) {
            let user = await User.findById(decoded.id)
            if (!user?.picture?.includes("dummy")) {
                removeImage(user.picture)
            }
            payload.picture = file.path
        }

        let user = await User.findByIdAndUpdate(decoded.id, { $set: payload }, { new: true }).lean({ virtuals: true })

        let active_subscription = await getCurrentSubscription(user?._id)
        user.active_subscription = active_subscription

        // let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
        // user.conversation = conversation._id

        return res.status(200).send({
            success: true,
            message: "User Successfully Updated",
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const handleStatus = (async (req, res) => {
    try {

        let { body, params } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let update_payload = {}

        if (body?.status) {
            update_payload.status = body?.status
        }

        if (body?.hasOwnProperty("active")) {
            update_payload.active = body?.active
        }

        let user = await User.findByIdAndUpdate(params.id, { $set: update_payload }, { new: true }).lean()

        if (!body?.hasOwnProperty("active")) {
            if (user?.status === GENERAL_STATUS.APPROVED) {
                sendNotification({ title: "Profile Approved", body: "Your profile has been approved by admin" }, user?._id, false)
            } else if (user?.status === GENERAL_STATUS.REJECTED) {
                sendNotification({ title: "Profile Rejected", body: "Your profile has been rejected by admin" }, user?._id, false)
            }
        }

        return res.status(200).send({
            success: true,
            message: "User Successfully Updated",
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const deleteUser = (async (req, res) => {
    try {

        let { id } = req.decoded

        await User.findByIdAndDelete(id)

        return res.status(200).send({
            success: true,
            message: "User Successfully Deleted"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const changePassword = (async (req, res) => {
    try {

        let { id } = req.decoded
        let { current_password, new_password } = req.body

        if (!current_password || !new_password) {
            throw new Error("Current Password or New Password is not provided")
        }

        let user = await User.findById(id)

        let validPassword = await comparePassword(current_password, user.password)

        if (!validPassword) {
            throw new Error("Current Password doesn't match")
        }

        await User.findOneAndUpdate({ _id: id }, { password: new_password })

        return res.status(200).send({
            success: true,
            message: "Password reset successfully"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getMyProfile = (async (req, res) => {
    try {

        let { id } = req.decoded

        let projection = {
            password: 0,
            __v: 0
        }

        let user = await User.findById(id, projection).populate("manager").lean()

        let active_subscription = await getCurrentSubscription(user?._id)
        user.active_subscription = active_subscription

        let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
        user.conversation = conversation._id

        return res.status(200).send({
            success: true,
            data: user
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getHome = (async (req, res) => {
    try {

        let { id } = req.decoded

        let total_employees = await User.countDocuments({ manager: id })
        let active_employees = await User.countDocuments({ manager: id, active: true })

        let data = {
            total_employees,
            active_employees,
            completed_quiz: 0,
            pending_quiz: 0,
            latest_quiz: [],
        }

        return res.status(200).send({
            success: true,
            data
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const handleFavoriteServices = (async (req, res) => {
    try {

        return res.status(200).send({
            success: true,
            message: "Service Removed From Favorites"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFavoriteServices = (async (req, res) => {
    try {

        let { decoded, query } = req
        let { id } = decoded

        let user = await User.findById(id).populate({ path: "favorite_services", populate: "category" }).select("favorite_services")

        let services = (user?.favorite_services || []).map(item => {
            let service = item.toObject()
            service.is_favorite = true
            return service
        })

        if (query?.categories && query?.categories?.length > 0) {
            services = services.filter(service => query?.categories?.includes(service?.category?._id?.toString()))
        }

        if (query?.search && query?.search.trim() !== "") {
            const name = query.search.trim().toLowerCase()
            services = services.filter(item =>item?.name?.toLowerCase().includes(name))
        }

        return res.status(200).send({
            success: true,
            data: services || []
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const logout = (async (req, res) => {
    try {

        let { id } = req.decoded

        await User.findByIdAndUpdate(id, { $set: { device_ids: [] } })

        return res.status(200).send({
            success: true,
            message: "Logged Out"
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    completeProfile,
    getUser,
    getUserById,
    updateUser,
    deleteUser,
    changePassword,
    getMyProfile,
    getHome,
    handleFavoriteServices,
    getFavoriteServices,
    handleStatus,
    logout
}