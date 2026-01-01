# Device Information API Documentation

This document explains how to use the device information functionality in the Lynx Backend.

## Overview

The system now supports storing device IDs and device types for users and providers. This information is used for push notifications and device tracking.

## Fields

- `device_ids`: Array of device tokens for push notifications (FCM tokens)
- `device_type`: Type of device ('ios', 'android', 'web')

## API Endpoints

### 1. Login with Device Information

**POST** `/auth/login`  
**POST** `/auth/social-login`  
**POST** `/Admin/auth/login`

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "password123",
  "device_id": "fcm_token_here",
  "device_type": "android",
  "timezone": "Asia/Karachi"
}
```

#### Response

```json
{
  "success": true,
  "message": "User successfully logged in",
  "token": "jwt_token_here",
  "data": {
    // User data including device_ids and device_type
  }
}
```

### 2. Signup with Device Information

**POST** `/auth/signup`

#### Request Body

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "password": "password123",
  "phone": "1234567890",
  "country_code": "US",
  "dialing_code": "+1",
  "device_id": "fcm_token_here",
  "device_type": "ios"
}
```

### 3. Update Device Information

**PUT** `/user/update-device`

#### Request Body

```json
{
  "device_id": "new_fcm_token_here",
  "device_type": "android"
}
```

#### Response

```json
{
  "success": true,
  "message": "Device information updated successfully",
  "data": {
    "device_ids": ["fcm_token_1", "fcm_token_2", "new_fcm_token_here"],
    "device_type": "android"
  }
}
```

## Device ID Management

- Device IDs are stored in an array to support multiple devices per user
- Duplicate device IDs are automatically prevented
- Device type is stored as a single value (latest device used)

## Device Types

Valid device types:

- `ios` - iOS devices (iPhone, iPad)
- `android` - Android devices
- `web` - Web browsers

## Usage Examples

### Mobile App Login

```javascript
// When user logs in from mobile app
const loginData = {
  email: "user@example.com",
  password: "password123",
  device_id: "firebase_cloud_messaging_token",
  device_type: "android", // or "ios"
};

fetch("/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(loginData),
});
```

### Update Device Token

```javascript
// When FCM token changes
const updateDeviceData = {
  device_id: "new_fcm_token_after_refresh",
  device_type: "android",
};

fetch("/user/update-device", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer jwt_token_here",
  },
  body: JSON.stringify(updateDeviceData),
});
```

## Push Notifications

The stored device IDs are automatically used by the notification system to send push notifications to users' devices.

## Error Handling

- `device_id` is required for update device endpoint
- Invalid `device_type` will be ignored
- Duplicate device IDs will not be added multiple times
