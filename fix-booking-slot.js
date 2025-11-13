/**
 * Script to fix booking slot_id
 * This will update the booking with booking_id "18" to have the correct slot_id
 */

const mongoose = require('mongoose');
require('dotenv').config();

const fixBookingSlot = async () => {
    try {
        const connectionString = process.env.DB_CONNECTION_STRING;
        const dbName = process.env.APP_NAME || 'lynx';

        console.log('Connecting to database:', dbName);
        await mongoose.connect(connectionString, {
            dbName,
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        const Booking = mongoose.model('Booking', require('./src/models/booking.model').schema);
        const Slot = mongoose.model('Slot', require('./src/models/slot.model').schema);

        // Find the booking with booking_id 18 (number)
        let booking = await Booking.findOne({ booking_id: 18 });

        // If not found, try as string
        if (!booking) {
            booking = await Booking.findOne({ booking_id: '18' });
        }

        // If still not found, try by _id
        if (!booking) {
            booking = await Booking.findById('691333e12520bb3b01cccfba');
        }

        if (!booking) {
            console.log('Booking not found. Searching all bookings...');
            const allBookings = await Booking.find({}).limit(5);
            console.log('Recent bookings:');
            allBookings.forEach(b => {
                console.log(`- ID: ${b._id}, booking_id: ${b.booking_id}, session_date: ${b.session_date}, session_time: ${b.session_time}`);
            });
            process.exit(1);
        }

        console.log('\n=== Current Booking ===');
        console.log('Booking ID:', booking.booking_id);
        console.log('Current slot_id:', booking.slot_id);
        console.log('Session Date:', booking.session_date);
        console.log('Session Time:', booking.session_time);
        console.log('Status:', booking.status);
        console.log('Payment Status:', booking.payment_status);

        // Get day of week from session_date
        const sessionDate = new Date(booking.session_date);
        const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayOfWeek = daysOfWeek[sessionDate.getDay()];

        console.log('\nDay of week:', dayOfWeek);

        // Find all slots for this day
        const slots = await Slot.find({
            day: dayOfWeek,
            is_active: true,
            deleted: false
        });

        console.log('\n=== Available Slots for', dayOfWeek, '===');
        slots.forEach(slot => {
            console.log(`- ${slot._id}: ${slot.start_time} - ${slot.end_time}`);
        });

        // Parse session time
        const sessionHour = parseInt(booking.session_time.split(':')[0]);
        const sessionMinute = parseInt(booking.session_time.split(':')[1] || '0');

        console.log('\nLooking for slot containing:', `${sessionHour}:${sessionMinute}`);

        // Find matching slot
        const matchingSlot = slots.find(slot => {
            const startHour = parseInt(slot.start_time.split(':')[0]);
            const startMinute = parseInt(slot.start_time.split(':')[1] || '0');
            const endHour = parseInt(slot.end_time.split(':')[0]);
            const endMinute = parseInt(slot.end_time.split(':')[1] || '0');

            const sessionTotalMinutes = sessionHour * 60 + sessionMinute;
            const startTotalMinutes = startHour * 60 + startMinute;
            const endTotalMinutes = endHour * 60 + endMinute;

            const matches = sessionTotalMinutes >= startTotalMinutes && sessionTotalMinutes < endTotalMinutes;

            if (matches) {
                console.log(`\n✓ Found match: ${slot._id} (${slot.start_time} - ${slot.end_time})`);
                console.log(`  Session ${sessionTotalMinutes} mins is between ${startTotalMinutes} and ${endTotalMinutes} mins`);
            }

            return matches;
        });

        if (matchingSlot) {
            console.log('\n=== Updating Booking ===');
            console.log('Old slot_id:', booking.slot_id);
            console.log('New slot_id:', matchingSlot._id);

            booking.slot_id = matchingSlot._id;
            await booking.save();

            console.log('\n✅ Booking updated successfully!');

            // Verify the update
            const updatedBooking = await Booking.findOne({ booking_id: '18' });
            console.log('\nVerification:');
            console.log('Updated slot_id:', updatedBooking.slot_id);
            console.log('Slot time range:', `${matchingSlot.start_time} - ${matchingSlot.end_time}`);
        } else {
            console.log('\n❌ No matching slot found for session time:', booking.session_time);
            console.log('Available slots:');
            slots.forEach(slot => {
                console.log(`  - ${slot.start_time} - ${slot.end_time}`);
            });
        }

        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

fixBookingSlot();

