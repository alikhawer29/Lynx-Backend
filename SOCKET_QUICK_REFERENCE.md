# Socket.IO Quick Reference 🚀

## ✅ YES! Your Socket is Already Working!

When you send a message via REST API, the backend **automatically emits socket events** to all connected clients!

---

## 🔄 How It Works

```
You → REST API → Backend saves → Backend emits socket → All clients receive
```

### Example:

1. **You send message via REST API**:
   ```bash
   POST /chat/messages/send
   ```

2. **Backend automatically does this**:
   ```javascript
   // Save to database
   await message.save();
   
   // Emit to all connected clients
   io.to(chat_room_id).emit('receive_message', message);
   io.to(receiverId).emit('new_message_notification', { ... });
   ```

3. **All connected clients receive the message instantly!**

---

## 📱 React Native Setup (3 Steps)

### Step 1: Install
```bash
npm install socket.io-client
```

### Step 2: Connect
```javascript
import io from 'socket.io-client';

const socket = io('http://YOUR_IP:5000', {
  query: { token: 'YOUR_JWT_TOKEN' },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
});
```

### Step 3: Listen for Messages
```javascript
// Join chat room
socket.emit('join_chat', { chat_room_id: 'CHAT_ID' });

// Listen for new messages
socket.on('receive_message', (message) => {
  console.log('📩 New message:', message);
  // Update your UI here
});
```

---

## 📡 Socket Events

### Events Backend Emits (You Listen To):

| Event | When | Data |
|-------|------|------|
| `receive_message` | Message sent | Full message object |
| `new_message_notification` | New message for you | `{ chat_room_id, message, unread_count }` |
| `message_read` | Your message read | `{ message_id, read_at }` |
| `user_typing` | Someone typing | `{ user_id, is_typing }` |
| `user_online_status` | User online/offline | `{ user_id, is_online, last_seen }` |

### Events You Emit (Send to Backend):

| Event | Purpose | Data |
|-------|---------|------|
| `join_chat` | Join chat room | `{ chat_room_id }` |
| `leave_chat` | Leave chat room | `{ chat_room_id }` |
| `typing` | Send typing status | `{ chat_room_id, is_typing }` |

---

## 💬 Complete Chat Example

```javascript
import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

function ChatScreen({ chatRoomId, token }) {
  const [messages, setMessages] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Connect socket
    const newSocket = io('http://YOUR_IP:5000', {
      query: { token },
      transports: ['websocket'],
    });

    // Join chat room
    newSocket.emit('join_chat', { chat_room_id: chatRoomId });

    // Listen for messages
    newSocket.on('receive_message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('leave_chat', { chat_room_id: chatRoomId });
      newSocket.disconnect();
    };
  }, [chatRoomId, token]);

  const sendMessage = async (text, files) => {
    const formData = new FormData();
    formData.append('chat_room_id', chatRoomId);
    formData.append('message_text', text);
    
    files?.forEach(file => {
      formData.append('files', file);
    });

    await fetch('http://YOUR_IP:5000/lynx/v1/api/chat/messages/send', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    
    // Message will be received via socket automatically!
  };

  return (
    <View>
      {messages.map(msg => (
        <Text key={msg._id}>{msg.message_text}</Text>
      ))}
    </View>
  );
}
```

---

## 🎯 Key Points

✅ **REST API for sending** - Use REST API to send messages (handles files)  
✅ **Socket for receiving** - Socket automatically delivers messages in real-time  
✅ **No manual emit needed** - Backend emits socket events automatically  
✅ **Join chat room** - Must join room to receive messages  
✅ **Token required** - Pass JWT token when connecting  

---

## 🐛 Common Issues

### Socket not connecting?
```javascript
// Use IP address, not localhost
const SOCKET_URL = 'http://192.168.1.100:5000';

// For Android emulator
const SOCKET_URL = 'http://10.0.2.2:5000';
```

### Not receiving messages?
```javascript
// Make sure you joined the chat room
socket.emit('join_chat', { chat_room_id: chatRoomId });

// Check connection
console.log('Connected:', socket.connected);
```

---

## 📚 Full Documentation

- **REACT_NATIVE_SOCKET_GUIDE.md** - Complete React Native guide
- **CHAT_WHATSAPP_STYLE_GUIDE.md** - WhatsApp-style messaging guide

---

## 🚀 You're Ready!

Your socket system is **fully functional**. Just:
1. Install `socket.io-client`
2. Connect with your JWT token
3. Join chat rooms
4. Listen for `receive_message` event
5. Send messages via REST API

**That's it!** 🎉

