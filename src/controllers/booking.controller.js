const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../models/booking.model');
const User = require('../models/user.model');
const {
    ERRORS,
    objectValidator,
    paginationHandler,
    getSearchQuery,
    getDateRangeQuery,
    ROLES,
    normalize
} = require('../utils');
const getNextSequence = require('../helpers/getNextSequence');

dotenv.config();

// ============================
// Create Booking
// ============================
const createBooking = async (req, res) => {
    try {
        let { body, decoded } = req;

        // Validate required fields
        const validate = objectValidator(body);
        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD);
        }

        // Auto-generate unique booking ID
        const nextId = await getNextSequence('booking'); // will return 1001, 1002, etc.

        const payload = {
            ...body,
            booking_id: nextId,
            user_id: decoded.id,
        };

        const booking = new Booking(payload);
        await booking.save();

        return res.status(200).send({
            success: true,
            message: "Booking Successfully Created",
            data: booking,
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get All Bookings (with filters)
// ============================
const getBookings = async (req, res) => {
    try {
        const { decoded, query } = req;
        const { page, per_page, search, from, to, sortBy, status } = query;

        const options = paginationHandler(page, per_page);
        // let filter = {payment_status: 'paid'};
        let filter = {}; // ✅ Always get only paid bookings
        let sort = { createdAt: -1 };

        // Filtering
        if (search) {
            filter = {
                ...filter,
                $or: [
                    { 'contact_details.first_name': getSearchQuery(search) },
                    { 'contact_details.last_name': getSearchQuery(search) },
                    { booking_id: getSearchQuery(search) },
                ],
            };
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) };
        }

        if (status) {
            filter.status = status;
        }

        if (sortBy) {
            sort = { [sortBy]: 1 };
        }

        const pipeline = [
            { $match: filter },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user",
                },
            },
            { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "services",
                    localField: "service_id",
                    foreignField: "_id",
                    as: "service",
                },
            },
            { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
            { $sort: sort },
        ];

        if (options.skip) pipeline.push({ $skip: options.skip });
        if (options.limit) pipeline.push({ $limit: options.limit });

        const bookings = await Booking.aggregate(pipeline);
        const total = await Booking.countDocuments(filter);

        return res.status(200).send({
            success: true,
            total,
            data: bookings,
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get Single Booking by ID
// ============================
const getBookingById = async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await Booking.findById(id)
            .populate([
                { path: "user_id", select: "name email" },
                { path: "service_id", select: "name price" },
                { path: "category_id", select: "name" },
            ])
            .lean({ virtuals: true });

        if (!booking) {
            throw new Error(ERRORS.NOT_FOUND);
        }

        return res.status(200).send({
            success: true,
            data: booking,
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Update Booking
// ============================
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { body } = req;

        const booking = await Booking.findByIdAndUpdate(id, { $set: body }, { new: true });

        return res.status(200).send({
            success: true,
            message: "Booking Updated Successfully",
            data: booking,
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Delete Booking (Soft Delete)
// ============================
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id);

        if (!booking) {
            throw new Error(ERRORS.NOT_FOUND);
        }

        await booking.trash();

        return res.status(200).send({
            success: true,
            message: "Booking Deleted Successfully",
        });

    } catch (e) {
        console.log("Error Message :: ", e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


module.exports = {
    createBooking,
    getBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
};
