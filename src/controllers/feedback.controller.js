const Feedback = require('../models/feedback.model')
const { ERRORS, objectValidator, paginationHandler, getSearchQuery, getDateRangeQuery } = require('../utils')

const createFeedback = (async (req, res) => {
    try {

        let { body } = req

        let validate = objectValidator(body)

        if (!validate) {
            throw new Error(ERRORS.NULL_FIELD)
        }

        let feedback = new Feedback(body)

        await feedback.save()

        return res.status(200).send({
            success: true,
            message: "Feedback Successfully Saved",
            data: feedback
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        return res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFeedback = (async (req, res) => {
    try {

        let { page, per_page, search, from, to, sortBy } = req.query

        let options = paginationHandler(page, per_page)

        let filter = {}
        let sort = {}
        let projection = {}

        if (search) {
            filter = { ...filter, name: getSearchQuery(search) }
        }

        if (from || to) {
            filter = { ...filter, createdAt: getDateRangeQuery(from, to) }
        }

        if (sortBy) {
            sort = { [sortBy]: 1 }
        }

        let feedbacks = await Feedback.find(filter, projection, options).populate({ path: "user", select: "name email picture" }).sort(sort)

        let total = await Feedback.countDocuments(filter)

        res.status(200).send({
            success: true,
            total,
            data: feedbacks
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

const getFeedbackById = (async (req, res) => {
    try {

        let id = req.params.id

        let feedback = await Feedback.findById(id)

        res.status(200).send({
            success: true,
            data: feedback
        })

    } catch (e) {
        console.log("Error Message :: ", e)
        res.status(400).send({
            success: false,
            message: e.message
        })
    }
})

module.exports = {
    createFeedback,
    getFeedback,
    getFeedbackById
}