# Chat System - Complete Usage Examples 📱

Practical examples for implementing the Lynx chat system in your frontend application.

---

## Table of Contents

1. [Setup and Connection](#setup-and-connection)
2. [Support Chat Flow](#support-chat-flow)
3. [Appointment Chat Flow](#appointment-chat-flow)
4. [Real-time Messaging](#real-time-messaging)
5. [React/React Native Examples](#reactreact-native-examples)
6. [Error Handling](#error-handling)

---

## Setup and Connection

### Install Socket.IO Client

```bash
npm install socket.io-client
# or
yarn add socket.io-client
```

### Initialize Socket Connection

```javascript
import io from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';
let socket = null;

function connectSocket(authToken) {
  socket = io(SOCKET_URL, {
    query: { token: authToken },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });

  // Connection events
  socket.on('connect', () => {
    console.log('✅ Connected to chat server');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from chat server');
  });

  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });

  return socket;
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

---

## Support Chat Flow

### Step 1: Create Support Chat (REST API)

```javascript
async function createSupportChat(authToken) {
  try {
    const response = await fetch('http://localhost:5000/lynx/v1/api/chat/support', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const result = await response.json();
    
    if (result.success) {
      const chatRoom = result.data;
      console.log('Support chat created:', chatRoom._id);
      return chatRoom;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating support chat:', error);
    throw error;
  }
}
```

### Step 2: Join Chat Room (Socket.IO)

```javascript
function joinChatRoom(chatRoomId) {
  socket.emit('join_chat', { chat_room_id: chatRoomId });

  socket.on('joined_chat', (data) => {
    console.log('✅ Joined chat room:', data.chat_room_id);
  });

  socket.on('error', (error) => {
    console.error('❌ Error joining chat:', error.message);
  });
}
```

### Step 3: Send Message

```javascript
function sendMessage(chatRoomId, messageText) {
  socket.emit('send_message', {
    chat_room_id: chatRoomId,
    message_text: messageText,
    message_type: 'text'
  });
}
```

### Step 4: Receive Messages

```javascript
function setupMessageListeners(onMessageReceived) {
  socket.on('receive_message', (message) => {
    console.log('📩 New message:', message);
    
    // Update UI with new message
    onMessageReceived(message);
    
    // Send delivery confirmation
    socket.emit('message_delivered', {
      message_id: message._id
    });
    
    // If chat is visible, mark as read
    socket.emit('message_read', {
      message_id: message._id
    });
  });
}
```

### Complete Support Chat Example

```javascript
async function startSupportChat(authToken) {
  // 1. Connect socket
  const socket = connectSocket(authToken);
  
  // 2. Create support chat
  const chatRoom = await createSupportChat(authToken);
  
  // 3. Join chat room
  joinChatRoom(chatRoom._id);
  
  // 4. Setup message listeners
  setupMessageListeners((message) => {
    console.log('Received:', message.message_text);
  });
  
  // 5. Send a message
  setTimeout(() => {
    sendMessage(chatRoom._id, 'Hello! I need help with my booking.');
  }, 1000);
}
```

---

## Appointment Chat Flow

### Step 1: Create Appointment Chat

```javascript
async function createAppointmentChat(authToken, bookingId) {
  try {
    const response = await fetch('http://localhost:5000/lynx/v1/api/chat/appointment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ booking_id: bookingId })
    });

    const result = await response.json();
    
    if (result.success) {
      return result.data;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error creating appointment chat:', error);
    throw error;
  }
}
```

### Step 2: Check if Appointment Chat is Available

```javascript
async function canStartAppointmentChat(authToken, bookingId) {
  try {
    // Get booking details
    const response = await fetch(
      `http://localhost:5000/lynx/v1/api/booking/${bookingId}`,
      {
        headers: { 'Authorization': `Bearer ${authToken}` }
      }
    );

    const result = await response.json();
    
    if (result.success) {
      const booking = result.data;
      
      // Chat is only available when booking_status is 'in_progress'
      return booking.booking_status === 'in_progress';
    }
    
    return false;
  } catch (error) {
    console.error('Error checking booking status:', error);
    return false;
  }
}
```

---


