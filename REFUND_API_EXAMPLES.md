# Booking Refund API - Postman Examples

## 1. Cancel Booking (Less than 24 hours)

### Request
```
POST {{BASE_URL}}/booking/cancel/69136146b71d52fb87fe826f
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Body
```json
{
  "cancellation_reason": "Emergency came up, cannot attend the session"
}
```

### Response (50% Refund)
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking_id": "69136146b71d52fb87fe826f",
    "booking_number": "20",
    "status": "cancelled",
    "refund_policy": "Less than 24 hours before session - 50% refund to user, 50% to provider",
    "refund_amount": 30,
    "refund_type": "partial",
    "provider_compensation": 30,
    "hours_until_session": "18.50",
    "stripe_refund_id": "re_3QKxyz123456789"
  }
}
```

---

## 2. Cancel Booking (3 days before)

### Request
```
POST {{BASE_URL}}/booking/cancel/690e2f097130772ce9f1896a
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Body
```json
{
  "cancellation_reason": "Schedule conflict - need to reschedule"
}
```

### Response (100% Refund)
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "booking_number": "10",
    "status": "cancelled",
    "refund_policy": "More than 24 hours before session - 100% refund to user",
    "refund_amount": 70,
    "refund_type": "full",
    "provider_compensation": 0,
    "hours_until_session": "72.00",
    "stripe_refund_id": "re_3QKabc987654321"
  }
}
```

---

## 3. Cancel Booking (Already Cancelled)

### Request
```
POST {{BASE_URL}}/booking/cancel/69136146b71d52fb87fe826f
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Body
```json
{
  "cancellation_reason": "Changed my mind"
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Booking is already cancelled"
}
```

---

## 4. Cancel Booking (After Session Time)

### Request
```
POST {{BASE_URL}}/booking/cancel/690e2f097130772ce9f1896a
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

### Body
```json
{
  "cancellation_reason": "Forgot to cancel earlier"
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Cannot cancel booking - session time has already passed"
}
```

---

## 5. Cancel Booking (Unauthorized)

### Request
```
POST {{BASE_URL}}/booking/cancel/69136146b71d52fb87fe826f
Authorization: Bearer <different_user_token>
Content-Type: application/json
```

### Body
```json
{
  "cancellation_reason": "Want to cancel"
}
```

### Response (Error)
```json
{
  "success": false,
  "message": "Unauthorized to cancel this booking"
}
```

---

## 6. Get Booking After Cancellation

### Request
```
GET {{BASE_URL}}/booking/get/69136146b71d52fb87fe826f
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response
```json
{
  "success": true,
  "data": {
    "_id": "69136146b71d52fb87fe826f",
    "booking_id": "20",
    "status": "cancelled",
    "payment_status": "refunded",
    "notes": "Cancelled: Emergency came up. Less than 24 hours before session - 50% refund to user, 50% to provider",
    "price": 60,
    "session_date": "2025-11-10T00:00:00.000Z",
    "session_time": "14:00",
    ...
  }
}
```

---

## 7. Get Payment After Refund

### Request
```
GET {{BASE_URL}}/booking/payment/6913614db71d52fb87fe8274
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response
```json
{
  "success": true,
  "data": {
    "_id": "6913614db71d52fb87fe8274",
    "booking_id": "69136146b71d52fb87fe826f",
    "amount": 60,
    "payment_status": "refunded",
    "refund_amount": 30,
    "refund_status": "partial",
    "refund_reason": "Emergency came up, cannot attend the session",
    "refunded_at": "2025-11-11T18:30:00.000Z",
    "provider_compensation_amount": 30,
    "provider_compensation_status": "pending",
    "stripe_refund_id": "re_3QKxyz123456789",
    ...
  }
}
```

---

## Environment Variables

```
BASE_URL=http://localhost:5000/lynx/v1/api
USER_TOKEN=<your_user_jwt_token>
ADMIN_TOKEN=<your_admin_jwt_token>
```

---

## Refund Timeline Examples

| Booking Time | Session Time | Cancel Time | Hours Until | Refund % | Provider % |
|--------------|--------------|-------------|-------------|----------|------------|
| Nov 10 10:00 | Nov 15 14:00 | Nov 15 10:00 | 4 hours | 50% | 50% |
| Nov 10 10:00 | Nov 15 14:00 | Nov 14 10:00 | 28 hours | 100% | 0% |
| Nov 10 10:00 | Nov 15 14:00 | Nov 12 10:00 | 76 hours | 100% | 0% |
| Nov 10 10:00 | Nov 15 14:00 | Nov 5 10:00 | 244 hours | 100% | 0% |
| Nov 10 10:00 | Nov 15 14:00 | Nov 15 15:00 | -1 hour | ERROR | ERROR |

---

## Testing Checklist

- [ ] Cancel booking 1 hour before session (50% refund)
- [ ] Cancel booking 12 hours before session (50% refund)
- [ ] Cancel booking 23 hours before session (50% refund)
- [ ] Cancel booking 25 hours before session (100% refund)
- [ ] Cancel booking 3 days before session (100% refund)
- [ ] Cancel booking 10 days before session (100% refund)
- [ ] Try to cancel after session time (should fail)
- [ ] Try to cancel already cancelled booking (should fail)
- [ ] Try to cancel someone else's booking (should fail)
- [ ] Verify Stripe refund is created
- [ ] Verify payment record is updated
- [ ] Verify booking status is updated
- [ ] Verify notifications are sent

---

## Notes

- All refunds are processed through Stripe automatically
- Provider compensation currently goes to admin account (future: Stripe Connect)
- Refund appears in user's original payment method within 5-10 business days
- Partial refunds (50%) only occur when cancelling < 24 hours before session
- Full refunds (100%) occur when cancelling >= 24 hours before session

