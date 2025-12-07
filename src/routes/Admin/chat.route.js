const express = require('express');
const router = express.Router();

const chatController = require('../../controllers/Admin/chat.controller');
const messageController = require('../../controllers/Admin/message.controller');
const { AuthVerifier, RestrictAccess } = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');
const { ROLES } = require('../../utils');

// Get User's Chat List
router.get(
    '/',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    chatController.getUserChats
);

// Search Chats
router.get(
    '/search/query',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    chatController.searchChats
);

// Get Messages in Chat - MOVE THIS AFTER SPECIFIC ROUTES
router.get(
    '/:chatId',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.getMessages
);


// Send Message (with optional file attachments)
router.post(
    '/send',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    upload('chat').any(),
    messageController.sendMessage
);

// ✅ MARK ALL MESSAGES AS READ - PUT THIS FIRST!
router.put(
    '/:chatId/read-all',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.markChatAsRead
);



// Mark Single Message as Read
router.put(
    '/messages/:messageId/read',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.markAsRead
);

// Delete Message
router.delete(
    '/messages/:messageId',
    AuthVerifier,
    RestrictAccess([ROLES.ADMIN]),
    messageController.deleteMessage
);

module.exports = router;