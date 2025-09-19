const Notification = require('../models/notification.model')
const {  getSearchQuery, getDateRangeQuery, paginationHandler } = require('../utils')

const getNotification = (async (req, res) => {
    try {

        let { query, decoded } = req
        let { page, per_page, search, from, to, sortBy } = query

        let options = paginationHandler(page, per_page)

        let filter = {
            $or: [
                {
                    recipients: {
                        $in: [decoded.id]
                    }
                },
                {
                    for_all: true
                }
            ]
        }

        let sort = { createdAt: -1 }
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

        let notifications = await Notification.find(filter, projection, options).sort(sort)

        let total = await Notification.countDocuments(filter)

        return res.status(200).send({
            success: true,
            total,
            data: notifications
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
    getNotification,
}