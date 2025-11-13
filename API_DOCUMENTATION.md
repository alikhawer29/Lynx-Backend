# Lynx API Documentation 📚

Complete API documentation for Booking, Review, and Report modules.

**Base URL:** `http://localhost:5000/lynx/v1/api`

---

## Table of Contents

1. [Booking APIs](#booking-apis)
   - [User Booking APIs](#user-booking-apis)
   - [Admin Booking APIs](#admin-booking-apis)
   - [Payment APIs](#payment-apis)
2. [Review APIs](#review-apis)
3. [Report APIs](#report-apis)
4. [Authentication](#authentication)
5. [Response Formats](#response-formats)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### User Roles

- **USER** - Regular users who book services
- **PROVIDER** - Service providers/consultants
- **ADMIN** - System administrators

---

# Booking APIs

## User Booking APIs

### 1. Create Booking

**Endpoint:** `POST /booking/create`

**Access:** USER, ADMIN

**Description:** Create a new booking for a service

**Request Body:**

```json
{
  "service_id": "68c98f9376674d6b63617ea2",
  "category_id": "68bee5ace7e3ce2baa2627dc",
  "price_type": "normal",
  "session_date": "2025-11-20",
  "session_time": "14:00",
  "slot_id": "690d1234567890abcdef1234",
  "address": {
    "full_address": "123 Main St, New York, NY",
    "lat": 40.7128,
    "lng": -74.006,
    "floor": "2nd Floor"
  },
  "contact_details": {
    "first_name": "John",
    "last_name": "Doe",
    "country_code": "US",
    "phone_number": "1234567890",
    "email": "john@example.com"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking successfully created",
  "data": {
    "_id": "690e2f097130772ce9f1896a",
    "booking_id": "10",
    "user_id": "690b2204e97e502f5a07a7ca",
    "service_id": "68c98f9376674d6b63617ea2",
    "status": "pending",
    "payment_status": "unpaid",
    "price": 70,
    "session_date": "2025-11-20T00:00:00.000Z",
    "session_time": "14:00"
  }
}
```

---

### 2. Get All Bookings

**Endpoint:** `GET /booking/get`

**Access:** Public (filtered by user if authenticated)

**Query Parameters:**

- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 10)
- `search` - Search in notes
- `status` - Filter by status (pending/approved/rejected/completed/cancelled/refunded/rescheduled/reschedule_pending)
- `from` - Start date (YYYY-MM-DD)
- `to` - End date (YYYY-MM-DD)
- `sortBy` - Sort field

**Example:**

```
GET /booking/get?page=1&per_page=10&status=pending
```

**Response:**

```json
{
  "success": true,
  "total": 25,
  "data": [
    {
      "_id": "690e2f097130772ce9f1896a",
      "booking_id": "10",
      "status": "pending",
      "user_full_name": "John Doe",
      "session_datetime": "2025-11-20 14:00"
    }
  ]
}
```

---

### 3. Get Booking by ID

**Endpoint:** `GET /booking/get/:id`

**Access:** Public

**Response:**

```json
{
  "success": true,
  "data": {
    "_id": "690e2f097130772ce9f1896a",
    "booking_id": "10",
    "user_id": {
      "_id": "690b2204e97e502f5a07a7ca",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "image_url": "http://localhost:5000/uploads/user/image.png"
    },
    "service_id": {
      "_id": "68c98f9376674d6b63617ea2",
      "name": "Online Therapy",
      "image_url": "http://localhost:5000/uploads/service/image.jpeg"
    },
    "provider_id": {
      "_id": "69134e10b082ac7e288e50a5",
      "first_name": "Dr. Sarah",
      "last_name": "Smith"
    },
    "status": "approved",
    "payment_status": "paid",
    "price": 70,
    "session_date": "2025-11-20T00:00:00.000Z",
    "session_time": "14:00"
  }
}
```

---

### 4. Update Booking

**Endpoint:** `PATCH /booking/update/:id`

**Access:** USER, ADMIN

**Request Body:**

```json
{
  "session_date": "2025-11-25",
  "session_time": "15:00",
  "notes": "Updated booking time"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking successfully updated",
  "data": { ... }
}
```

---

### 5. Cancel Booking (with Refund)

**Endpoint:** `POST /booking/cancel/:id`

**Access:** USER, ADMIN

**Description:** Cancel a booking and process refund based on cancellation timing

**Refund Policy:**

- **< 24 hours before session:** 50% refund to user, 50% to provider
- **24 hours - 7 days before session:** 100% refund to user
- **> 7 days before session:** 100% refund to user

**Request Body:**

```json
{
  "cancellation_reason": "Emergency - cannot attend"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "booking_number": "10",
    "status": "cancelled",
    "refund_policy": "Less than 24 hours before session - 50% refund to user, 50% to provider",
    "refund_amount": 35,
    "refund_type": "partial",
    "provider_compensation": 35,
    "hours_until_session": "18.50",
    "stripe_refund_id": "re_1234567890"
  }
}
```

---

### 6. Respond to Reschedule Request

**Endpoint:** `POST /booking/reschedule-response/:id`

**Access:** USER

**Description:** Approve or reject admin's reschedule request

**Request Body (Approve):**

```json
{
  "response": "approved"
}
```

**Request Body (Reject):**

```json
{
  "response": "rejected",
  "rejection_reason": "The new time doesn't work for me"
}
```

**Response (Approved):**

```json
{
  "success": true,
  "message": "Reschedule approved successfully",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "booking_number": "10",
    "status": "rescheduled",
    "session_date": "2025-11-25T00:00:00.000Z",
    "session_time": "15:00",
    "reschedule_count": 1
  }
}
```

---

## Admin Booking APIs

### 7. Assign Provider to Booking

**Endpoint:** `POST /booking/assign-provider/:id`

**Access:** ADMIN

**Description:** Assign a service provider to a pending booking

**Request Body:**

```json
{
  "provider_id": "69134e10b082ac7e288e50a5"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Provider assigned successfully",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "status": "approved",
    "provider_id": {
      "_id": "69134e10b082ac7e288e50a5",
      "first_name": "Dr. Sarah",
      "last_name": "Smith"
    }
  }
}
```

---

### 8. Reject Booking

**Endpoint:** `POST /booking/reject/:id`

**Access:** ADMIN

**Description:** Reject a pending booking

**Request Body:**

```json
{
  "rejection_reason": "Service not available at requested time"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking rejected successfully",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "status": "rejected",
    "notes": "Rejected: Service not available at requested time"
  }
}
```

---

### 9. Reschedule Booking

**Endpoint:** `POST /booking/reschedule/:id`

**Access:** ADMIN

**Description:** Propose a new date/time for a booking (requires user approval)

**Request Body:**

```json
{
  "proposed_session_date": "2025-11-25",
  "proposed_session_time": "15:00",
  "proposed_slot_id": "690d9876543210fedcba4321",
  "reschedule_reason": "Provider unavailable at original time"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Booking reschedule request sent to user",
  "data": {
    "booking_id": "690e2f097130772ce9f1896a",
    "booking_number": "10",
    "status": "reschedule_pending",
    "original_session_date": "2025-11-20T00:00:00.000Z",
    "original_session_time": "14:00",
    "proposed_session_date": "2025-11-25T00:00:00.000Z",
    "proposed_session_time": "15:00",
    "reschedule_reason": "Provider unavailable at original time",
    "reschedule_response": "pending"
  }
}
```

**Workflow:**

1. Admin proposes new date/time
2. Booking status changes to `reschedule_pending`
3. User receives notification
4. User approves or rejects via `/booking/reschedule-response/:id`
5. If approved: booking updated, status → `rescheduled`
6. If rejected: booking reverts to previous status

---
