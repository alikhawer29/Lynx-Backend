# Payout System APIs - Postman Collection

## 🔗 Base URL
```
{{BASE_URL}}/lynx/v1/api
```

---

## 👨‍💼 ADMIN PAYOUT APIS

### 1. Configure Payout for Specific Booking
**Endpoint:** `POST /admin/payouts/booking/{booking_id}/configure`

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Body (JSON):**
```json
{
    "payout_method": "weekly",
    "weekly_payout_day": 3,
    "disbursement_days": null
}
```

**Payout Method Options:**
- `"manual"` - Admin clicks "Pay Now" button
- `"weekly"` - Weekly payouts (weekly_payout_day: 1-7, Mon-Sun)
- `"disbursement_day"` - X days after booking completion (disbursement_days: number)

**Response:**
```json
{
    "success": true,
    "message": "Booking payout configuration updated successfully",
    "data": {
        "payout_method": "weekly",
        "weekly_payout_day": 3,
        "disbursement_days": null,
        "configured_by": "64a1b2c3d4e5f6789012345",
        "configured_at": "2026-03-09T08:30:00.000Z"
    }
}
```

---

### 2. Get Booking Payout Configuration
**Endpoint:** `GET /admin/payouts/booking/{booking_id}/config`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "booking_id": "64a1b2c3d4e5f6789012345",
        "booking_status": "completed",
        "payment_status": "paid",
        "payout_status": "pending",
        "provider": {
            "_id": "64a1b2c3d4e5f6789012346",
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "stripe_account_status": "enabled"
        },
        "admin_payout_config": {
            "payout_method": "weekly",
            "weekly_payout_day": 3,
            "disbursement_days": null,
            "configured_by": {
                "_id": "64a1b2c3d4e5f6789012347",
                "first_name": "Admin",
                "last_name": "User",
                "email": "admin@example.com"
            },
            "configured_at": "2026-03-09T08:30:00.000Z"
        }
    }
}
```

---

### 3. Get Booking Logs for Payout Management
**Endpoint:** `GET /admin/payouts/booking-logs`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters (Optional):**
```
page=1
per_page=10
search=john
status=pending
provider_id=64a1b2c3d4e5f6789012346
from=2026-03-01
to=2026-03-31
```

**Response:**
```json
{
    "success": true,
    "total": 60,
    "data": [
        {
            "_id": "64a1b2c3d4e5f6789012345",
            "booking_id": "BK123456789",
            "price": 100,
            "payment_status": "paid",
            "payout_status": "pending",
            "provider_id": {
                "_id": "64a1b2c3d4e5f6789012346",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john@example.com"
            },
            "user_id": {
                "_id": "64a1b2c3d4e5f6789012348",
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@example.com"
            },
            "admin_payout_config": {
                "payout_method": "weekly",
                "weekly_payout_day": 3,
                "configured_at": "2026-03-09T08:30:00.000Z"
            }
        }
    ]
}
```

---

### 4. Process Manual Payout (Pay Now)
**Endpoint:** `POST /admin/payouts/process/{booking_id}`

**Headers:**
```
Authorization: Bearer {admin_token}
Content-Type: application/json
```

**Response:**
```json
{
    "success": true,
    "message": "Payout processed successfully",
    "data": {
        "_id": "64a1b2c3d4e5f6789012349",
        "booking_id": "64a1b2c3d4e5f6789012345",
        "provider_amount": 90,
        "platform_fee": 10,
        "status": "paid",
        "stripe_transfer_id": "tr_1234567890abcdef",
        "processed_date": "2026-03-09T08:35:00.000Z"
    }
}
```

---

### 5. Get All Payouts
**Endpoint:** `GET /admin/payouts/payouts`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Query Parameters (Optional):**
```
page=1
per_page=10
status=pending
provider_id=64a1b2c3d4e5f6789012346
from=2026-03-01
to=2026-03-31
```

**Response:**
```json
{
    "success": true,
    "total": 45,
    "data": [
        {
            "_id": "64a1b2c3d4e5f6789012349",
            "booking_id": {
                "_id": "64a1b2c3d4e5f6789012345",
                "booking_id": "BK123456789",
                "price": 100,
                "session_date": "2026-03-09T00:00:00.000Z"
            },
            "provider_id": {
                "_id": "64a1b2c3d4e5f6789012346",
                "first_name": "John",
                "last_name": "Doe",
                "email": "john@example.com"
            },
            "total_amount": 100,
            "provider_amount": 90,
            "platform_fee": 10,
            "status": "paid",
            "payout_type": "weekly",
            "stripe_transfer_id": "tr_1234567890abcdef",
            "processed_date": "2026-03-09T08:35:00.000Z"
        }
    ]
}
```

---

### 6. Get Payout Statistics
**Endpoint:** `GET /admin/payouts/payouts/stats`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "by_status": [
            {
                "_id": "pending",
                "count": 15,
                "total_amount": 1350
            },
            {
                "_id": "paid",
                "count": 30,
                "total_amount": 2700
            }
        ],
        "total_pending": {
            "count": 15,
            "amount": 1350
        },
        "total_paid": {
            "count": 30,
            "amount": 2700
        }
    }
}
```

---

### 7. Retry Failed Payout
**Endpoint:** `POST /admin/payouts/payouts/{payout_id}/retry`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
    "success": true,
    "message": "Payout retry initiated successfully"
}
```

---

### 8. Get Provider Connect Status
**Endpoint:** `GET /admin/payouts/provider/{provider_id}/connect-status`

**Headers:**
```
Authorization: Bearer {admin_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "provider_id": "64a1b2c3d4e5f6789012346",
        "stripe_account_id": "acct_1234567890abcdef",
        "stripe_account_status": "enabled",
        "payout_enabled": true,
        "payout_schedule": "manual",
        "disbursement_days": null,
        "account_details": {
            "id": "acct_1234567890abcdef",
            "charges_enabled": true,
            "payouts_enabled": true,
            "requirements": {
                "currently_due": [],
                "past_due": []
            }
        }
    }
}
```

---

## 👷 PROVIDER PAYOUT APIS

### 1. Get Required Fields for Stripe Connect
**Endpoint:** `GET /payouts/connect/required-fields`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "has_account": false,
        "account_status": "not_started",
        "existing_account": null,
        "required_fields": {
            "personal_info": [
                "first_name",
                "last_name",
                "phone_number",
                "date_of_birth"
            ],
            "address": [
                "address_line1",
                "city",
                "state",
                "postal_code",
                "country"
            ],
            "bank_account": [
                "bank_account_number",
                "bank_routing_number",
                "bank_account_holder_name"
            ],
            "business_info": [
                "business_description"
            ],
            "verification": [
                "ssn_last4",
                "id_document_front",
                "id_document_back"
            ]
        }
    }
}
```

---

### 2. Upload Verification Document
**Endpoint:** `POST /payouts/connect/upload-document`

**Headers:**
```
Authorization: Bearer {provider_token}
Content-Type: multipart/form-data
```

**Body (Form Data):**
```
document: [file] (Choose file: ID card front/back)
document_type: identity_document
```

**Response:**
```json
{
    "success": true,
    "message": "Document uploaded successfully",
    "data": {
        "file_id": "file_1A2B3C4D5E6F7G8H",
        "document_type": "identity_document"
    }
}
```

---

### 3. Create Stripe Connect Account (Backend-Only)
**Endpoint:** `POST /payouts/connect/create-account`

**Headers:**
```
Authorization: Bearer {provider_token}
Content-Type: application/json
```

**Body (JSON):**
```json
{
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890",
    "date_of_birth": "1990-01-01",
    "address_line1": "123 Main St",
    "address_line2": "Apt 4B",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001",
    "country": "US",
    "bank_account_number": "000123456789",
    "bank_routing_number": "110000000",
    "bank_account_holder_name": "John Doe",
    "business_description": "Professional consulting services",
    "website": "https://johndoe.example.com",
    "id_document_front": "file_1A2B3C4D5E6F7G8H",
    "id_document_back": "file_2B3C4D5E6F7G8H9I",
    "ssn_last4": "1234",
    "tax_id": "12-3456789"
}
```

**Response:**
```json
{
    "success": true,
    "message": "Stripe Connect account created successfully",
    "data": {
        "account_id": "acct_1234567890abcdef",
        "status": "pending",
        "requirements": {
            "currently_due": [
                "individual.verification.document"
            ],
            "past_due": []
        }
    }
}
```

---

### 4. Get Provider Payout Settings
**Endpoint:** `GET /payouts/settings`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "stripe_account_id": "acct_1234567890abcdef",
        "stripe_account_status": "enabled",
        "payout_enabled": true,
        "payout_schedule": "manual",
        "payout_day": null,
        "disbursement_days": null
    }
}
```

---

### 5. Get Provider Payouts
**Endpoint:** `GET /payouts/payouts`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Query Parameters (Optional):**
```
page=1
per_page=10
status=pending
from=2026-03-01
to=2026-03-31
```

**Response:**
```json
{
    "success": true,
    "total": 25,
    "data": [
        {
            "_id": "64a1b2c3d4e5f6789012349",
            "booking_id": {
                "_id": "64a1b2c3d4e5f6789012345",
                "booking_id": "BK123456789",
                "price": 100,
                "session_date": "2026-03-09T00:00:00.000Z",
                "session_time": "10:00 AM"
            },
            "total_amount": 100,
            "provider_amount": 90,
            "platform_fee": 10,
            "status": "paid",
            "payout_type": "weekly",
            "stripe_transfer_id": "tr_1234567890abcdef",
            "processed_date": "2026-03-09T08:35:00.000Z"
        }
    ]
}
```

---

### 6. Get Provider Payout Statistics
**Endpoint:** `GET /payouts/payouts/stats`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "by_status": [
            {
                "_id": "pending",
                "count": 5,
                "total_amount": 450
            },
            {
                "_id": "paid",
                "count": 20,
                "total_amount": 1800
            }
        ],
        "total_earnings": 1800,
        "pending_earnings": 450
    }
}
```

---

### 7. Get Account Balance
**Endpoint:** `GET /payouts/account/balance`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "object": "balance",
        "available": [
            {
                "amount": 180000,
                "currency": "usd",
                "source_types": {
                    "card": 180000
                }
            }
        ],
        "pending": [
            {
                "amount": 45000,
                "currency": "usd",
                "source_types": {
                    "card": 45000
                }
            }
        ],
        "connect_reserved": [
            {
                "amount": 0,
                "currency": "usd",
                "source_types": {
                    "card": 0
                }
            }
        ],
        "issuing": [
            {
                "amount": 0,
                "currency": "usd",
                "source_types": {
                    "card": 0
                }
            }
        ],
        "livemode": false,
        "object": "balance"
    }
}
```

---

### 8. Create Dashboard Login Link
**Endpoint:** `POST /payouts/account/dashboard-link`

**Headers:**
```
Authorization: Bearer {provider_token}
Content-Type: application/json
```

**Response:**
```json
{
    "success": true,
    "data": {
        "login_url": "https://connect.stripe.com/express/abc123xyz"
    }
}
```

---

### 9. Get Booking Payout History
**Endpoint:** `GET /payouts/booking-payout-history`

**Headers:**
```
Authorization: Bearer {provider_token}
```

**Query Parameters (Optional):**
```
page=1
per_page=10
status=pending
```

**Response:**
```json
{
    "success": true,
    "total": 25,
    "data": [
        {
            "_id": "64a1b2c3d4e5f6789012345",
            "booking_id": "BK123456789",
            "price": 100,
            "payment_status": "paid",
            "payout_status": "paid",
            "user_id": {
                "_id": "64a1b2c3d4e5f6789012348",
                "first_name": "Jane",
                "last_name": "Smith",
                "email": "jane@example.com"
            },
            "payout_id": {
                "_id": "64a1b2c3d4e5f6789012349",
                "status": "paid",
                "provider_amount": 90,
                "processed_date": "2026-03-09T08:35:00.000Z"
            }
        }
    ]
}
```

---

## 🧪 TESTING SEQUENCE

### For Admin:
1. **Login as admin** → Get admin token
2. **Get booking logs** → Find a booking to configure
3. **Configure payout** → Set payout method for booking
4. **Get booking config** → Verify configuration
5. **Process manual payout** → Test "Pay Now" functionality
6. **Get payout stats** → View overall statistics

### For Provider:
1. **Login as provider** → Get provider token
2. **Get required fields** → See what's needed for Stripe Connect
3. **Upload documents** → Upload ID verification (optional)
4. **Create Connect account** → Complete Stripe Connect setup
5. **Get payout history** → View earnings and payouts
6. **Get account balance** → Check available/pending funds
7. **Create dashboard link** → Access Stripe Express dashboard

---

## 📝 NOTES

- Replace `{booking_id}`, `{payout_id}`, `{provider_id}` with actual IDs from your database
- Replace `{admin_token}` and `{provider_token}` with valid JWT tokens
- File uploads require `multipart/form-data` content type
- All monetary amounts are in cents (multiply dollars by 100)
- Date format: `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:mm:ss.sssZ` for datetimes
- Phone format: Include country code (e.g., `+1234567890`)
- Bank routing numbers should be valid ACH routing numbers for US accounts
