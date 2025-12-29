const dotenv = require('dotenv');
const Slot = require('../../models/slot.model');
const Booking = require('../../models/booking.model');
const { ERRORS, objectValidator, paginationHandler, getDateRangeQuery } = require('../../utils');
const response = require('../../utils/response');
const ResponseHandler = require('../../utils/response');

dotenv.config();

// ============================
// Helper: Add booking info to slots
// ============================
const addBookingInfoToSlots = async (slots, service_id = null, date = null) => {
    const slotsWithBooking = await Promise.all(slots.map(async (slot) => {
        const slotObj = slot.toObject ? slot.toObject({ virtuals: true }) : slot;

        // Build query to find bookings for this slot
        let bookingQuery = {
            slot_id: slotObj._id,
            status: 'approved', // Only approved bookings count as "booked"
            payment_status: 'paid',
        };

        // If service_id is provided, filter by service
        if (service_id) {
            bookingQuery.service_id = service_id;
        }

        // If date is provided, filter by session_date
        if (date) {
            const targetDate = new Date(date);
            const nextDay = new Date(targetDate);
            nextDay.setDate(nextDay.getDate() + 1);

            bookingQuery.session_date = {
                $gte: targetDate,
                $lt: nextDay,
            };
        }

        // Find booking for this slot
        const booking = await Booking.findOne(bookingQuery)
            .populate('provider_id', 'first_name last_name')
            .lean();

        return {
            ...slotObj,
            is_booked: !!booking,
            booking_info: booking ? {
                booking_id: booking._id,
                provider: booking.provider_id,
                session_date: booking.session_date,
            } : null,
        };
    }));

    return slotsWithBooking;
};

// ============================
// Create Slots (Admin Only)
// Support multiple days and times
// ============================
const createSlot = async (req, res) => {
    try {
        let { body, decoded } = req;

        // Validate input
        const validate = objectValidator(body);
        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD);
        }

        const { slots } = body;

        if (!slots || typeof slots !== 'object' || Object.keys(slots).length === 0) {
            throw new Error('Slots object is required');
        }

        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$|^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

        const createdSlots = [];
        const errors = [];

        // Loop through each day (e.g., monday, tuesday, etc.)
        for (const [day, timeSlots] of Object.entries(slots)) {
            const dayLower = day.toLowerCase();

            // Validate day name
            if (!validDays.includes(dayLower)) {
                errors.push({ day: dayLower, error: `Invalid day: ${day}` });
                continue;
            }

            // Skip if no slots for the day
            if (!Array.isArray(timeSlots) || timeSlots.length === 0) continue;

            // Loop through each time slot
            for (let time of timeSlots) {
                try {
                    if (!time.start_time || !time.end_time) {
                        throw new Error('Each slot must have start_time and end_time');
                    }

                    // Validate time format
                    if (!timeRegex.test(time.start_time) || !timeRegex.test(time.end_time)) {
                        throw new Error(`Invalid time format: ${time.start_time} - ${time.end_time}`);
                    }

                    // Check for duplicate
                    const existingSlot = await Slot.findOne({
                        day: dayLower,
                        start_time: time.start_time,
                        end_time: time.end_time,
                        created_by: decoded.id,
                    });

                    if (existingSlot) {
                        errors.push({
                            day: dayLower,
                            time: `${time.start_time} - ${time.end_time}`,
                            error: 'Slot already exists',
                        });
                        continue;
                    }

                    // Save new slot
                    const payload = {
                        day: dayLower,
                        start_time: time.start_time,
                        end_time: time.end_time,
                        created_by: decoded.id,
                    };

                    const slot = new Slot(payload);
                    await slot.save();
                    createdSlots.push(slot);
                } catch (err) {
                    errors.push({
                        day: dayLower,
                        time: `${time.start_time || '?'} - ${time.end_time || '?'}`,
                        error: err.message,
                    });
                }
            }
        }

        // Populate created slots
        await Slot.populate(createdSlots, [
            { path: 'created_by', select: 'first_name last_name email' },
        ]);

        return ResponseHandler.success(res, `${createdSlots.length} slot(s) successfully created`, {
            created: createdSlots.length,
            failed: errors.length,
            slots: createdSlots,
            errors,
        });
    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


// ============================
// Get All Slots
// ============================
const getSlots = async (req, res) => {
    try {
        let { page, per_page, day, is_active, from, to, service_id, date } = req.query;

        let options = paginationHandler(page, per_page);

        let filter = {};
        let sort = { day: 1, start_time: 1 }; // Sort by day and time

        if (day) {
            filter.day = day.toLowerCase();
        }

        if (is_active !== undefined) {
            filter.is_active = is_active === 'true';
        }

        if (from || to) {
            filter.createdAt = getDateRangeQuery(from, to);
        }

        let slots = await Slot.find(filter, {}, options)
            // .populate({ path: 'created_by', select: 'first_name last_name email' })
            .sort(sort);

        // Add booking information to slots
        const slotsWithBooking = await addBookingInfoToSlots(slots, service_id, date);

        return ResponseHandler.success(res, "Slots retrieved successfully", slotsWithBooking);

    } catch (e) {
        console.log("Error Message :: ", e)
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Get Slots by Day
// ============================
const getSlotsByDay = async (req, res) => {
    try {
        let { day } = req.params;
        let { service_id, date } = req.query;

        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        if (!validDays.includes(day.toLowerCase())) {
            throw new Error('Invalid day');
        }

        let filter = {
            day: day.toLowerCase(),
            is_active: true,
        };

        let slots = await Slot.find(filter)
            .sort({ start_time: 1 });

        // Add booking information to slots
        const slotsWithBooking = await addBookingInfoToSlots(slots, service_id, date);

        return ResponseHandler.success(res, "Slots retrieved successfully", slotsWithBooking);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};


const getSlotsByDate = async (req, res) => {
    try {
        let { date } = req.params;
        let { service_id } = req.query;

        if (!date) {
            throw new Error('Date parameter is required');
        }

        // Parse date without timezone conversion
        const [year, month, day] = date.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);

        if (isNaN(targetDate.getTime())) {
            throw new Error('Invalid date format. Use YYYY-MM-DD');
        }

        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = daysOfWeek[targetDate.getDay()];

        let filter = {
            day: dayOfWeek,
            is_active: true,
        };

        let slots = await Slot.find(filter)
            .sort({ start_time: 1 });

        // Add booking information to slots for this specific date
        const slotsWithBooking = await addBookingInfoToSlots(slots, service_id, date);

        return ResponseHandler.success(res, "Slots retrieved successfully", {
            date: date,
            day: dayOfWeek,
            total: slotsWithBooking.length,
            data: slotsWithBooking,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Get Slot by ID
// ============================
const getSlotById = async (req, res) => {
    try {
        let { id } = req.params;

        let slot = await Slot.findById(id)
            .populate({ path: 'created_by', select: 'first_name last_name email' })
            .lean({ virtuals: true });

        if (!slot) {
            throw new Error('Slot not found');
        }

        return ResponseHandler.success(res, "Slot retrieved successfully", slot);

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Update Slot (Admin Only)
// ============================
const updateSlot = async (req, res) => {
    try {
        const { slots } = req.body;
        const { decoded } = req;

        if (!slots || typeof slots !== 'object' || Object.keys(slots).length === 0) {
            return ResponseHandler.error(res, 'Slots data is required', 400);
        }

        const validDays = [
            'monday', 'tuesday', 'wednesday',
            'thursday', 'friday', 'saturday', 'sunday'
        ];

        const timeRegex =
            /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$|^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

        const updatedSlots = [];
        const errors = [];

        // 🔁 Loop through all days
        for (const [day, times] of Object.entries(slots)) {
            if (!validDays.includes(day.toLowerCase())) {
                errors.push({ day, error: `Invalid day: ${day}` });
                continue;
            }

            // Support both array and single object for flexibility
            const timeArray = Array.isArray(times) ? times : [times];

            try {
                // 🗑️ Delete all existing slots for this day first
                await Slot.deleteMany({ day: day.toLowerCase() });

                // 🆕 Create new slots for this day
                for (const time of timeArray) {
                    const { start_time, end_time, is_active } = time;

                    if (!start_time || !end_time) {
                        errors.push({ day, error: 'start_time and end_time are required' });
                        continue;
                    }

                    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
                        errors.push({ day, error: `Invalid time format for ${start_time} - ${end_time}` });
                        continue;
                    }

                    const newSlot = await Slot.create({
                        day: day.toLowerCase(),
                        start_time,
                        end_time,
                        is_active: typeof is_active !== 'undefined' ? is_active : true,
                        created_by: decoded.id,
                    });
                    updatedSlots.push(newSlot);
                }
            } catch (err) {
                errors.push({ day, error: err.message });
            }
        }

        await Slot.populate(updatedSlots, { path: 'created_by', select: 'first_name last_name email' });

        return ResponseHandler.success(res, `${updatedSlots.length} slot(s) updated successfully`, {
            updated: updatedSlots.length,
            failed: errors.length,
            slots: updatedSlots,
            errors,
        });
    } catch (error) {
        console.error('Error Message ::', error);
        return ResponseHandler.error(res, error.message || 'Something went wrong', 500);
    }
};



// ============================
// Delete Slot (Admin Only)
// ============================
const deleteSlot = async (req, res) => {
    try {
        let { id } = req.params;

        const slot = await Slot.findById(id);

        if (!slot) {
            throw new Error('Slot not found');
        }

        // Soft delete
        await slot.trash();

        return ResponseHandler.success(res, 'Slot successfully deleted');

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};



// ============================
// Get Weekly Schedule
// ============================
const getWeeklySchedule = async (_req, res) => {
    try {
        let filter = {
            is_active: true,
        };

        let slots = await Slot.find(filter)
            .sort({ day: 1, start_time: 1 })
            .lean({ virtuals: true });

        // Group slots by day
        const weeklySchedule = {
            monday: [],
            tuesday: [],
            wednesday: [],
            thursday: [],
            friday: [],
            saturday: [],
            sunday: [],
        };

        slots.forEach(slot => {
            weeklySchedule[slot.day].push(slot);
        });

        return ResponseHandler.success(res, "Weekly schedule retrieved successfully", {
            total: slots.length,
            data: weeklySchedule,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

// ============================
// Toggle Slot Status (Admin Only)
// ============================
const toggleSlotStatus = async (req, res) => {
    try {
        let { id } = req.params;

        const slot = await Slot.findById(id);

        if (!slot) {
            throw new Error('Slot not found');
        }

        slot.is_active = !slot.is_active;

        await slot.save();

        return ResponseHandler.success(res, `Slot status toggled successfully`, {
            is_active: slot.is_active,
        });

    } catch (e) {
        console.log('Error Message :: ', e);
        return ResponseHandler.error(res, e.message, 400);
    }
};

module.exports = {
    createSlot,
    getSlots,
    getSlotsByDay,
    getSlotById,
    updateSlot,
    deleteSlot,
    getWeeklySchedule,
    toggleSlotStatus,
    getSlotsByDate
};

