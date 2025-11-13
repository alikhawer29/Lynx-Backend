const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Booking = require('../models/booking.model');
const Payment = require('../models/payment.model');
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

        // Auto-assign slot_id if not provided but session_date and session_time are provided
        if (!payload.slot_id && payload.session_date && payload.session_time) {
            const Slot = require('../models/slot.model');

            // Get day of week from session_date
            const sessionDate = new Date(payload.session_date);
            const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
            const dayOfWeek = daysOfWeek[sessionDate.getDay()];

            // Parse session time (e.g., "13:00" -> 13)
            const sessionHour = parseInt(payload.session_time.split(':')[0]);
            const sessionMinute = parseInt(payload.session_time.split(':')[1] || '0');

            // Find slot that contains this time
            const slots = await Slot.find({
                day: dayOfWeek,
                is_active: true,
                deleted: false
            });

            // Find matching slot where session_time falls within start_time and end_time
            const matchingSlot = slots.find(slot => {
                const startHour = parseInt(slot.start_time.split(':')[0]);
                const startMinute = parseInt(slot.start_time.split(':')[1] || '0');
                const endHour = parseInt(slot.end_time.split(':')[0]);
                const endMinute = parseInt(slot.end_time.split(':')[1] || '0');

                const sessionTotalMinutes = sessionHour * 60 + sessionMinute;
                const startTotalMinutes = startHour * 60 + startMinute;
                const endTotalMinutes = endHour * 60 + endMinute;

                return sessionTotalMinutes >= startTotalMinutes && sessionTotalMinutes < endTotalMinutes;
            });

            if (matchingSlot) {
                payload.slot_id = matchingSlot._id;
                console.log(`Auto-assigned slot_id: ${matchingSlot._id} for ${dayOfWeek} ${payload.session_time}`);
            } else {
                console.log(`Warning: No matching slot found for ${dayOfWeek} ${payload.session_time}`);
            }
        }

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
                { path: "user_id", select: "first_name last_name email picture certifications" },
                { path: "service_id", select: "name price image" },
                { path: "category_id", select: "name" },
                { path: "provider_id", select: "first_name last_name email picture certifications" },
                { path: "slot_id", select: "start_time end_time" },
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


// ============================
// Assign Provider to Booking (Admin Only)
// ============================
const assignProvider = async (req, res) => {
    try {
        const { id } = req.params;
        const { provider_id } = req.body;

        if (!provider_id) {
            throw new Error('Provider ID is required');
        }

        // Find booking
        const booking = await Booking.findById(id);
        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if booking is paid
        if (booking.payment_status !== 'paid') {
            throw new Error('Cannot assign provider to unpaid booking');
        }

        // Verify provider exists and has PROVIDER role
        const provider = await User.findById(provider_id);
        if (!provider) {
            throw new Error('Provider not found');
        }

        if (provider.role !== ROLES.PROVIDER) {
            throw new Error('Selected user is not a provider');
        }

        // Assign provider and update status
        booking.provider_id = provider_id;
        booking.status = 'approved';
        booking.booking_status = 'upcoming';

        await booking.save();

        await booking.populate([
            { path: 'user_id', select: 'first_name last_name email phone_number picture certifications' },
            { path: 'service_id', select: 'name price image' },
            { path: 'provider_id', select: 'first_name last_name email phone_number picture certifications' },
            { path: 'slot_id' },
        ]);

        return res.status(200).send({
            success: true,
            message: 'Provider assigned successfully',
            data: booking,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get Appointment Requests (Pending Bookings - Admin)
// ============================
const getAppointmentRequests = async (req, res) => {
    try {
        const { query } = req;
        const { page, per_page, search, from, to, sortBy } = query;

        const options = paginationHandler(page, per_page);
        let filter = {
            payment_status: 'paid',
            status: 'pending', // Only pending bookings
        };
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
            {
                $lookup: {
                    from: "slots",
                    localField: "slot_id",
                    foreignField: "_id",
                    as: "slot",
                },
            },
            { $unwind: { path: "$slot", preserveNullAndEmptyArrays: true } },
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
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Get Appointment Management (Approved/Assigned Bookings - Admin)
// ============================
const getAppointmentManagement = async (req, res) => {
    try {
        const { query } = req;
        const { page, per_page, search, from, to, sortBy, booking_status } = query;

        const options = paginationHandler(page, per_page);
        let filter = {
            payment_status: 'paid',
            status: 'approved', // Only approved bookings
        };
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

        if (booking_status) {
            filter.booking_status = booking_status; // upcoming, in_progress, completed
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
            {
                $lookup: {
                    from: "users",
                    localField: "provider_id",
                    foreignField: "_id",
                    as: "provider",
                },
            },
            { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "slots",
                    localField: "slot_id",
                    foreignField: "_id",
                    as: "slot",
                },
            },
            { $unwind: { path: "$slot", preserveNullAndEmptyArrays: true } },
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
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Reject Booking (Admin Only)
// ============================
const rejectBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        const booking = await Booking.findById(id);
        if (!booking) {
            throw new Error('Booking not found');
        }

        booking.status = 'rejected';
        if (rejection_reason) {
            booking.notes = rejection_reason;
        }

        await booking.save();

        return res.status(200).send({
            success: true,
            message: 'Booking rejected successfully',
            data: booking,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return res.status(400).send({
            success: false,
            message: e.message,
        });
    }
};


// ============================
// Cancel Booking with Refund
// ============================
const cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { decoded } = req;
        const { cancellation_reason } = req.body;

        // Find the booking
        const booking = await Booking.findById(id)
            .populate('user_id', 'first_name last_name email stripe_customer_id')
            .populate('provider_id', 'first_name last_name email');

        if (!booking) {
            throw new Error('Booking not found');
        }

        // Check if user owns this booking or is admin
        if (booking.user_id._id.toString() !== decoded.id && decoded.role !== 'admin') {
            throw new Error('Unauthorized to cancel this booking');
        }

        // Check if booking can be cancelled
        if (booking.status === 'cancelled' || booking.status === 'refunded') {
            throw new Error('Booking is already cancelled');
        }

        if (booking.status === 'completed') {
            throw new Error('Cannot cancel a completed booking');
        }

        // Check if payment exists and was paid
        if (!booking.payment_id) {
            throw new Error('No payment found for this booking');
        }

        const payment = await Payment.findById(booking.payment_id);

        if (!payment) {
            throw new Error('Payment record not found');
        }

        if (payment.payment_status !== 'succeeded') {
            throw new Error('Cannot refund unpaid booking');
        }

        // Calculate time difference between now and session date+time
        const sessionDateTime = new Date(`${booking.session_date.toISOString().split('T')[0]}T${booking.session_time}:00`);
        const now = new Date();
        const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);

        let refundAmount = 0;
        let providerCompensation = 0;
        let refundType = 'none';
        let refundPolicy = '';

        // Case 1: Less than 24 hours before event - 50% refund
        if (hoursUntilSession < 24 && hoursUntilSession > 0) {
            refundAmount = booking.price * 0.5;
            providerCompensation = booking.price * 0.5;
            refundType = 'partial';
            refundPolicy = 'Less than 24 hours before session - 50% refund to user, 50% to provider';
        }
        // Case 2: More than 24 hours but less than 7 days - 100% refund
        else if (hoursUntilSession >= 24 && hoursUntilSession < (7 * 24)) {
            refundAmount = booking.price;
            providerCompensation = 0;
            refundType = 'full';
            refundPolicy = 'More than 24 hours before session - 100% refund to user';
        }
        // Case 3: More than 7 days - 100% refund
        else if (hoursUntilSession >= (7 * 24)) {
            refundAmount = booking.price;
            providerCompensation = 0;
            refundType = 'full';
            refundPolicy = 'More than 7 days before session - 100% refund to user';
        }
        // Case 4: Session already passed
        else {
            throw new Error('Cannot cancel booking - session time has already passed');
        }

        // Process refund through Stripe
        const { createRefund, transferToAdmin } = require('../helpers/stripe');

        let stripeRefund = null;
        if (refundAmount > 0) {
            // Stripe only accepts: 'duplicate', 'fraudulent', or 'requested_by_customer'
            stripeRefund = await createRefund(
                payment.stripe_payment_intent_id,
                refundAmount,
                'requested_by_customer'  // Always use this for user cancellations
            );
        }

        // Update payment record
        payment.payment_status = 'refunded';
        payment.refund_amount = refundAmount;
        payment.refund_status = refundType;
        payment.stripe_refund_id = stripeRefund?.id || null;
        payment.refund_reason = cancellation_reason || 'User requested cancellation';
        payment.refunded_at = new Date();
        payment.provider_compensation_amount = providerCompensation;
        payment.provider_compensation_status = providerCompensation > 0 ? 'pending' : 'none';
        await payment.save();

        // Update booking status
        booking.status = 'cancelled';
        booking.payment_status = 'refunded';
        booking.notes = `Cancelled: ${cancellation_reason || 'User requested cancellation'}. ${refundPolicy}`;
        await booking.save();

        // If provider compensation exists, transfer to admin account
        if (providerCompensation > 0) {
            await transferToAdmin(
                providerCompensation,
                `Provider compensation for cancelled booking ${booking.booking_id}`
            );
        }

        // Send notifications
        const { sendNotification } = require('../helpers/notification');

        // Notify user
        sendNotification(
            {
                title: "Booking Cancelled",
                body: `Your booking has been cancelled. Refund amount: $${refundAmount.toFixed(2)}`,
                data: {
                    type: "booking_cancelled",
                    booking_id: booking._id.toString(),
                    refund_amount: refundAmount
                }
            },
            booking.user_id._id,
            false
        );

        // Notify provider if assigned
        if (booking.provider_id) {
            sendNotification(
                {
                    title: "Booking Cancelled",
                    body: `Booking ${booking.booking_id} has been cancelled${providerCompensation > 0 ? `. Compensation: $${providerCompensation.toFixed(2)}` : ''}`,
                    data: {
                        type: "booking_cancelled",
                        booking_id: booking._id.toString(),
                        compensation: providerCompensation
                    }
                },
                booking.provider_id._id,
                false
            );
        }

        return res.status(200).send({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                booking_id: booking._id,
                booking_number: booking.booking_id,
                status: booking.status,
                refund_policy: refundPolicy,
                refund_amount: refundAmount,
                refund_type: refundType,
                provider_compensation: providerCompensation,
                hours_until_session: hoursUntilSession.toFixed(2),
                stripe_refund_id: stripeRefund?.id || null,
            },
        });

    } catch (e) {
        console.log('Error Message :: ', e);
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
    assignProvider,
    getAppointmentRequests,
    getAppointmentManagement,
    rejectBooking,
    cancelBooking,
};
