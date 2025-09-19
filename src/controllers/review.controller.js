const Review = require('../models/review.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createReview = (async (req, res) => {
    try {

        let { body, decoded } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let payload = {
            ...body,
            user: decoded.id
        }

        let review = new Review(payload)

        await review.save()

        return res.status(200).send({
            success: true,
            message: "Review Successfully Saved",
            data: review
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getReview = (async (req, res) => {
    try {

        let { page, per_page, search, from, to, sortBy, service } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (service) {
            filter = { ...filter, service }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let reviews = await Review.find(filter, projection, options).populate({ path: "user", select: "name picture email" }).sort(sort)

        let total = await Review.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: reviews
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getReviewById = (async (req, res) => {
    try {

        let { id } = req.params

        let review = await Review.findById(id).populate({ path: "user", select: "name picture email" })

        return res.status(200).send({
            success: true,
            data: review
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createReview,
    getReview,
    getReviewById
}