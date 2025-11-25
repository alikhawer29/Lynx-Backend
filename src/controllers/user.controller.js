const User = require('../models/user.model')
const Booking = require('../models/booking.model')
const Payment = require('../models/payment.model')
const Conversation = require('../models/conversation.model')
const response = require('../utils/response');

const {
    paginateResponse,
    paginationHandler,
    objectValidator,
    getSearchQuery,
    getDateRangeQuery,
    ERRORS,
    GENERAL_STATUS,
    normalize,
} = require('../utils')
const { getCurrentSubscription } = require('../helpers/stripe')
const { sendNotification, sendStatusChangeNotification } = require('../helpers/notification')
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

// const getUser = async (req, res) => {
//     try {
//         let { page, per_page, role, search, from, to, sortBy, status, active } = req.query

//         let options = paginationHandler(page, per_page)

//         let filter = {}
//         let sort = {}

//         // Filter by role - if role is provided, use it; otherwise default to 'user'
//         if (role && role !== 'undefined') {
//             filter.role = role
//         } else {
//             // Default to showing only users with role 'user'
//             filter.role = 'user'
//         }

//         if (search) {
//             filter = { ...filter, name: getSearchQuery(search) }
//         }

//         if (status) {
//             if (status === GENERAL_STATUS.PENDING) {
//                 filter = {
//                     ...filter,
//                     status,
//                     details: { $exists: true }
//                 }
//             } else {
//                 filter = { ...filter, status }
//             }
//         }

//         if (req?.query?.hasOwnProperty("active") && active != null) {
//             filter.active = active
//         }

//         if (from || to) {
//             filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
//         }

//         if (sortBy) {
//             sort = { [sortBy]: -1 }
//         }

//         let projection = {
//             password: 0
//         }

//         let users = await User.find(filter, projection, options)
//             .sort(sort)
//             .lean()

//         let total = await User.countDocuments(filter)

//         return res.status(200).send({
//             success: true,
//             total,
//             data: users
//         })

//     } catch (e) {
//         console.log("Error Message :: ", e)
//         return res.status(400).send({
//             success: false,
//             message: e.message
//         })
//     }
// }

//Admin
const getUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active, new_requests } = req.query;

        let { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};

        // Role filter
        filter.role = role && role !== 'undefined' ? role : 'user';

        // Search filter
        // if (search) {
        //     filter = { ...filter, name: getSearchQuery(search) };
        // }

        if (search) {
            filter.$or = [
                { first_name: getSearchQuery(search) },
                { last_name: getSearchQuery(search) }
            ];
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter = {
                    ...filter,
                    status,
                    details: { $exists: true }
                };
            } else {
                filter = { ...filter, status };
            }
        }

        //for provider new requests
        if (new_requests) {
            filter.is_verified = new_requests === 'true' ? false : true
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active != null) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // Fetch data
        let users = await User.find(filter, { password: 0 })
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await User.countDocuments(filter);

        // Build base URL (same as Laravel)
        const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}${req.path}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: users
        });

        return res.json(response.success("User Listing", paginated));

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.json(response.error(e.message, 400, "User Listing"));
    }
};

//Admin
const getUserById = async (req, res) => {
    try {
        const { decoded, params } = req
        let { id } = params

        let user = await User.findById(id).select('-password').exec()

        res.json(response.success("User Details", user));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "User Details"));
    }
}

const verifyUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_verified, reject_reason, service_id, booking_category } = req.body;

        // Validate is_verified is boolean
        if (typeof is_verified !== "boolean") {
            return res.status(400).send({
                success: false,
                message: "is_verified must be boolean"
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // If verification is false, reject_reason is required
        if (is_verified === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return res.status(400).send({
                    success: false,
                    message: "reject_reason is required when is_verified is false"
                });
            }
        }

        // If verification is true, service_id and booking_category are required
        if (is_verified === true) {
            if (!service_id || !Array.isArray(service_id) || service_id.length === 0) {
                return res.status(400).send({
                    success: false,
                    message: "service_id array is required when is_verified is true"
                });
            }

            if (!booking_category || !['normal', 'premium'].includes(booking_category)) {
                return res.status(400).send({
                    success: false,
                    message: "booking_category is required and must be 'normal' or 'premium'"
                });
            }
        }

        // Update user verification status
        user.is_verified = is_verified;

        if (is_verified === false) {
            // Reject user
            user.reject_reason = reject_reason;
            user.active = false; // Deactivate rejected user
            user.provider_services = []; // Clear any previously assigned services
        } else {
            // Approve user
            user.reject_reason = null; // Clear rejection reason
            user.active = true; // Activate user
            user.provider_services = service_id; // Assign services to provider
            user.booking_category = booking_category; // Store booking category
        }

        await user.save();

        const message = is_verified
            ? "Provider approved successfully with assigned services"
            : "Provider rejected successfully";

        return res.json(response.success(message, {
            id: user._id,
            is_verified: user.is_verified,
            active: user.active,
            reject_reason: user.reject_reason || null,
            provider_services: user.provider_services || [],
            booking_category: user.booking_category || null
        }
        ));



    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};


const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params

        // Find user and toggle status in one operation
        const user = await User.findById(id)

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            })
        }

        const previousStatus = user.active
        const newStatus = !previousStatus

        // Toggle and save
        user.active = newStatus
        await user.save()

        // Send notification to user
        await sendStatusChangeNotification(user, newStatus, req.decoded)

        // Convert to object and remove password
        const userData = user.toObject()
        delete userData.password

        return res.status(200).send({
            success: true,
            message: `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            data: userData
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
}

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
            payload.picture = normalize(file.path)
        }

        let user = await User.findByIdAndUpdate(decoded.id, { $set: payload }, { new: true }).lean({ virtuals: true })

        // let active_subscription = await getCurrentSubscription(user?._id)
        // user.active_subscription = active_subscription

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

// Admin - User Appointments
const getAppointmentsByUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // User filter (parent/user appointments)
        filter.user_id = id;

        // Role filter
        if (role && role !== "undefined") {
            filter.role = role;
        }

        // Search filter
        if (search) {
            filter.name = getSearchQuery(search);
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter.status = status;
                filter.details = { $exists: true };
            } else {
                filter.status = status;
            }
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active !== undefined) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        let sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Booking.countDocuments(filter);

        // Base URL
        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: appointments
        });

        return res.json(response.success("User Appointments", paginated));

    } catch (e) {
        console.log("Error :: ", e);
        return res.json(response.error(e.message, 400, "User Appointments"));
    }
};

// Admin - Provider Appointments
const getAppointmentsByProvider = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // User filter (parent/user appointments)
        filter.provider_id = id;

        // Role filter
        if (role && role !== "undefined") {
            filter.role = role;
        }

        // Search filter
        if (search) {
            filter.name = getSearchQuery(search);
        }

        // Status filter
        if (status) {
            if (status === GENERAL_STATUS.PENDING) {
                filter.status = status;
                filter.details = { $exists: true };
            } else {
                filter.status = status;
            }
        }

        if (status) {
            // Always filter by main status first
            filter.status = GENERAL_STATUS.APPROVED;

            // If booking is approved, apply booking_status filter
            if (status === GENERAL_STATUS.APPROVED && booking_status) {
                if (
                    booking_status === BOOKING_TIME_STATUS.UPCOMING ||
                    booking_status === BOOKING_TIME_STATUS.IN_PROGRESS ||
                    booking_status === BOOKING_TIME_STATUS.PAST
                ) {
                    filter.booking_status = booking_status;
                }
            }
        }

        // Active filter
        if (req.query.hasOwnProperty("active") && active !== undefined) {
            filter.active = active;
        }

        // Date filter
        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        // Sorting
        let sort = sortBy ? { [sortBy]: -1 } : { createdAt: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        let total = await Booking.countDocuments(filter);

        // Base URL
        const baseUrl = `${req.protocol}://${req.get("host")}${req.originalUrl.split("?")[0]}`;

        let paginated = paginateResponse({
            page,
            per_page,
            total,
            baseUrl,
            data: appointments
        });

        return res.json(response.success("User Appointments", paginated));

    } catch (e) {
        console.log("Error :: ", e);
        return res.json(response.error(e.message, 400, "User Appointments"));
    }
};


//Admin
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

// const getMyProfile = (async (req, res) => {
//     try {

//         let { id } = req.decoded

//         let projection = {
//             password: 0,
//             __v: 0
//         }

//         let user = await User.findById(id, projection).populate("manager").lean()

//         let active_subscription = await getCurrentSubscription(user?._id)
//         user.active_subscription = active_subscription

//         let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
//         user.conversation = conversation._id

//         return res.status(200).send({
//             success: true,
//             data: user
//         })

//     } catch (e) {
//         console.log("Error Message :: ", e)
//         return res.status(400).send({
//             success: false,
//             message: e.message
//         })
//     }
// })

const getMyProfile = async (req, res) => {
    try {
        let { id } = req.decoded

        let projection = {
            password: 0,
            __v: 0
        }

        let user = await User.findById(id, projection).lean({ virtuals: true })

        // let active_subscription = await getCurrentSubscription(user?._id)
        // user.active_subscription = active_subscription

        let conversation = await Conversation.findOne({ participants: { $in: [user._id] } }).select("_id")
        user.conversation = conversation?._id || null

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
}

const getHome = (async (req, res) => {
    try {

        let { id } = req.decoded

        let total_users = await User.countDocuments({ role: 'user' })
        let total_providers = await User.countDocuments({ role: 'provider' })
        let new_bookings = await Booking.countDocuments({ status: GENERAL_STATUS.PENDING })
        let earningsData = await Payment.aggregate([
            {
                $match: {
                    payment_status: "succeeded",   // include only successful payments
                    deleted: false            // if you use soft delete
                }
            },
            {
                $group: {
                    _id: null,
                    total_earnings: { $sum: "$amount" }
                }
            }
        ]);

        let total_earnings = earningsData.length ? earningsData[0].total_earnings : 0;

        let data = {
            total_users,
            total_providers,
            new_bookings,
            total_earnings,
        }

        return res.json(response.success("Home Data", data));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "Home Data"));
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
            services = services.filter(item => item?.name?.toLowerCase().includes(name))
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

const scheduleInterview = async (req, res) => {
    try {
        let { body, params } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let user = await User.findById(params?.id)

        if (!user) {
            throw new Error("User not found")
        }

        console.log(user.interview, 'user.interview')

        // Check if interview already exists and is scheduled
        if (user.interview && user.interview.status === 'scheduled') {
            throw new Error("User already has a scheduled interview")
        }

        // Convert date string to Date object
        const [day, month, year] = body.date.split('-')
        const interviewDate = new Date(`${year}-${month}-${day}`)

        // Validate date
        if (isNaN(interviewDate.getTime())) {
            throw new Error("Invalid date format. Use DD-MM-YYYY")
        }

        // Validate time format
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        if (!timeRegex.test(body.start_time) || !timeRegex.test(body.end_time)) {
            throw new Error("Invalid time format. Use HH:MM (24-hour format)")
        }

        // Validate end time is after start time
        const startTime = new Date(`1970-01-01T${body.start_time}:00`)
        const endTime = new Date(`1970-01-01T${body.end_time}:00`)
        if (endTime <= startTime) {
            throw new Error("End time must be after start time")
        }

        // Create/Update interview object
        user.interview = {
            date: interviewDate,
            start_time: body.start_time,
            end_time: body.end_time,
            description: body.description,
            status: 'scheduled',
            scheduled_at: new Date(),
            updated_at: new Date()
        }

        await user.save()

        return res.json(response.success("Interview scheduled successfully", {
            interview: {
                date: body.date, // Return original format
                start_time: user.interview.start_time,
                end_time: user.interview.end_time,
                description: user.interview.description,
                status: user.interview.status,
                scheduled_at: user.interview.scheduled_at
            }
        }));

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.json(response.error(e.message, 400, "Schedule Interview"));
    }




}


const upgradeAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved, reject_reason } = req.body;

        // Validate is_approved is boolean
        if (typeof is_approved !== "boolean") {
            return res.status(400).send({
                success: false,
                message: "is_approved must be boolean"
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).send({
                success: false,
                message: "User not found"
            });
        }

        // If approval is false, reject_reason is required
        if (is_approved === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return res.status(400).send({
                    success: false,
                    message: "reject_reason is required when is_approved is false"
                });
            }
        }

        // Update user's account approval status
        user.booking_category = is_approved ? 'premium' : 'normal';
        user.upgrade_reject_reason = reject_reason || null;
        await user.save();

        const message = is_approved
            ? "Account upgraded successfully"
            : "Account upgrade request rejected";

        return res.json(response.success(message, {
            id: user._id,
            booking_category: user.booking_category,
            reject_reason: user.upgrade_reject_reason || null
        }
        ));

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message
        });
    }
};
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
    logout,
    updateUserStatus,
    getAppointmentsByUser,
    getAppointmentsByProvider,
    verifyUser,
    scheduleInterview,
    upgradeAccount
}