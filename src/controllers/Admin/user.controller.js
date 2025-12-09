// user.controller.js
const mongoose = require('mongoose')
const User = require('../../models/user.model')
const Booking = require('../../models/booking.model')
const Payment = require('../../models/payment.model')
const Service = require('../../models/service.model')
const response = require('../../utils/response');

const {
    paginateResponse,
    paginationHandler,
    objectValidator,
    getSearchQuery,
    getDateRangeQuery,
    ERRORS,
    GENERAL_STATUS,
    normalize,
    ROLES,
} = require('../../utils')
const { sendStatusChangeNotification } = require('../../helpers/notification')
const { removeImage } = require('../../helpers/image');
const ResponseHandler = require('../../utils/response');

const getMyProfile = async (req, res) => {
    try {
        let { id } = req.decoded

        let projection = {
            password: 0,
            __v: 0
        }

        let user = await User.findById(id, projection).lean({ virtuals: true })

        let userData = {
            id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            country_code: user.country_code,
            dialing_code: user.dialing_code || '+971',
            role: user.role,
            picture: user.picture,
            image_url: user.image_url || `http://localhost:5000/uploads/user/dummy.jpg`
        };

        return ResponseHandler.success(res, "Profile", userData);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
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

        let userData = {
            id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            phone: user.phone,
            country_code: user.country_code,
            dialing_code: user.dialing_code || '+971',
            role: user.role,
            picture: user.picture,
            image_url: user.image_url || `http://localhost:5000/uploads/user/dummy.jpg`
        };

        return ResponseHandler.success(res, "User Successfully Updated", userData)

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
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

        return ResponseHandler.success(res, "Password reset successfully")

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

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

        return ResponseHandler.success(res, "Home Data", data);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
})

const getUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, role, search, from, to, sortBy, status, active, new_requests } = req.query;

        let { limit, skip } = paginationHandler(page, per_page);

        let filter = {};
        let sort = {};

        // Role filter - default to 'user' if not specified
        filter.role = role && role !== 'undefined' ? role : 'user';

        // Search filter
        if (search) {
            filter.$or = [
                { first_name: getSearchQuery(search) },
                { last_name: getSearchQuery(search) },
                { email: getSearchQuery(search) }
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

        // New requests filter (for providers)
        if (new_requests !== undefined) {
            filter.is_verified = new_requests === 'true' ? false : true;
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

        // Build projection - conditionally include interview field
        let projection = {
            first_name: 1,
            last_name: 1,
            status: 1,
            email: 1,
            createdAt: 1,
            active: 1,
            role: 1
        };

        // Add interview field if new_requests is provided
        if (new_requests == 'true') {
            projection.interview = 1;
        }

        // Fetch data
        let users = await User.find(filter, projection)
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean();

        // If new_requests is provided, ensure interview field is present (even if null)
        if (new_requests == 'true') {
            users = users.map(user => ({
                ...user,
                interview: user.interview || 'pending'
            }));
        }

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

        return ResponseHandler.success(res, "Users retrieved successfully", paginated);

    } catch (e) {
        console.error("Error in getUser:", e);
        return ResponseHandler.error(res, e.message || "Failed to fetch users", 500);
    }
};


const getUserById = async (req, res) => {
    try {
        const { decoded, params } = req
        let { id } = params

        // Use lean() with virtuals to include virtual fields
        let user = await User.findById(id)
            .select('-password')
            .lean({ virtuals: true })
            .exec()

        if (!user) {
            return ResponseHandler.error(res, "User not found", 404);
        }

        let role;
        if (user?.role === ROLES.PROVIDER) {
            role = 'Provider'
        } else {
            role = 'User'
        }

        // Check if user is a provider and has interview data
        if (user.role === ROLES.PROVIDER && user.interview) {
            const interview = user.interview;

            // Check if interview has date and time fields
            if (interview.date && interview.start_time && interview.end_time && interview.status === 'scheduled') {
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                // Parse interview date (remove time part for comparison)
                const interviewDate = new Date(interview.date);
                const interviewDateOnly = new Date(interviewDate.getFullYear(), interviewDate.getMonth(), interviewDate.getDate());

                // Parse time strings to hours and minutes
                const [startHour, startMinute] = interview.start_time.split(':').map(Number);
                const [endHour, endMinute] = interview.end_time.split(':').map(Number);

                // Create Date objects for start and end times
                const startTime = new Date(interviewDate);
                startTime.setHours(startHour, startMinute, 0, 0);

                const endTime = new Date(interviewDate);
                endTime.setHours(endHour, endMinute, 0, 0);

                // Check if today is the interview date
                const isToday = today.getTime() === interviewDateOnly.getTime();

                // Check if current time is within interview time window
                const isLive = isToday && now >= startTime && now <= endTime;

                // Add is_live flag to interview object
                user.interview.is_live = isLive;
            } else {
                // If interview doesn't have required fields or not scheduled, set is_live to false
                if (user.interview) {
                    user.interview.is_live = false;
                }
            }
        }

        // Create a clean response object with all URLs
        const response = {
            ...user,
            // Ensure URLs are included (they already are from virtuals)
            image_url: user.image_url || null,
            resume_url: user.resume_url || null,
            certifications_with_urls: user.certifications_with_urls || []
        };

        // If you want to remove the original fields and keep only URLs (optional):
        // const { picture, resume, certifications, ...rest } = user;
        // const response = {
        //     ...rest,
        //     image_url: user.image_url || null,
        //     resume_url: user.resume_url || null,
        //     certifications_with_urls: user.certifications_with_urls || []
        // };

        return ResponseHandler.success(res, role + " Details", response);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

const getUnassignedServices = async (req, res) => {
    try {
        // Get all active services - select only id and name
        const allServices = await Service.find({ active: true })
            .select('_id name')
            .lean();

        // Get all service IDs that are assigned to at least one provider
        const providers = await User.find({
            role: ROLES.PROVIDER,
            provider_services: { $exists: true, $ne: [] }
        }).select('provider_services');

        // Collect all assigned service IDs
        const assignedServiceIds = new Set();
        providers.forEach(provider => {
            provider.provider_services.forEach(serviceId => {
                assignedServiceIds.add(serviceId.toString());
            });
        });

        // Filter out services that are assigned to any provider
        const unassignedServices = allServices
            .filter(service => !assignedServiceIds.has(service._id.toString()))
            .map(service => ({
                id: service._id,
                name: service.name
            }));

        return ResponseHandler.success(res, "Unassigned Services", unassignedServices);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

const assignServiceToProvider = async (req, res) => {
    try {
        const { id } = req.params; // provider ID
        const { service_id } = req.body;

        // Validate service_id is provided
        if (!service_id) {
            throw new Error('Service ID is required');
        }

        // Validate service_id is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(service_id)) {
            throw new Error('Invalid Service ID');
        }

        // Check if service exists and is active
        const service = await Service.findOne({ _id: service_id, active: true });
        if (!service) {
            throw new Error(ERRORS.SERVICE_NOTEXIST);
        }

        // Find provider
        const provider = await User.findById(id);
        if (!provider) {
            throw new Error('Provider not found');
        }

        // Check if user is a provider
        if (provider.role !== ROLES.PROVIDER) {
            throw new Error('User is not a provider');
        }

        // Check if service is already assigned to this provider
        const isAlreadyAssigned = provider.provider_services.some(
            serviceId => serviceId.toString() === service_id
        );

        if (isAlreadyAssigned) {
            throw new Error('Service is already assigned to this provider');
        }

        // Add service to provider's services
        provider.provider_services.push(service_id);
        await provider.save();

        // Populate the provider_services to return full details
        await provider.populate('provider_services', 'name image description');

        return res.status(200).send({
            success: true,
            message: 'Service assigned successfully',
            data: {
                provider_id: provider._id,
                provider_name: `${provider.first_name} ${provider.last_name}`,
                provider_services: provider.provider_services
            }
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
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

        return ResponseHandler.success(res, `User ${newStatus ? 'activated' : 'deactivated'} successfully`, userData)

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}

// Admin - User Appointments
const getAppointmentsByUser = async (req, res) => {
    try {
        let { page = 1, per_page = 10, search, from, to, sortBy, status, price_type } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // User filter (parent/user appointments)
        filter.user_id = id;

        // Search filter - search by booking_id, price_type, or status
        if (search) {
            filter.$or = [
                { booking_id: getSearchQuery(search) },
                { price_type: getSearchQuery(search) },
                { status: getSearchQuery(search) }
            ];
        }

        // Status filter
        if (status) {
            filter.status = status;
        }

        // Price type filter
        if (price_type) {
            filter.price_type = price_type;
        }

        // Appointment date filter (session_date)
        if (from || to) {
            filter.session_date = getDateRangeQuery(from, to);
        }

        // Sorting - default to session_date
        let sort = sortBy ? { [sortBy]: -1 } : { session_date: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter, {
            booking_id: 1,
            session_date: 1,
            price_type: 1,
            price: 1,
            status: 1
        })
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

        return ResponseHandler.success(res, "User Appointments", paginated);
    } catch (e) {
        console.error("Error in getAppointmentsByUser:", e);
        return ResponseHandler.error(res, e.message || "Failed to fetch appointments", 500);
    }
};

// Admin - Provider Appointments
const getAppointmentsByProvider = async (req, res) => {
    try {
        let { page = 1, per_page = 10, search, from, to, sortBy, booking_status, price_type } = req.query;

        const { id } = req.params;

        let { limit, skip } = paginationHandler(page, per_page);

        // ---------------------------
        // BUILD FILTER PROPERLY
        // ---------------------------
        let filter = {};

        // Provider filter
        filter.provider_id = id;

        // Search filter - search by booking_id, price_type, or booking_status
        if (search) {
            filter.$or = [
                { booking_id: getSearchQuery(search) },
                { price_type: getSearchQuery(search) },
                { booking_status: getSearchQuery(search) }
            ];
        }

        // Booking status filter
        if (booking_status) {
            filter.booking_status = booking_status;
        }

        // Price type filter
        if (price_type) {
            filter.price_type = price_type;
        }

        // Appointment date filter (session_date)
        if (from || to) {
            filter.session_date = getDateRangeQuery(from, to);
        }

        // Sorting - default to session_date
        let sort = sortBy ? { [sortBy]: -1 } : { session_date: -1 };

        // ---------------------------
        // FETCH APPOINTMENTS
        // ---------------------------
        let appointments = await Booking.find(filter, {
            booking_id: 1,
            category_id: 1,
            session_date: 1,
            price_type: 1,
            price: 1,
            booking_status: 1
        })
            .populate('category_id', 'name')
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

        return ResponseHandler.success(res, "Provider Appointments", paginated);

    } catch (e) {
        console.error("Error in getAppointmentsByProvider:", e);
        return ResponseHandler.error(res, e.message || "Failed to fetch appointments", 500);
    }
};

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

        return ResponseHandler.success(res, "Interview scheduled successfully", {
            interview: {
                date: body.date, // Return original format
                start_time: user.interview.start_time,
                end_time: user.interview.end_time,
                description: user.interview.description,
                status: user.interview.status,
                scheduled_at: user.interview.scheduled_at
            }
        });

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
}


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



const verifyUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_verified, reject_reason, service_id, booking_category } = req.body;

        // Validate is_verified is boolean
        if (typeof is_verified !== "boolean") {
            return ResponseHandler.error(res, "is_verified must be boolean", 400);
        }

        const user = await User.findById(id);

        if (!user) {
            return ResponseHandler.error(res, "User not found", 404);
        }

        // If verification is false, reject_reason is required
        if (is_verified === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return ResponseHandler.error(res, "reject_reason is required when is_verified is false", 400);
            }
        }

        // If verification is true, service_id and booking_category are required
        if (is_verified === true) {
            if (!service_id || !Array.isArray(service_id) || service_id.length === 0) {
                return ResponseHandler.error(res, "service_id array is required when is_verified is true", 400);
            }

            if (!booking_category || !['normal', 'premium'].includes(booking_category)) {
                return ResponseHandler.error(res, "booking_category is required and must be 'normal' or 'premium'", 400);
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

        return ResponseHandler.success(res, message, {
            id: user._id,
            is_verified: user.is_verified,
            active: user.active,
            reject_reason: user.reject_reason || null,
            provider_services: user.provider_services || [],
            booking_category: user.booking_category || null
        });



    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

const upgradeAccount = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_approved, reject_reason } = req.body;

        // Validate is_approved is boolean
        if (typeof is_approved !== "boolean") {
            return ResponseHandler.error(res, "is_approved must be boolean", 400);
        }

        const user = await User.findById(id);

        if (!user) {
            return ResponseHandler.error(res, "User not found", 404);
        }

        // If approval is false, reject_reason is required
        if (is_approved === false) {
            if (!reject_reason || reject_reason.trim() === '') {
                return ResponseHandler.error(res, "reject_reason is required when is_approved is false", 400);
            }
        }

        // Update user's account approval status
        user.booking_category = is_approved ? 'premium' : 'normal';
        user.upgrade_reject_reason = reject_reason || null;
        await user.save();

        const message = is_approved
            ? "Account upgraded successfully"
            : "Account upgrade request rejected";

        return ResponseHandler.success(res, message, {
            id: user._id,
            booking_category: user.booking_category,
            reject_reason: user.upgrade_reject_reason || null
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return ResponseHandler.error(res, e.message, 400);
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
    upgradeAccount,
    getUnassignedServices,
    assignServiceToProvider
}