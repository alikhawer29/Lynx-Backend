# Booking Status Cron Job Documentation 📅

## 🎯 Overview

Automatic cron job that updates booking statuses based on date and time.

---

## 🔄 What It Does

### **Automatic Status Updates:**

1. **Approved → In Progress**
   - When: Session date/time has started
   - Condition: `booking_status = 'upcoming'` AND current time >= session start time
   - Action: Set `booking_status = 'in_progress'`

2. **In Progress → Completed**
   - When: Session has ended (after 1 hour)
   - Condition: `booking_status = 'in_progress'` AND current time >= session end time
   - Action: Set `booking_status = 'completed'` AND `status = 'completed'`

---

## ⏰ Schedule

**Runs every 5 minutes**: `*/5 * * * *`

You can change the schedule in `src/cron/bookingStatusCron.js`:

```javascript
// Every 5 minutes (default)
cron.schedule('*/5 * * * *', updateBookingStatuses);

// Every 10 minutes
cron.schedule('*/10 * * * *', updateBookingStatuses);

// Every hour
cron.schedule('0 * * * *', updateBookingStatuses);

// Every day at midnight
cron.schedule('0 0 * * *', updateBookingStatuses);
```

### Cron Format:
```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Day of week (0-7, 0 and 7 are Sunday)
│ │ │ └───── Month (1-12)
│ │ └─────── Day of month (1-31)
│ └───────── Hour (0-23)
└─────────── Minute (0-59)
```

---

## 📊 Logic Flow

```
Cron runs every 5 minutes
    ↓
Find all approved/rescheduled bookings
    ↓
For each booking:
    ↓
Parse session_date + session_time
    ↓
Calculate session start & end (start + 1 hour)
    ↓
If now >= start AND now < end AND status = 'upcoming'
    → Set booking_status = 'in_progress'
    ↓
If now >= end AND status = 'in_progress'
    → Set booking_status = 'completed'
    → Set status = 'completed'
```

---

## 🔧 Configuration

### Session Duration

Default: **1 hour**

To change, edit `src/cron/bookingStatusCron.js`:

```javascript
// Current (1 hour)
const sessionEnd = new Date(sessionStart);
sessionEnd.setHours(sessionStart.getHours() + 1);

// Change to 2 hours
const sessionEnd = new Date(sessionStart);
sessionEnd.setHours(sessionStart.getHours() + 2);

// Change to 30 minutes
const sessionEnd = new Date(sessionStart);
sessionEnd.setMinutes(sessionStart.getMinutes() + 30);
```

---

## 📝 Console Logs

When the cron runs, you'll see:

```
[CRON] Running booking status update at 2024-01-15T10:00:00.000Z
[CRON] ✅ Booking BK-1234567890 → in_progress
[CRON] ✅ Booking BK-0987654321 → completed
[CRON] Summary: 2 → in_progress, 1 → completed
```

---

## 🧪 Manual Testing

You can manually trigger the cron job for testing:

```javascript
// In Node.js console or create a test route
const { updateBookingStatuses } = require('./src/cron/bookingStatusCron');

// Run manually
await updateBookingStatuses();
```

Or create a test endpoint (for development only):

```javascript
// In src/routes/booking.route.js
router.get('/test-cron', async (req, res) => {
    const { updateBookingStatuses } = require('../cron/bookingStatusCron');
    await updateBookingStatuses();
    res.send({ success: true, message: 'Cron job executed' });
});
```

---

## 📋 Example Scenarios

### Scenario 1: Booking Starts Now

**Booking:**
- `session_date`: 2024-01-15
- `session_time`: 10:00
- `booking_status`: upcoming
- `status`: approved

**Current Time:** 2024-01-15 10:05

**Result:**
```
✅ booking_status → 'in_progress'
```

---

### Scenario 2: Booking Ends

**Booking:**
- `session_date`: 2024-01-15
- `session_time`: 10:00
- `booking_status`: in_progress
- `status`: approved

**Current Time:** 2024-01-15 11:05 (1 hour + 5 minutes later)

**Result:**
```
✅ booking_status → 'completed'
✅ status → 'completed'
```

---

## 🚀 Startup

The cron job starts automatically when the server starts:

```javascript
// app.js
const { startBookingStatusCron } = require('./src/cron/bookingStatusCron');

const serverHandler = async () => {
    // ...
    startBookingStatusCron(); // ✅ Starts here
};
```

**Console output on startup:**
```
✅ Booking status cron job started (runs every 5 minutes)
[CRON] Running booking status update at 2024-01-15T10:00:00.000Z
```

---

## ⚠️ Important Notes

1. **Timezone**: Make sure your server timezone is correct
2. **Session Duration**: Default is 1 hour, adjust if needed
3. **Performance**: Runs every 5 minutes, adjust if you have many bookings
4. **Error Handling**: Errors are logged but don't stop the cron job

---

## 🐛 Troubleshooting

### Cron not running?

Check server logs:
```bash
tail -f server.log | grep CRON
```

### Bookings not updating?

1. Check booking has correct status:
   - `status`: 'approved' or 'rescheduled'
   - `booking_status`: 'upcoming' or 'in_progress'
   - `deleted`: false

2. Check session_date and session_time are valid

3. Run manual test to see errors

---

## 📚 Files

- **Cron Job**: `src/cron/bookingStatusCron.js`
- **Startup**: `app.js` (line 61)
- **Model**: `src/models/booking.model.js`

---

## ✅ Summary

- ✅ Runs every 5 minutes automatically
- ✅ Updates booking_status based on time
- ✅ Handles both start and end of sessions
- ✅ Logs all updates to console
- ✅ Error handling for individual bookings

