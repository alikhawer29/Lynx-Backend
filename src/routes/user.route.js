const express = require('express')
const router = express.Router()

const userController = require('../controllers/user.controller')
const { AuthVerifier, RestrictAccess } = require('../middlewares/auth.middleware')
const upload = require('../middlewares/upload.middleware')
const { ROLES } = require('../utils')

router.get('/get', AuthVerifier, userController.getUser)

router.get('/get/:id', AuthVerifier, userController.getUserById)

router.get('/appointments/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getAppointmentsByUser) //only admin can access this route

router.get('/provider-appointments/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getAppointmentsByProvider) //only admin can access this route

router.patch('/status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.updateUserStatus) //Update user status

router.patch('/handle-status/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.handleStatus)

router.patch('/verify/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.verifyUser)

router.patch('/schedule-interview/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.scheduleInterview)

//make an api in which admin approve or reject service provider request to upgrade their account to premium

router.patch('/upgrade-account/:id', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.upgradeAccount)

router.put('/update', AuthVerifier, upload("user").single("image"), userController.updateUser)

router.delete('/delete', AuthVerifier, userController.deleteUser)

router.post('/change-password', AuthVerifier, userController.changePassword)

router.get('/my-profile', AuthVerifier, userController.getMyProfile)

router.get('/home', AuthVerifier, RestrictAccess([ROLES.ADMIN]), userController.getHome)

router.put('/handle-favorite/:id', AuthVerifier, userController.handleFavoriteServices)

router.get('/favorites', AuthVerifier, userController.getFavoriteServices)

router.post('/logout', AuthVerifier, userController.logout)

module.exports = router