const express = require('express')
const router = express.Router()

const userController = require('../controllers/user.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const { ROLES } = require('../utils')

router.get('/get', AuthVerifier, userController.getUser)

router.get('/get/:id', AuthVerifier, userController.getUserById)

router.put('/update', AuthVerifier, userController.updateUser)

router.patch('/handle-status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.handleStatus)

router.delete('/delete', AuthVerifier, userController.deleteUser)

router.post('/change-password', AuthVerifier, userController.changePassword)

router.get('/my-profile', AuthVerifier, userController.getMyProfile)

router.get('/home', AuthVerifier, userController.getHome)

router.put('/handle-favorite/:id', AuthVerifier, userController.handleFavoriteServices)

router.get('/favorites', AuthVerifier, userController.getFavoriteServices)

router.post('/logout', AuthVerifier, userController.logout)

module.exports = router