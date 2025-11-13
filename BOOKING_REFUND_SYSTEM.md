# Booking Cancellation & Refund System 💰

## Overview

This system handles booking cancellations with automatic refund calculations based on how far in advance the user cancels.

---

## Refund Policy

### Case 1: Cancellation **Less than 24 hours** before session

- **User Refund:** 50% of booking price
- **Provider Compensation:** 50% of booking price (sent to admin account)
- **Reason:** Late cancellation - provider loses opportunity to book another client

**Example:**

```
Booking Price: $100
Session Time: 2025-11-15 14:00
Cancellation Time: 2025-11-15 10:00 (4 hours before)

→ User gets: $50 refund to their Stripe account
→ Admin gets: $50 (provider compensation)
```

### Case 2: Cancellation **24 hours to 7 days** before session

- **User Refund:** 100% of booking price
- **Provider Compensation:** $0
- **Reason:** Reasonable notice given

**Example:**

```
Booking Price: $100
Session Time: 2025-11-15 14:00
Cancellation Time: 2025-11-12 10:00 (3 days before)

→ User gets: $100 refund to their Stripe account
→ Admin gets: $0
```

### Case 3: Cancellation **More than 7 days** before session

- **User Refund:** 100% of booking price
- **Provider Compensation:** $0
- **Reason:** Plenty of time to rebook

**Example:**

```
Booking Price: $100
Session Time: 2025-11-25 14:00
Cancellation Time: 2025-11-10 10:00 (15 days before)

→ User gets: $100 refund to their Stripe account
→ Admin gets: $0
```

### Case 4: Cancellation **After session time**

- **Not Allowed** - Cannot cancel past bookings
- Returns error message

---

## API Endpoint

### Cancel Booking

**Endpoint:** `POST /lynx/v1/api/booking/cancel/:id`

**Authentication:** Required (User or Admin)

**Authorization:** User must own the booking OR be an admin

**Request:**

```json
{
  "cancellation_reason": "Emergency came up, cannot attend"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking_id": "69136146b71d52fb87fe826f",
    "booking_number": "20",
    "status": "cancelled",
    "refund_policy": "Less than 24 hours before session - 50% refund to user, 50% to provider",
    "refund_amount": 50,
    "refund_type": "partial",
    "provider_compensation": 50,
    "hours_until_session": "18.50",
    "stripe_refund_id": "re_1234567890"
  }
}
```

**Response (Error):**

```json
{
  "success": false,
  "message": "Cannot cancel booking - session time has already passed"
}
```

---

## Database Changes

### Payment Model Updates

Added new fields to track refunds:

```javascript
{
  // Refund tracking
  refund_amount: Number,           // Amount refunded to user
  refund_status: String,           // "none", "partial", "full"
  stripe_refund_id: String,        // Stripe refund ID
  refund_reason: String,           // Why was it refunded
  refunded_at: Date,               // When was it refunded

  // Provider compensation
  provider_compensation_amount: Number,  // Amount for provider
  provider_compensation_status: String,  // "none", "pending", "completed"
}
```

---

## How It Works

### Step-by-Step Flow:

1. **User initiates cancellation**

   - Calls `POST /booking/cancel/:id` with optional reason

2. **System validates**

   - ✅ Booking exists
   - ✅ User owns booking or is admin
   - ✅ Booking is not already cancelled
   - ✅ Booking is not completed
   - ✅ Payment was successful

3. **Calculate time until session**

   ```javascript
   const sessionDateTime = new Date(`${session_date}T${session_time}:00`);
   const hoursUntilSession = (sessionDateTime - now) / (1000 * 60 * 60);
   ```

4. **Determine refund amount**

   - < 24 hours: 50% refund, 50% compensation
   - 24 hours - 7 days: 100% refund
   - > 7 days: 100% refund
   - Past session: Error

5. **Process Stripe refund**

   ```javascript
   const refund = await stripe.refunds.create({
     payment_intent: payment_intent_id,
     amount: refund_amount * 100, // Convert to cents
     reason: "requested_by_customer", // Stripe only accepts specific values
   });
   // User's custom cancellation_reason is stored in payment.refund_reason
   ```

6. **Update database**

   - Payment: Set refund details
   - Booking: Set status to "cancelled"

7. **Transfer provider compensation** (if applicable)

   - Currently logs to console
   - TODO: Implement Stripe Connect transfer

8. **Send notifications**
   - User: "Booking cancelled, refund: $XX"
   - Provider: "Booking cancelled, compensation: $XX"

---

## Testing

### Test Case 1: Cancel 10 hours before session (< 24 hours)

```bash
POST {{BASE_URL}}/booking/cancel/69136146b71d52fb87fe826f
Authorization: Bearer <user_token>

{
  "cancellation_reason": "Emergency"
}
```

**Expected:**

- 50% refund to user
- 50% to admin (provider compensation)

### Test Case 2: Cancel 3 days before session

```bash
POST {{BASE_URL}}/booking/cancel/69136146b71d52fb87fe826f
Authorization: Bearer <user_token>

{
  "cancellation_reason": "Schedule conflict"
}
```

**Expected:**

- 100% refund to user
- 0% to admin

---

## Future Enhancements

### 1. Stripe Connect Integration

Currently, provider compensation goes to admin account. In the future:

```javascript
// Transfer to provider's connected account
const transfer = await stripe.transfers.create({
  amount: compensation_amount * 100,
  currency: "usd",
  destination: provider.stripe_connect_account_id,
  description: `Compensation for cancelled booking ${booking_id}`,
});
```

### 2. Wallet System

Instead of Stripe refunds, implement internal wallet:

```javascript
// Add to user wallet
user.wallet_balance += refund_amount;
await user.save();

// Add to provider wallet
provider.wallet_balance += compensation_amount;
await provider.save();
```

---

## Error Handling

| Error                                                     | Reason                   |
| --------------------------------------------------------- | ------------------------ |
| "Booking not found"                                       | Invalid booking ID       |
| "Unauthorized to cancel this booking"                     | User doesn't own booking |
| "Booking is already cancelled"                            | Already cancelled        |
| "Cannot cancel a completed booking"                       | Session completed        |
| "No payment found for this booking"                       | No payment record        |
| "Cannot refund unpaid booking"                            | Payment not successful   |
| "Cannot cancel booking - session time has already passed" | Too late                 |

---

## Summary

✅ **Automatic refund calculation** based on cancellation time  
✅ **Stripe integration** for actual refunds  
✅ **Provider compensation** for late cancellations  
✅ **Notifications** to user and provider  
✅ **Complete audit trail** in database  
✅ **Flexible** - Easy to adjust refund percentages

**Status:** Ready for Testing 🚀
