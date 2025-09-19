const express = require('express')
const router = express.Router()

const conversationController = require('../controllers/conversation.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.get('/get/:id', AuthVerifier, RestrictAccess([ROLES.MANAGER, ROLES.EMPLOYEE]), conversationController.getConversationById)

router.post('/message', AuthVerifier, RestrictAccess([ROLES.MANAGER, ROLES.EMPLOYEE]), conversationController.sendMessage)

module.exports = router