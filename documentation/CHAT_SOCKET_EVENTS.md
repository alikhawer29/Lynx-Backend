# Chat System - Socket.IO Events Documentation 🔌

Complete guide for real-time Socket.IO events in the Lynx chat system.

---

## Connection Setup

### Client Connection

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  query: {
    token: 'your_jwt_token_here'
  },
  transports: ['websocket'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to chat server');
  console.log('Socket ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected from chat server');
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## Client → Server Events

### 1. Join Chat Room

Join a specific chat room to receive messages.

```javascript
socket.emit('join_chat', {
  chat_room_id: '6915b4481137b8c7483f0bda'
});

// Listen for confirmation
socket.on('joined_chat', (data) => {
  console.log('Joined chat:', data);
  // { chat_room_id: '...', message: 'Successfully joined chat room' }
});
```

---

### 2. Leave Chat Room

Leave a chat room when navigating away.

```javascript
socket.emit('leave_chat', {
  chat_room_id: '6915b4481137b8c7483f0bda'
});

socket.on('left_chat', (data) => {
  console.log('Left chat:', data);
});
```

---

### 3. Send Message

Send a message in real-time.

**Text Message:**
```javascript
socket.emit('send_message', {
  chat_room_id: '6915b4481137b8c7483f0bda',
  message_text: 'Hello! How can I help you?',
  message_type: 'text'
});
```

**Image Message:**
```javascript
socket.emit('send_message', {
  chat_room_id: '6915b4481137b8c7483f0bda',
  message_type: 'image',
  media_url: 'uploads/chat/image-1234567890.jpg',
  file_name: 'screenshot.jpg',
  file_size: 245678
});
```

**File Message:**
```javascript
socket.emit('send_message', {
  chat_room_id: '6915b4481137b8c7483f0bda',
  message_type: 'file',
  media_url: 'uploads/chat/document-1234567890.pdf',
  file_name: 'invoice.pdf',
  file_size: 512000
});
```

---

### 4. Message Delivered

Notify sender that message was delivered.

```javascript
socket.emit('message_delivered', {
  message_id: '6915b4481137b8c7483f0bdc'
});
```

---

### 5. Message Read

Notify sender that message was read.

```javascript
socket.emit('message_read', {
  message_id: '6915b4481137b8c7483f0bdc'
});
```

---

### 6. User Typing

Show typing indicator to other user.

```javascript
// User starts typing
socket.emit('user_typing', {
  chat_room_id: '6915b4481137b8c7483f0bda',
  is_typing: true
});

// User stops typing (after 3 seconds of inactivity)
socket.emit('user_typing', {
  chat_room_id: '6915b4481137b8c7483f0bda',
  is_typing: false
});
```

**Implementation Example:**
```javascript
let typingTimeout;

function handleTyping(chatRoomId) {
  // Clear previous timeout
  clearTimeout(typingTimeout);
  
  // Emit typing start
  socket.emit('user_typing', {
    chat_room_id: chatRoomId,
    is_typing: true
  });
  
  // Set timeout to stop typing after 3 seconds
  typingTimeout = setTimeout(() => {
    socket.emit('user_typing', {
      chat_room_id: chatRoomId,
      is_typing: false
    });
  }, 3000);
}

// Call on input change
inputField.addEventListener('input', () => {
  handleTyping('6915b4481137b8c7483f0bda');
});
```

---

## Server → Client Events

### 1. Receive Message

Receive new messages in real-time.

```javascript
socket.on('receive_message', (message) => {
  console.log('New message received:', message);
  
  // Add message to chat UI
  addMessageToChat(message);
  
  // Send delivery confirmation
  socket.emit('message_delivered', {
    message_id: message._id
  });
  
  // If chat is open and visible, mark as read
  if (isChatVisible) {
    socket.emit('message_read', {
      message_id: message._id
    });
  }
});

/*
Message structure:
{
  _id: '6915b4481137b8c7483f0bdc',
  chat_room_id: '6915b4481137b8c7483f0bda',
  sender_id: {
    _id: '690b2204e97e502f5a07a7ca',
    first_name: 'John',
    last_name: 'Doe',
    picture: 'uploads/user/image.png',
    role: 'user'
  },
  receiver_id: { ... },
  message_type: 'text',
  message_text: 'Hello!',
  status: 'sent',
  is_read: false,
  createdAt: '2025-11-20T14:35:00.000Z'
}
*/
```

---


