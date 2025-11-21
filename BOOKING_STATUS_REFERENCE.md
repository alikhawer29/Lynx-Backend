# 📋 Booking Status Reference Guide

## ✅ **FINAL CONSISTENT STATUS VALUES**

### **1. Status (Overall Booking State)**
Controls the approval/rejection workflow:

```javascript
status: {
    type: String,
    enum: ["pending", "approved", "requested", "rejected", "cancelled"],
    default: "pending",
}
```

| Value | Description | Who Sets It |
|-------|-------------|-------------|
| `pending` | Booking created, awaiting admin approval | System (on create) |
| `requested` | User requested a specific provider | User |
| `approved` | Admin approved and assigned provider | Admin |
| `rejected` | Admin rejected the booking | Admin |
| `cancelled` | Booking cancelled by user/provider | User/Provider |

---

### **2. Booking Status (Time-Based State)**
Automatically managed by cron job based on session time:

```javascript
booking_status: {
    type: String,
    enum: ["upcoming", "in_progress", "past"],
    default: "upcoming",
}
```

| Value | Description | When Set |
|-------|-------------|----------|
| `upcoming` | Session hasn't started yet | Default (on create) |
| `in_progress` | Session is currently happening | Cron job (when session starts) |
| `past` | Session has ended | Cron job (when session ends) |

---

### **3. Payment Status**
Tracks payment state:

```javascript
payment_status: {
    type: String,
    enum: ["paid", "unpaid", "refunded"],
    default: "unpaid",
}
```

| Value | Description |
|-------|-------------|
| `unpaid` | Payment not completed |
| `paid` | Payment successful |
| `refunded` | Payment refunded (after cancellation) |

---

## 🔄 **Booking Workflow**

### **Step 1: User Creates Booking**
```
status: "pending"
booking_status: "upcoming"
payment_status: "unpaid"
```

### **Step 2: User Pays**
```
status: "pending"
booking_status: "upcoming"
payment_status: "paid" ✅
```

### **Step 3: Admin Approves & Assigns Provider**
```
status: "approved" ✅
booking_status: "upcoming"
payment_status: "paid"
```

### **Step 4: Session Starts (Cron Job)**
```
status: "approved"
booking_status: "in_progress" ✅
payment_status: "paid"
```

### **Step 5: Session Ends (Cron Job)**
```
status: "approved"
booking_status: "past" ✅
payment_status: "paid"
```

---

## 🚫 **Cancellation Workflow**

### **User/Provider Cancels Before Session**
```
status: "cancelled" ✅
booking_status: "upcoming"
payment_status: "refunded" ✅
```

---

## 📅 **Reschedule Workflow**

### **Admin Requests Reschedule**
```
status: "approved" (unchanged)
reschedule_requested: true ✅
reschedule_response: "pending" ✅
proposed_session_date: <new_date>
proposed_session_time: <new_time>
```

### **User Approves Reschedule**
```
status: "approved" (unchanged)
reschedule_requested: false ✅
reschedule_response: "approved" ✅
session_date: <updated>
session_time: <updated>
booking_status: "upcoming" (reset if needed)
```

### **User Rejects Reschedule**
```
status: "approved" (unchanged)
reschedule_requested: false ✅
reschedule_response: "rejected" ✅
reschedule_rejection_reason: <reason>
(Original date/time unchanged)
```

---

## 🎯 **Key Changes Made**

### **Removed Status Values:**
- ❌ `completed` (use `booking_status: "past"` instead)
- ❌ `refunded` (use `payment_status: "refunded"` instead)
- ❌ `rescheduled` (use `reschedule_requested` flag instead)
- ❌ `reschedule_pending` (use `reschedule_response: "pending"` instead)

### **Why These Changes?**
1. **Separation of Concerns**: `status` handles approval workflow, `booking_status` handles time-based state
2. **Clarity**: Each field has a single, clear purpose
3. **Consistency**: No overlapping or redundant status values
4. **Maintainability**: Easier to understand and debug

---

## 📊 **Status Constants (utils/index.js)**

```javascript
const BOOKING_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REQUESTED: "requested",
    REJECTED: "rejected",
    CANCELLED: "cancelled",
}

const BOOKING_TIME_STATUS = {
    UPCOMING: "upcoming",
    IN_PROGRESS: "in_progress",
    PAST: "past",
}
```

---

## ✅ **All Files Updated**

1. ✅ `src/models/booking.model.js` - Updated enums
2. ✅ `src/controllers/booking.controller.js` - Fixed all status checks
3. ✅ `src/cron/bookingStatusCron.js` - Updated cron logic
4. ✅ `src/helpers/bookingNotification.js` - Fixed notification data
5. ✅ `src/utils/index.js` - Updated constants
6. ✅ `src/controllers/review.controller.js` - Added admin notifications
7. ✅ `src/controllers/feedback.controller.js` - Added admin notifications
8. ✅ `src/controllers/report.controller.js` - Added admin notifications

---

**🎉 Your booking system now has consistent, clear status values across the entire project!**

