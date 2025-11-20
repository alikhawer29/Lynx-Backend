# WhatsApp-Style Chat System - Complete Guide 💬

## 🎯 Overview

The Lynx chat system now works **exactly like WhatsApp**:

- ✅ Send text only
- ✅ Send files/images only
- ✅ Send text + files/images together
- ✅ Multiple file attachments (up to 10 files per message)
- ✅ Support Chat always appears first in chat list
- ✅ Real-time messaging with Socket.IO
- ✅ Read receipts, typing indicators, online status

---

## 📋 Chat List Behavior

### Sorting Rules

1. **Support Chat** always appears **first** (top of the list)
2. Other chats sorted by **most recent message**

### Example Chat List Response

```json
{
  "success": true,
  "total": 5,
  "data": [
    {
      "_id": "chat123",
      "chat_type": "support",
      "other_user": {
        "first_name": "Admin",
        "last_name": "Support",
        "image_url": "..."
      },
      "last_message_text": "How can I help you?",
      "last_message_time": "2025-11-20T10:30:00Z",
      "my_unread_count": 2,
      "is_active": true
    },
    {
      "_id": "chat456",
      "chat_type": "appointment",
      "other_user": {
        "first_name": "John",
        "last_name": "Provider"
      },
      "last_message_text": "📷 Photo",
      "last_message_time": "2025-11-20T09:15:00Z",
      "my_unread_count": 0
    }
  ]
}
```

---

## 📤 Sending Messages

### 1. Text Only

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "chat_room_id=CHAT_ROOM_ID" \
  -F "message_text=Hello! How are you?"
```

### 2. Files/Images Only

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "chat_room_id=CHAT_ROOM_ID" \
  -F "files=@/path/to/image1.jpg" \
  -F "files=@/path/to/image2.png"
```

### 3. Text + Files Together (WhatsApp Style!)

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "chat_room_id=CHAT_ROOM_ID" \
  -F "message_text=Check out these photos!" \
  -F "files=@/path/to/photo1.jpg" \
  -F "files=@/path/to/photo2.jpg" \
  -F "files=@/path/to/document.pdf"
```

### 4. Multiple Files (Up to 10)

```bash
curl -X POST http://localhost:5000/lynx/v1/api/chat/messages/send \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "chat_room_id=CHAT_ROOM_ID" \
  -F "files=@file1.jpg" \
  -F "files=@file2.png" \
  -F "files=@file3.pdf" \
  -F "files=@file4.docx"
```

---

## 📥 Message Response Format

### Text Message

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "msg123",
    "chat_room_id": "chat456",
    "sender_id": { ... },
    "receiver_id": { ... },
    "message_text": "Hello! How are you?",
    "attachments": [],
    "status": "sent",
    "is_read": false,
    "createdAt": "2025-11-20T10:30:00Z"
  }
}
```

### Message with Attachments

```json
{
  "success": true,
  "message": "Message sent successfully",
  "data": {
    "_id": "msg124",
    "message_text": "Check out these photos!",
    "attachments": [
      {
        "file_url": "uploads/chat/photo-1732098600000-123456789.jpg",
        "file_name": "photo1.jpg",
        "file_size": 245678,
        "file_type": "image",
        "mime_type": "image/jpeg"
      },
      {
        "file_url": "uploads/chat/document-1732098600001-987654321.pdf",
        "file_name": "document.pdf",
        "file_size": 512000,
        "file_type": "file",
        "mime_type": "application/pdf"
      }
    ],
    "status": "sent",
    "createdAt": "2025-11-20T10:31:00Z"
  }
}
```

---

## 🔄 Last Message Display

When a message contains only files (no text), the chat list shows:

- **Images**: `📷 Photo`
- **Files**: `📎 File`

When a message contains text, it shows the actual text.

---

## 🌐 Frontend Integration (JavaScript/React)

### Sending Text Only

```javascript
const sendTextMessage = async (chatRoomId, text) => {
  const formData = new FormData();
  formData.append("chat_room_id", chatRoomId);
  formData.append("message_text", text);

  const response = await fetch("/lynx/v1/api/chat/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return await response.json();
};
```

### Sending Files with Text

```javascript
const sendMessageWithFiles = async (chatRoomId, text, files) => {
  const formData = new FormData();
  formData.append("chat_room_id", chatRoomId);

  if (text) {
    formData.append("message_text", text);
  }

  // Add multiple files
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch("/lynx/v1/api/chat/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return await response.json();
};
```

### React Example with File Input

```jsx
import React, { useState } from "react";

function ChatInput({ chatRoomId }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const handleSend = async () => {
    const formData = new FormData();
    formData.append("chat_room_id", chatRoomId);

    if (message) {
      formData.append("message_text", message);
    }

    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await fetch("/lynx/v1/api/chat/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      setMessage("");
      setFiles([]);
    }
  };

  return (
    <div>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type message..."
      />
      <input
        type="file"
        multiple
        accept="image/*,application/pdf,.doc,.docx"
        onChange={handleFileChange}
      />
      <button onClick={handleSend}>Send</button>

      {files.length > 0 && (
        <div>Selected files: {files.map((f) => f.name).join(", ")}</div>
      )}
    </div>
  );
}
```

---

## 📱 Socket.IO Real-Time (Text Only)

**Note**: For file uploads, always use the REST API endpoint. Socket.IO is for text messages only.

### Send Text Message via Socket

```javascript
socket.emit("send_message", {
  chat_room_id: "CHAT_ROOM_ID",
  message_text: "Hello!",
  attachments: [], // Empty for text-only
});
```

### Receive Messages

```javascript
socket.on("receive_message", (message) => {
  console.log("New message:", message);

  // Display text
  if (message.message_text) {
    console.log("Text:", message.message_text);
  }

  // Display attachments
  if (message.attachments && message.attachments.length > 0) {
    message.attachments.forEach((attachment) => {
      console.log("File:", attachment.file_name);
      console.log("Type:", attachment.file_type);
      console.log("URL:", `${BASE_URL}/${attachment.file_url}`);
    });
  }
});
```

---

## ✅ Summary of Changes

### What Changed?

1. **Removed** `message_type`, `media_url`, `file_name`, `file_size` from request
2. **Added** `attachments` array to message model
3. **Support** for multiple files in one message
4. **Auto-detection** of file type (image vs file) based on MIME type
5. **Support Chat** always appears first in chat list
6. **Last message** shows emoji for files: 📷 Photo or 📎 File

### Migration from Old System

**Old Way** (Don't use):

```javascript
{
  message_type: 'image',
  media_url: 'path/to/file.jpg',
  file_name: 'file.jpg',
  file_size: 12345
}
```

**New Way** (Use this):

```javascript
// Just send files via FormData
formData.append("files", fileObject);
```

---

## 🚀 Quick Start

1. **Get chat list** (Support chat will be first):

   ```
   GET /chat/user-chats
   ```

2. **Send text message**:

   ```
   POST /chat/messages/send
   Body: { chat_room_id, message_text }
   ```

3. **Send files**:

   ```
   POST /chat/messages/send
   Body: FormData with 'files' field
   ```

4. **Send text + files**:
   ```
   POST /chat/messages/send
   Body: FormData with 'message_text' and 'files'
   ```

---

## 📞 Support

For questions or issues, contact the development team or refer to:

- `CHAT_SYSTEM_DOCUMENTATION.md` - Full API reference
- `CHAT_SOCKET_EVENTS.md` - Socket.IO events
- `CHAT_TESTING_GUIDE.md` - Testing instructions
