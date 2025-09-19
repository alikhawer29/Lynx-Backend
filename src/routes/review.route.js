const express = require('express')
const router = express.Router()

const reviewController = require('../controllers/review.controller')
const { AuthVerifier } = require('../middlewares/auth.middleware')

router.post('/create', AuthVerifier, reviewController.createReview)

router.get('/get', AuthVerifier, reviewController.getReview)

router.get('/get/:id', AuthVerifier, reviewController.getReviewById)

module.exports = router