# Chat System - Testing Guide 🧪

Quick guide to test the chat system functionality.

---

## Prerequisites

1. Server is running on `http://localhost:5000`
2. You have a valid JWT token for authentication
3. You have user accounts (user, provider, admin roles)

---

## Test 1: Create Support Chat

### Request

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/support \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "success": true,
  "message": "Support chat created successfully",
  "data": {
    "_id": "...",
    "chat_type": "support",
    "user_id": { ... },
    "other_user_id": { ... },
    "is_active": true,
    "unread_count": {},
    "createdAt": "..."
  }
}
```

---

## Test 2: Get User's Chat List

### Request

```bash
curl -X GET "http://localhost:5000/lynx/v1/api/chat/user-chats?page=1&per_page=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response

```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "_id": "...",
      "chat_type": "support",
      "other_user": {
        "_id": "...",
        "first_name": "Admin",
        "last_name": "User",
        "image_url": "..."
      },
      "last_message_text": null,
      "last_message_time": null,
      "my_unread_count": 0,
      "is_active": true
    }
  ]
}
```

---

## Test 3: Send Message (REST API)

### Request

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "chat_room_id": "YOUR_CHAT_ROOM_ID",
    "message_text": "Hello! I need help with my booking.",
    "message_type": "text"
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "...",
    "chat_room_id": "...",
    "sender_id": { ... },
    "receiver_id": { ... },
    "message_type": "text",
    "message_text": "Hello! I need help with my booking.",
    "status": "sent",
    "is_read": false,
    "createdAt": "..."
  }
}
```

---

## Test 4: Get Messages

### Request

```bash
curl -X GET "http://localhost:5000/lynx/v1/api/chat/messages/YOUR_CHAT_ROOM_ID?page=1&per_page=50" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response

```json
{
  "success": true,
  "total": 1,
  "data": [
    {
      "_id": "...",
      "sender_id": { ... },
      "receiver_id": { ... },
      "message_text": "Hello! I need help with my booking.",
      "message_type": "text",
      "status": "sent",
      "is_read": false,
      "createdAt": "..."
    }
  ]
}
```

---

## Test 5: Create Appointment Chat

### Prerequisites
- You need a booking with `booking_status: 'in_progress'`

### Request

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/appointment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "YOUR_BOOKING_ID"
  }'
```

### Expected Success Response

```json
{
  "success": true,
  "message": "Appointment chat created successfully",
  "data": {
    "_id": "...",
    "chat_type": "appointment",
    "booking_id": { ... },
    "user_id": { ... },
    "other_user_id": { ... },
    "is_active": true
  }
}
```

### Expected Error (if booking not in_progress)

```json
{
  "success": false,
  "message": "Chat is only available when appointment is in progress"
}
```

---

## Test 6: Mark Message as Read

### Request

```bash
curl -X PUT http://localhost:5000/lynx/v1/api/chat/messages/MESSAGE_ID/read \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Expected Response

```json
{
  "success": true,
  "message": "Message marked as read",
  "data": { ... }
}
```

---

## Test 7: Search Chats

### Request

```bash
curl -X GET "http://localhost:5000/lynx/v1/api/chat/search/query?query=admin&page=1&per_page=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Socket.IO Testing (Browser Console)

### Connect to Socket

```javascript
const socket = io('http://localhost:5000', {
  query: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});

socket.on('error', (error) => {
  console.error('❌ Error:', error);
});
```

### Join Chat Room

```javascript
socket.emit('join_chat', {
  chat_room_id: 'YOUR_CHAT_ROOM_ID'
});

socket.on('joined_chat', (data) => {
  console.log('✅ Joined:', data);
});
```

### Send Message

```javascript
socket.emit('send_message', {
  chat_room_id: 'YOUR_CHAT_ROOM_ID',
  message_text: 'Hello from Socket.IO!',
  message_type: 'text'
});
```

### Receive Messages

```javascript
socket.on('receive_message', (message) => {
  console.log('📩 New message:', message);
});

socket.on('new_message_notification', (data) => {
  console.log('🔔 Notification:', data);
});
```

### Typing Indicator

```javascript
socket.emit('user_typing', {
  chat_room_id: 'YOUR_CHAT_ROOM_ID',
  is_typing: true
});

socket.on('user_typing_status', (data) => {
  console.log('⌨️ Typing:', data);
});
```

### Online Status

```javascript
socket.on('user_online_status', (data) => {
  console.log('👤 User status:', data);
});
```

---

## Common Issues & Solutions

### Issue: "unread_count?.get is not a function"
**Solution:** Fixed! The Map is now properly initialized in the model and controllers.

### Issue: "Chat is only available when appointment is in progress"
**Solution:** Make sure the booking has `booking_status: 'in_progress'` before creating appointment chat.

### Issue: "Unauthorized: You are not part of this chat"
**Solution:** Ensure you're using the correct user token that is a participant in the chat.

### Issue: Socket connection fails
**Solution:** Check that the JWT token is valid and passed in the query parameter.

---

## ✅ Success Criteria

- [ ] Support chat created successfully
- [ ] Appointment chat created (with valid booking)
- [ ] Messages sent via REST API
- [ ] Messages sent via Socket.IO
- [ ] Messages received in real-time
- [ ] Unread count updates correctly
- [ ] Read receipts work
- [ ] Typing indicators work
- [ ] Online status updates
- [ ] Search functionality works
- [ ] Chat list displays correctly

---

## 🎉 All Tests Passed!

If all tests pass, your chat system is fully functional and ready for production use!

