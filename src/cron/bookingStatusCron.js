const cron = require('node-cron');
const Booking = require('../models/booking.model');
const Slot = require('../models/slot.model');

/**
 * Cron Job: Update Booking Status Based on Date/Time
 * 
 * Logic:
 * 1. If booking is approved and session_date + session_time has started → booking_status = 'in_progress'
 * 2. If booking is in_progress and session has ended (after 1 hour) → booking_status = 'completed', status = 'completed'
 * 
 * Runs every 5 minutes
 */

const updateBookingStatuses = async () => {
    try {
        const now = new Date();
        console.log(`[CRON] Running booking status update at ${now.toISOString()}`);

        // Find all approved bookings that are not past
        const bookings = await Booking.find({
            status: { $in: ['approved', 'rescheduled'] },
            booking_status: { $ne: 'past' },
            deleted: false,
        }).populate('slot_id');

        let updatedToInProgress = 0;
        let updatedToPast = 0;

        for (const booking of bookings) {
            try {
                // Check if slot_id exists
                if (!booking.slot_id) {
                    console.error(`[CRON] ❌ Booking ${booking.booking_id} has no slot_id`);
                    continue;
                }

                // Get slot start and end times
                const slotStartTime = booking.slot_id.start_time; // e.g., "09:00"
                const slotEndTime = booking.slot_id.end_time;     // e.g., "10:00"

                // Parse session date
                const sessionDate = new Date(booking.session_date);

                // Create session start datetime using slot start_time
                const [startHours, startMinutes] = slotStartTime.split(':').map(Number);
                const sessionStart = new Date(sessionDate);
                sessionStart.setHours(startHours, startMinutes, 0, 0);

                // Create session end datetime using slot end_time
                const [endHours, endMinutes] = slotEndTime.split(':').map(Number);
                const sessionEnd = new Date(sessionDate);
                sessionEnd.setHours(endHours, endMinutes, 0, 0);

                console.log(`[CRON] Booking ${booking.booking_id}: Start=${sessionStart.toISOString()}, End=${sessionEnd.toISOString()}, Now=${now.toISOString()}, Status=${booking.booking_status}`);

                // Check if session has started
                if (now >= sessionStart && now < sessionEnd && booking.booking_status === 'upcoming') {
                    booking.booking_status = 'in_progress';
                    await booking.save();
                    updatedToInProgress++;
                    console.log(`[CRON] ✅ Booking ${booking.booking_id} → in_progress`);
                }

                // Check if session has ended
                if (now >= sessionEnd && booking.booking_status === 'in_progress') {
                    booking.booking_status = 'past';
                    booking.status = 'completed';
                    await booking.save();
                    updatedToPast++;
                    console.log(`[CRON] ✅ Booking ${booking.booking_id} → past (completed)`);
                }

            } catch (error) {
                console.error(`[CRON] ❌ Error updating booking ${booking.booking_id}:`, error.message);
            }
        }

        console.log(`[CRON] Summary: ${updatedToInProgress} → in_progress, ${updatedToPast} → past`);

    } catch (error) {
        console.error('[CRON] ❌ Error in booking status cron job:', error);
    }
};

/**
 * Start the cron job
 */
const startBookingStatusCron = () => {
    // Run every 5 minutes
    cron.schedule('* * * * *', updateBookingStatuses);

    console.log('✅ Booking status cron job started (runs every 5 minutes)');

    // Run immediately on startup
    updateBookingStatuses();
};

module.exports = {
    startBookingStatusCron,
    updateBookingStatuses, // Export for manual testing
};

