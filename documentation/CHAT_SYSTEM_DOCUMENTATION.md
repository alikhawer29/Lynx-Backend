# Real-Time Chat System Documentation 💬

Complete documentation for the Lynx real-time chat system with Socket.IO integration.

**Base URL:** `http://localhost:5000/lynx/v1/api`

---

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [REST API Endpoints](#rest-api-endpoints)
4. [Socket.IO Events](#socketio-events)
5. [Chat Types](#chat-types)
6. [Usage Examples](#usage-examples)

---

## Overview

The chat system supports two types of one-to-one chats:

### 1. **Support Chat**
- User/Provider can chat with Admin
- Always available
- Used for customer support and general inquiries

### 2. **Appointment Chat**
- User chats with Provider
- Only active when appointment status is `in_progress`
- Automatically managed based on booking status

### Key Features
- ✅ Real-time messaging with Socket.IO
- ✅ Read receipts and delivery status
- ✅ Typing indicators
- ✅ Online/offline status tracking
- ✅ Unread message counts
- ✅ Message search functionality
- ✅ File and image sharing
- ✅ Message deletion (for self or everyone)

---

## Database Schema

### ChatRoom Model

```javascript
{
  chat_type: String,              // 'support' or 'appointment'
  participants: [ObjectId],       // Array of 2 user IDs
  user_id: ObjectId,              // Primary user
  other_user_id: ObjectId,        // Admin or Provider
  booking_id: ObjectId,           // For appointment chats only
  last_message: ObjectId,         // Reference to last message
  last_message_text: String,      // Quick access to last message
  last_message_time: Date,        // For sorting chat list
  last_message_sender: ObjectId,  // Who sent last message
  unread_count: Map,              // Unread count per user
  is_active: Boolean,             // Chat active status
  auto_close_on_completion: Boolean,
  deleted: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### ChatMessage Model

```javascript
{
  chat_room_id: ObjectId,         // Reference to chat room
  sender_id: ObjectId,            // Message sender
  receiver_id: ObjectId,          // Message receiver
  message_type: String,           // 'text', 'image', 'file'
  message_text: String,           // Text content
  media_url: String,              // URL for images/files
  file_name: String,              // Original file name
  file_size: Number,              // File size in bytes
  status: String,                 // 'sent', 'delivered', 'read'
  is_read: Boolean,               // Read status
  read_at: Date,                  // When message was read
  is_delivered: Boolean,          // Delivery status
  delivered_at: Date,             // When message was delivered
  deleted: Boolean,               // Soft delete
  deleted_for: [ObjectId],        // Users who deleted this message
  createdAt: Date,
  updatedAt: Date
}
```

### UserOnlineStatus Model

```javascript
{
  user_id: ObjectId,              // User reference
  is_online: Boolean,             // Online status
  last_seen: Date,                // Last activity timestamp
  socket_id: String,              // Current socket ID
  active_sockets: [{              // Multiple device support
    socket_id: String,
    connected_at: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

## REST API Endpoints

### 1. Create Support Chat

**Endpoint:** `POST /chat/support`

**Access:** USER, PROVIDER

**Description:** Create or retrieve support chat with admin

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "message": "Support chat created successfully",
  "data": {
    "_id": "6915b4481137b8c7483f0bda",
    "chat_type": "support",
    "user_id": {
      "_id": "690b2204e97e502f5a07a7ca",
      "first_name": "John",
      "last_name": "Doe",
      "picture": "uploads/user/image.png",
      "role": "user"
    },
    "other_user_id": {
      "_id": "690b2204e97e502f5a07a7cb",
      "first_name": "Admin",
      "last_name": "User",
      "role": "admin"
    },
    "is_active": true,
    "unread_count": {},
    "createdAt": "2025-11-20T10:30:00.000Z"
  }
}
```

---

### 2. Create Appointment Chat

**Endpoint:** `POST /chat/appointment`

**Access:** USER, PROVIDER

**Description:** Create appointment chat (only when booking is in_progress)

**Request Body:**
```json
{
  "booking_id": "690e2f097130772ce9f1896a"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment chat created successfully",
  "data": {
    "_id": "6915b4481137b8c7483f0bdb",
    "chat_type": "appointment",
    "booking_id": {
      "_id": "690e2f097130772ce9f1896a",
      "booking_id": "10",
      "status": "approved",
      "booking_status": "in_progress"
    },
    "user_id": { ... },
    "other_user_id": { ... },
    "is_active": true
  }
}
```

**Error Cases:**
- Booking not found
- User not part of booking
- Booking status is not `in_progress`

---

### 3. Get User's Chat List

**Endpoint:** `GET /chat/user-chats`

**Access:** Authenticated users

**Query Parameters:**
- `page` - Page number (default: 1)
- `per_page` - Items per page (default: 10)
- `chat_type` - Filter by type: 'support' or 'appointment'

**Example:**
```
GET /chat/user-chats?page=1&per_page=20&chat_type=support
```

**Response:**
```json
{
  "success": true,
  "total": 15,
  "data": [
    {
      "_id": "6915b4481137b8c7483f0bda",
      "chat_type": "support",
      "other_user": {
        "_id": "690b2204e97e502f5a07a7cb",
        "first_name": "Admin",
        "last_name": "User",
        "image_url": "http://localhost:5000/uploads/user/admin.png"
      },
      "last_message_text": "How can I help you?",
      "last_message_time": "2025-11-20T14:30:00.000Z",
      "my_unread_count": 3,
      "is_active": true
    }
  ]
}
```

---


